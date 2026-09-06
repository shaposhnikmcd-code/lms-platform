import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getYearlyGraceDays, getYearlySendpulseCourseId, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import { cohortModuleCount, monthlySchedule } from '@/lib/yearlyProgramAccess';
import {
  closeAccessInCourse,
  lookupStudentIdByEmail,
} from '@/lib/sendpulse';
import {
  removeSubscriptionAutopay,
  recordAutopayRemoveOutcome,
  WFP_REMOVE_FAILED_EVENT,
  WFP_REMOVE_SUCCEEDED_EVENT,
} from '@/lib/yearlyProgramAutopay';
import { syncYearlyProgress } from '@/lib/certificates/syncYearlyProgress';
import { sendYearlyProgramUpcomingChargeEmail } from '@/lib/yearlyProgramUpcomingChargeEmail';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { verifyBearer } from '@/lib/authTiming';
import { kyivMidnightUtc } from '@/lib/timezone';
import { WFP_REMOVE_ISSUE_THRESHOLD } from '@/lib/yearlyProgramIssues';
import {
  manualBeforeExpiry,
  manualOnExpiry,
  manualGraceStart,
  manualGraceMid,
  manualGraceLast,
  cyclicalChargeFailed1,
  cyclicalGraceMid,
  cyclicalGraceLast,
  accessClosed,
} from '@/lib/emailTemplates/yearlyProgram';

import { sendEmail } from '@/lib/mailer';
import {
  getYearlyProgramTelegramSettings,
  generateInviteForSubscription,
  kickSubscriptionFromChannel,
} from '@/lib/yearlyProgramTelegram';

const CONCURRENCY = 5;

/// Денний прохід — довга послідовна робота (SendPulse + WFP + Resend на кожну підписку).
/// Дефолтних 10-60с не вистачає на великий cohort → Fluid Compute-ліміт 300с.
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

/// Скільки підписок максимум лікуємо за один прохід heal_unopened — щоб крок не з'їв
/// увесь бюджет maxDuration (300с на 15 кроків) і не заблокував решту. Залишок підбереться завтра.
///
/// Батч адаптивний: одразу після запуску набору (перші `FRESH_LAUNCH_WINDOW_MS`) heal —
/// це основний механізм добору тих, кого не встиг обробити обірваний по таймауту
/// `executeLaunchLoop`. По 15 на добу великий набір лікувався б тиждень, тому у вікні
/// свіжого запуску беремо вчетверо більше; далі повертаємось до економного режиму.
const HEAL_UNOPENED_BATCH = 15;
/// 300, а не 60: heal — єдиний автоматичний шлях добору для набору, чий запуск обірвався
/// по таймауту (`launchedAt` уже claim-нутий, повторного проходу циклу не буде). З капом 60
/// набір на 300 людей лікувався б п'ять діб — реальний старт цього не переживе.
const HEAL_UNOPENED_BATCH_FRESH_LAUNCH = 300;
const FRESH_LAUNCH_WINDOW_MS = 7 * DAY_MS;

/// ЄДИНИЙ бюджет усього денного проходу. Раніше кожен важкий крок мав власний таймер
/// (150с на КОЖЕН запланований набір + 100с heal при maxDuration=300) — сума перевищувала
/// ліміт функції, і саме в ніч запуску решта кроків (grace-переходи, листи життєвого циклу)
/// могла не виконатись узагалі. Тепер дедлайн один на прохід, важкі кроки звіряються з ним.
const CRON_TOTAL_BUDGET_MS = 240_000;

/// Спільний бюджет на ВСІ заплановані запуски проходу (не на кожен набір окремо).
const SCHEDULED_LAUNCH_TOTAL_BUDGET_MS = 120_000;

/// Резерв, який важкі кроки лишають «хвосту» проходу (звірки, ретраї, push issue-ів).
const TAIL_STEPS_RESERVE_MS = 60_000;

/// Стеля часу на крок heal_unopened. Кап у 300 підписок сам по собі не влазить у
/// maxDuration (кожна — SendPulse + Telegram + лист), тому реальний обмежувач — час:
/// крок обробляє скільки встигає і зупиняється штатно. Фактичний бюджет — мінімум із
/// цієї стелі й залишку глобального дедлайну.
const HEAL_UNOPENED_BUDGET_MS = 100_000;

/// Скільки часу лишилось до глобального дедлайну проходу з відрахованим резервом хвоста.
/// Від'ємне значення = крок треба пропустити цілком.
function budgetLeftMs(cronDeadlineAt: number, reserveMs: number = TAIL_STEPS_RESERVE_MS): number {
  return cronDeadlineAt - Date.now() - reserveMs;
}

/// Скільки welcome-листів максимум досилаємо за прохід (на кожен набір).
const HEAL_EMAIL_BATCH = 40;

/// Мінімальний «відстій» між відкриттям доступу і досиланням листа. Захищає від гонки
/// з ручним запуском, який менеджер робить прямо зараз (доступ уже відкрито, розсилка
/// ще йде) — інакше cron надіслав би другий лист паралельно з першим.
const HEAL_EMAIL_MIN_AGE_MS = 6 * 60 * 60 * 1000;

/// Telegram invite-лінк живе 30 днів (`createChatInviteLink`, expireSeconds). Усе, що старше
/// 25 днів, у heal-кроці перегенеровуємо — інакше в welcome-лист потрапить мертве посилання.
/// Дубль константи з lib/yearlyProgramSendEmails.ts (INVITE_MAX_AGE_MS) — тримати синхронно.
const HEAL_INVITE_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000;

interface StepResult {
  step: string;
  processed: number;
  errors: string[];
  /// Set лише коли крок упав цілком (unhandled throw). Решта кроків усе одно виконується —
  /// раніше будь-який виняток (напр. недоступний SendPulse) зривав увесь денний прохід.
  error?: string;
  /// Додаткова не-помилкова інформація кроку (видно в JSON-відповіді cron-а і логах Vercel).
  info?: string;
}

/// Ізолятор кроку: падіння одного кроку не має зупиняти решту денного проходу.
async function runStep(step: string, fn: () => Promise<StepResult>): Promise<StepResult> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cron/yearly-subscriptions] step ${step} failed:`, e);
    return { step, processed: 0, errors: [], error: (e as Error).message.slice(0, 300) };
  }
}

/// Прапорці «лист надіслано» — по одному на кожен лист життєвого циклу підписки.
type ReminderFlag =
  | 'reminderSent3d'
  | 'reminderSentOnExpiry'
  | 'reminderSentGraceStart'
  | 'reminderSentGraceMid'
  | 'reminderSentGraceLast'
  | 'reminderSentExpired';

function flagData(flag: ReminderFlag, value: boolean): Prisma.YearlyProgramSubscriptionUpdateManyMutationInput {
  return { [flag]: value } as Prisma.YearlyProgramSubscriptionUpdateManyMutationInput;
}

function flagWhere(flag: ReminderFlag, value: boolean): Prisma.YearlyProgramSubscriptionWhereInput {
  return { [flag]: value } as Prisma.YearlyProgramSubscriptionWhereInput;
}

/// Вікно дедупу подій `reminder_email_failed` (одна подія на тип листа на добу).
/// Синхронізоване з вікном детектора EMAIL_FAILED у lib/yearlyProgramIssues.ts (3 дні):
/// поки проблема жива, у вкладці «Помилки» завжди є свіжий запис.
const FAILED_EVENT_DEDUP_MS = 24 * 60 * 60 * 1000;

/// Єдина точка відправки cron-листів: claim прапорця → відправка → лог.
///
/// Чому claim ПЕРЕД відправкою: два паралельні проходи (ретрай Vercel-cron, ручний виклик)
/// інакше надішлють лист двічі. `updateMany` з умовою `flag: false` атомарний — виграє один.
/// Чому відкат прапорця при фейлі: Resend SDK v6 не кидає виняток, а повертає `{error}`.
/// Раніше прапорець ставився беззастережно, тож недоставлений лист назавжди вважався
/// надісланим — людина мовчки не отримувала жодного попередження. Тепер невдала спроба
/// відкочує прапорець (завтра спробуємо ще) і лишає подію `reminder_email_failed`.
async function sendReminderOnce(args: {
  subscriptionId: string;
  flag: ReminderFlag;
  to: string;
  render: () => Promise<{ subject: string; html: string }>;
  eventType: string;
  eventMessage?: string;
}): Promise<{ outcome: 'sent' | 'already_claimed' | 'failed'; error?: string }> {
  const { subscriptionId, flag, to, render, eventType, eventMessage } = args;

  const claim = await prisma.yearlyProgramSubscription.updateMany({
    where: { id: subscriptionId, ...flagWhere(flag, false) },
    data: flagData(flag, true),
  });
  if (claim.count === 0) return { outcome: 'already_claimed' };

  let error: string | null = null;
  try {
    const { subject, html } = await render();
    const res = await sendEmail({ to, subject, html });
    if (!res.ok) error = res.error ?? 'send failed';
    // skipped === true → RESEND_API_KEY не заданий, лист лише в консолі. Це НЕ доставка:
    // прапорець відкочуємо, інакше на проді з тимчасово знятим ключем листи б «згоріли».
    else if (res.skipped) error = 'mailer_not_configured';
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    await prisma.yearlyProgramSubscription.updateMany({
      where: { id: subscriptionId },
      data: flagData(flag, false),
    });
    // Дедуп: підписка, що застрягла (напр. невалідна адреса), інакше плодила б однакову
    // подію щодня. Один запис на 24 год для кожного типу листа — достатньо і для
    // вкладки «Помилки», і для розбору в історії підписки.
    const since = new Date(Date.now() - FAILED_EVENT_DEDUP_MS);
    const recent = await prisma.yearlyProgramSubscriptionEvent.findFirst({
      where: {
        subscriptionId,
        type: 'reminder_email_failed',
        createdAt: { gte: since },
        message: { startsWith: `${eventType} ` },
      },
      select: { id: true },
    });
    if (!recent) {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId,
          type: 'reminder_email_failed',
          message: `${eventType} не надіслано: ${error.slice(0, 200)}`,
          metadata: { flag, eventType, error: error.slice(0, 500) },
        },
      });
    }
    return { outcome: 'failed', error };
  }

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: { subscriptionId, type: eventType, message: eventMessage },
  });
  return { outcome: 'sent' };
}

async function processInParallel<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(handler));
  }
}

/// Запобіжник «не чіпати до запуску»: підписки cohort-у, який ще НЕ запущено
/// (launchedAt=null), не отримують GRACE/нагадувань/закриття доступу — програма ще
/// не стартувала, вимагати наступну оплату нема за що. Продажі йдуть заздалегідь,
/// відлік місяців якориться на cohort.startDate (lib/yearlyProgramAccess.ts), а весь
/// життєвий цикл протермінування вмикається лише після фактичного запуску.
/// Підписки без cohort (legacy) проходять як раніше.
const NOT_IN_UNLAUNCHED_COHORT = {
  OR: [
    { cohort: null },
    { cohort: { launchedAt: { not: null } } },
  ],
};

/// Щоденний cron Річної програми (04:00, `0 4 * * *` у vercel.json).
/// — Переводить ACTIVE → GRACE коли expiresAt у минулому.
/// — Закриває доступ (GRACE → EXPIRED) коли grace-період вийшов.
/// — Добиває зняття WFP-регулярки там, де вона могла пережити підписку (`retry_autopay_remove`).
/// — Досилає welcome-лист там, де доступ уже відкрито, а листа не було (`heal_missing_welcome_email`).
/// — Раз на добу штовхає менеджерам критичні issue-и (`push_critical_issues`).
/// — Шле нагадування за адаптивним розкладом. Тривалість grace береться з налаштувань
///   (`yearlyGraceDays` в `AppSetting`, редагується з адмінки — тому кількість днів ніде
///   не хардкодиться) у МОМЕНТ переходу в GRACE і далі фіксується в записі: увесь розклад
///   листів конкретної підписки рахується від `gracePeriodEndsAt − graceStartedAt`
///   (`storedGraceDays`), тож зміна налаштування посеред чужого grace нікому не бреше.
///   mid/last вмикаються лише за достатньої зафіксованої тривалості:
///   MANUAL (разова оплата, autoRenew=false):
///     за 3 дні до закінчення → у день закінчення → grace-start → mid (≥5д) → last (≥3д) → закриття
///   CYCLICAL (автоплатіж) — коли є про що попереджати, тобто списання провалилось
///   АБО правила регулярки у WFP немає взагалі (див. `cyclicalNeedsWarning`):
///     grace-start → mid (≥5д) → last (≥3д) → закриття
///
/// Порядок кроків у GET нижче не випадковий. По-перше, легкі кроки (статуси, прапорці,
/// листи життєвого циклу) виконуються ПЕРЕД важкими (запуск набору, heal, масові розсилки):
/// важкі ділять єдиний бюджет `CRON_TOTAL_BUDGET_MS` і в ніч запуску великого набору
/// з'їдали б увесь ліміт функції, лишаючи життєвий цикл без жодного проходу.
/// По-друге, обидва manual-нагадування йдуть ДО переходу
/// в GRACE (інакше лист «сьогодні останній день» не міг би піти), а grace-start має
/// 20-годинний гейт — тобто виходить наступним добовим проходом, а не в тому ж, у якому
/// підписка щойно потрапила в GRACE. Виняток — короткий grace (<3 днів), там лист іде одразу.
/// Повністю оплачені підписки (усі свої модулі набору) з усіх платіжних нагадувань
/// виключені (`isFullyPaid`).
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StepResult[] = [];
  // Один дедлайн на весь прохід — див. CRON_TOTAL_BUDGET_MS.
  const cronDeadlineAt = Date.now() + CRON_TOTAL_BUDGET_MS;

  // === Легкі кроки — ПЕРШИМИ ===
  // Переходи статусів і листи життєвого циклу коштують копійки, але саме вони найдорожчі
  // за наслідками (не перевів у GRACE — не закрив доступ; не надіслав «останній день» —
  // людина не дізналась). Тримати їх після запуску/heal означало, що в ніч запуску великого
  // набору вони не виконуються взагалі. Тепер вони йдуть до важких і не голодують ніколи.
  results.push(await runStep('archive_stale_pending', archiveStalePending));
  // ВАЖЛИВО: обидва manual-нагадування йдуть ДО transitionActiveToGrace. Вони шукають
  // підписки в статусі ACTIVE, а grace-перехід у той самий прохід забирає з ACTIVE усе,
  // що протермінувалось — при зворотному порядку лист «сьогодні останній день» не міг
  // піти взагалі (підписка вже була в GRACE).
  results.push(await runStep('manual_before_expiry', sendManualBeforeExpiryReminders));
  results.push(await runStep('manual_on_expiry', sendManualOnExpiryReminders));
  // Перед grace-переходом: крок дивиться на ACTIVE-підписки, і саме тут вони ще ACTIVE.
  results.push(await runStep('autopay_precharge_notice', sendAutopayPrechargeNotices));
  results.push(await runStep('active_to_grace', transitionActiveToGrace));
  results.push(await runStep('expire_grace', expireGraceSubscriptions));
  results.push(await runStep('grace_start', sendGraceStartReminders));
  results.push(await runStep('grace_mid', sendGraceMidReminders));
  results.push(await runStep('grace_last', sendGraceLastReminders));

  // === Важкі кроки — під спільним дедлайном ===
  // Порядок усередині групи: спочатку відкрити доступ, потім розіслати листи (розсилка
  // пропускає тих, у кого доступу ще немає), потім добір того, що не долетіло.
  results.push(await runStep('runScheduledCohortLaunches', () => runScheduledCohortLaunches(cronDeadlineAt)));
  results.push(await runStep('sendScheduledCohortLaunchEmails', () => sendScheduledCohortLaunchEmails(cronDeadlineAt)));
  results.push(await runStep('heal_unopened', () => healUnopenedAccess(cronDeadlineAt)));
  // Після планових розсилок: те, що лишилось без листа після них, — це вже дірка, а не черга.
  results.push(await runStep('heal_missing_welcome_email', () => healMissingWelcomeEmails(cronDeadlineAt)));
  results.push(await runStep('sync_progress', syncYearlyCourseProgress));
  results.push(await runStep('retry_autopay_remove', () => retryAutopayRemoval(cronDeadlineAt)));
  results.push(await runStep('wfp_schedule_cache', () => refreshWfpScheduleCache(cronDeadlineAt)));
  // Останнім: до цього моменту всі кроки вже полагодили те, що лагодиться само, тож
  // менеджерам іде лише те, що система сама не вирішить.
  results.push(await runStep('push_critical_issues', pushCriticalIssues));

  // ok=false якщо хоча б один крок упав цілком — видно і в логах Vercel-cron, і при ручному виклику.
  const failedSteps = results.filter((r) => r.error).map((r) => r.step);
  return NextResponse.json({
    ok: failedSteps.length === 0,
    ...(failedSteps.length > 0 ? { failedSteps } : {}),
    results,
    timestamp: new Date().toISOString(),
  });
}

/// Запланований запуск cohort-у. Менеджер міг натиснути 🚀 Запустити з відстрочкою —
/// `launchScheduledFor` у майбутньому. Cron перевіряє: коли launchScheduledFor <= now
/// AND launchedAt IS NULL → атомарно claim-имо launchedAt і запускаємо executeLaunchLoop
/// (відкриття SendPulse + перерахунок expiresAt + лог events). Idempotent через атомарний
/// claim — якщо інший процес встиг раніше, цей пропускає.
async function runScheduledCohortLaunches(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  // Спільний бюджет на ВСІ набори проходу (а не 150с на кожен): у ніч, коли стартують
  // два набори, старий підхід сам собою вилітав за maxDuration.
  const stepDeadlineAt = Math.min(
    cronDeadlineAt - TAIL_STEPS_RESERVE_MS,
    Date.now() + SCHEDULED_LAUNCH_TOTAL_BUDGET_MS,
  );
  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      launchScheduledFor: { lte: now },
      launchedAt: null,
    },
    select: { id: true, name: true, startDate: true, endDate: true, createdAt: true, launchScheduledFor: true },
  });
  if (cohorts.length === 0) return { step: 'runScheduledCohortLaunches', processed: 0, errors };

  const { executeLaunchLoop } = await import('@/lib/yearlyProgramLaunch');

  let processed = 0;
  let deferred = 0;
  for (const c of cohorts) {
    // Бюджет вичерпано — набір НЕ claim-имо (launchedAt лишається null), щоб завтрашній
    // прохід узявся за нього з нуля. Claim без роботи був би найгіршим варіантом:
    // «запущено», але нікому нічого не відкрито, і повторного циклу вже не буде.
    if (Date.now() >= stepDeadlineAt) {
      deferred++;
      continue;
    }
    try {
      // Атомарний claim, аналогічно до launch-route — захищає від паралельного запуску.
      const claim = await prisma.yearlyProgramCohort.updateMany({
        where: { id: c.id, launchedAt: null },
        data: { launchedAt: now, launchScheduledFor: null },
      });
      if (claim.count === 0) continue; // інший процес уже claim-ив

      const summary = await executeLaunchLoop(
        { id: c.id, startDate: c.startDate, endDate: c.endDate, createdAt: c.createdAt },
        'scheduled-cron',
        { deadlineAt: new Date(stepDeadlineAt) },
      );
      processed++;
      if (summary.failed > 0) {
        errors.push(`${c.name}: ${summary.failed}/${summary.total} failed`);
      }
      if (summary.interrupted) {
        errors.push(`${c.name}: перервано за дедлайном, лишилось ${summary.interrupted.remaining} — добере heal_unopened`);
      }
    } catch (e) {
      errors.push(`cohort ${c.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return {
    step: 'runScheduledCohortLaunches',
    processed,
    errors,
    ...(deferred > 0
      ? { info: `бюджет проходу вичерпано — ${deferred} набір(ів) не запускали, спроба наступним проходом` }
      : {}),
  };
}

/// Self-healing «доступ не відкрився». Ловить дві дірки:
///   (а) запуск cohort-у обірвався по таймауту — launchedAt уже виставлений, тож повторного
///       проходу executeLaunchLoop не буде, і решта студентів лишились без доступу;
///   (б) студент оплатив після запуску, а SendPulse у той момент збійнув — ніхто не повторить.
///
/// Критерій навмисно вузький — «лікуємо живих у живому наборі»:
///   • ACTIVE/GRACE — беремо як є (доступ оплачений, просто не відкрився).
///   • PENDING — тільки якщо оплачений доступ чинний ЗАРАЗ (`expiresAt >= now`). Це
///     закриває дірку з повторною покупкою: при ініціації нового чекауту мертва підписка
///     (EXPIRED/CANCELLED) реюзається і переводиться в PENDING ще ДО оплати, а старі
///     PAID-платежі лишаються на ній. Без перевірки expiresAt нічний heal бачив би
///     «PENDING + PAID + доступ не відкрито» і відкривав людині навчання безкоштовно.
///   • EXPIRED/CANCELLED/ARCHIVED НЕ чіпаємо взагалі: там доступ закритий свідомо, а heal
///     воскресив би підписку (ACTIVE + SP-доступ + welcome-лист по давно завершеному
///     навчанню), і завтрашній cron знову гнав би її через GRACE-цикл з листами.
///   • cohort має бути не лише launched, а й незавершений (`endDate >= now`) — інакше в heal
///     потрапляли б минулорічні набори.
/// `runExtraLaunchForSubscription` ідемпотентний — повторне відкриття вже відкритого
/// поверне already_opened без побічних дій.
///
/// Telegram-prestep дзеркалить WFP-callback: якщо канал у режимі autoAdd і студент лишив
/// @username — генеруємо (ідемпотентно) invite-link ДО листа, щоб у welcome була кнопка
/// вступу в канал. Помилка генерації не блокує відкриття доступу.
async function healUnopenedAccess(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();

  // Бюджет кроку = мінімум зі своєї стелі й залишку глобального дедлайну (з резервом
  // на хвіст проходу). Якщо часу не лишилось — крок не починається взагалі: краще
  // чесно нічого не зробити й лишити час решті, ніж бути зарубаним посеред роботи.
  const budgetMs = Math.min(HEAL_UNOPENED_BUDGET_MS, budgetLeftMs(cronDeadlineAt));
  if (budgetMs <= 0) {
    return { step: 'heal_unopened', processed: 0, errors, info: 'пропущено — бюджет проходу вичерпано, добір наступним проходом' };
  }

  // Вікно свіжого запуску → більший батч (див. HEAL_UNOPENED_BATCH_FRESH_LAUNCH).
  const freshLaunches = await prisma.yearlyProgramCohort.count({
    where: { launchedAt: { gte: new Date(now.getTime() - FRESH_LAUNCH_WINDOW_MS) } },
  });
  const batchSize = freshLaunches > 0 ? HEAL_UNOPENED_BATCH_FRESH_LAUNCH : HEAL_UNOPENED_BATCH;

  const { runExtraLaunchForSubscription, launchEligibleSubscriptionWhere } = await import('@/lib/yearlyProgramLaunch');

  // Предикат eligibility — спільний з циклом запуску (`launchEligibleSubscriptionWhere`):
  // статуси + «є оплата, зарахована в доступ». Дублювати умови тут не можна — саме на
  // розбіжності heal підбирав підписки, які сам extra-launch потім відхиляв.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      ...launchEligibleSubscriptionWhere(now),
      sendpulseAccessOpenedAt: null,
      cohort: { launchedAt: { not: null }, endDate: { gte: now } },
    },
    select: {
      id: true,
      telegramUsername: true,
      telegramInviteLink: true,
      telegramInvitedAt: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });
  if (subs.length === 0) return { step: 'heal_unopened', processed: 0, errors };

  // Налаштування каналу однакові для всього проходу — читаємо один раз.
  let tgSettings: Awaited<ReturnType<typeof getYearlyProgramTelegramSettings>> | null = null;
  try {
    tgSettings = await getYearlyProgramTelegramSettings();
  } catch (e) {
    errors.push(`telegram_settings: ${(e as Error).message.slice(0, 200)}`);
  }

  let processed = 0;
  let budgetHit = false;
  const budgetEndsAt = Date.now() + budgetMs;
  for (const s of subs) {
    if (Date.now() >= budgetEndsAt) {
      budgetHit = true;
      break;
    }
    let inviteLink = s.telegramInviteLink ?? null;
    if (tgSettings?.autoAdd && tgSettings.chatId && s.telegramUsername) {
      // Протухлий лінк гірший за його відсутність: людина клікає в листі й отримує
      // «Invite link is invalid». Старший за HEAL_INVITE_MAX_AGE_MS (або без дати
      // генерації) — перегенеровуємо через force, як це робить масова розсилка.
      const stale =
        !s.telegramInviteLink ||
        !s.telegramInvitedAt ||
        now.getTime() - s.telegramInvitedAt.getTime() > HEAL_INVITE_MAX_AGE_MS;
      try {
        const tgRes = await generateInviteForSubscription({
          subscriptionId: s.id,
          triggeredBy: 'system:heal-cron',
          force: stale,
          prefetched: {
            id: s.id,
            telegramInviteLink: s.telegramInviteLink ?? null,
            userEmail: s.user?.email ?? null,
            userName: s.user?.name ?? null,
          },
        });
        if (tgRes.ok) inviteLink = tgRes.inviteLink;
        else errors.push(`${s.id} telegram: ${(tgRes.error ?? 'unknown').slice(0, 120)}`);
      } catch (e) {
        errors.push(`${s.id} telegram: ${(e as Error).message.slice(0, 120)}`);
      }
    }

    try {
      const res = await runExtraLaunchForSubscription(s.id, 'heal-cron', { telegramInviteLink: inviteLink });
      if (res.ok) processed++;
      else if (res.reason && res.reason !== 'already_opened') {
        errors.push(`${s.id}: ${res.reason.slice(0, 200)}`);
      }
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return {
    step: 'heal_unopened',
    processed,
    errors,
    ...(budgetHit
      ? { info: `час кроку вичерпано (${Math.round(budgetMs / 1000)}с) — оброблено ${processed} з ${subs.length}, решта наступним проходом` }
      : subs.length === batchSize
        ? { info: `batch cap ${batchSize}${freshLaunches > 0 ? ' (свіжий запуск)' : ''} — решта наступним проходом` }
        : {}),
  };
}

/// Self-healing «доступ є, а листа немає». Дзеркальна дірка до `heal_unopened`: SendPulse
/// відкрили, а welcome-лист із входом не пішов — масова розсилка пропустила людину
/// (оплатила пізніше), лист впав на Resend, або extra-launch відкрив доступ у момент,
/// коли пошта лежала. Студент платить, доступ є, але він про це не знає.
///
/// Критерій навмисно вузький:
///   • набір launched, ще не завершений (`endDate >= now`) і по ньому ВЖЕ була масова
///     розсилка (`emailSentAt != null`). Останнє критично: якщо менеджер свідомо запустив
///     набір без листів (або запланував розсилку на потім), cron не має вирішувати за нього.
///   • запланована розсилка не має чекати попереду (`emailScheduledFor` у майбутньому) —
///     інакше лист пішов би раніше за задуманий менеджером час.
///   • доступ відкрито щонайменше `HEAL_EMAIL_MIN_AGE_MS` тому — щоб не гонитись із
///     ручним запуском, який іде прямо зараз.
///   • статус ACTIVE/GRACE + є PAID-платіж; сам `sendCohortLaunchEmails` ще раз перевіряє
///     і оплату, і відкритий доступ, тож зайвого листа неоплаченому не буде.
/// Дедуп — по події `launch_email_sent` ЦЬОГО набору (`metadata.cohortId`), як і в самій
/// розсилці: подія з торішнього набору не має глушити лист нового.
async function healMissingWelcomeEmails(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const openedBefore = new Date(now.getTime() - HEAL_EMAIL_MIN_AGE_MS);

  const budgetMs = budgetLeftMs(cronDeadlineAt);
  if (budgetMs <= 0) {
    return { step: 'heal_missing_welcome_email', processed: 0, errors, info: 'пропущено — бюджет проходу вичерпано, добір наступним проходом' };
  }
  const stepDeadlineAt = new Date(Date.now() + budgetMs);

  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      launchedAt: { not: null },
      endDate: { gte: now },
      emailSentAt: { not: null },
      OR: [{ emailScheduledFor: null }, { emailScheduledFor: { lte: now } }],
    },
    select: { id: true, name: true, startDate: true, endDate: true, launchEmailSubject: true, launchEmailBody: true },
  });
  if (cohorts.length === 0) return { step: 'heal_missing_welcome_email', processed: 0, errors };

  const { sendCohortLaunchEmails } = await import('@/lib/yearlyProgramSendEmails');

  let processed = 0;
  let capped = false;
  let deadlineHit = false;
  for (const cohort of cohorts) {
    if (Date.now() >= stepDeadlineAt.getTime()) {
      deadlineHit = true;
      break;
    }
    try {
      const subs = await prisma.yearlyProgramSubscription.findMany({
        where: {
          cohortId: cohort.id,
          status: { in: ['ACTIVE', 'GRACE'] },
          sendpulseAccessOpenedAt: { not: null, lte: openedBefore },
          payments: { some: { status: 'PAID' } },
          // Дедуп — по події ЦЬОГО набору, а не по будь-якій. Без `metadata.cohortId`
          // перенесений (carryover) чи повторний покупець із торішньою подією
          // `launch_email_sent` не отримував welcome-лист нового набору НІКОЛИ.
          // Той самий критерій, що й dedup у lib/yearlyProgramSendEmails.ts.
          events: {
            none: {
              type: 'launch_email_sent',
              metadata: { path: ['cohortId'], equals: cohort.id },
            },
          },
        },
        select: { id: true },
        orderBy: { sendpulseAccessOpenedAt: 'asc' },
        take: HEAL_EMAIL_BATCH,
      });
      if (subs.length === 0) continue;
      if (subs.length === HEAL_EMAIL_BATCH) capped = true;

      // targetIds → per-recipient режим: `emailSentAt` набору не переписується, а dedup
      // нам не потрібен (ми й відібрали тих, у кого події про лист немає).
      const summary = await sendCohortLaunchEmails(cohort, {
        targetIds: subs.map((s) => s.id),
        actorLabel: 'heal-cron',
        source: 'cron',
        deadlineAt: stepDeadlineAt,
      });
      processed += summary.sent;
      if (summary.failed > 0) errors.push(`${cohort.name}: ${summary.failed}/${summary.total} failed`);
      if (summary.interrupted) deadlineHit = true;
    } catch (e) {
      errors.push(`cohort ${cohort.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  const infoParts = [
    deadlineHit ? 'бюджет проходу вичерпано — решта наступним проходом' : null,
    capped ? `batch cap ${HEAL_EMAIL_BATCH} на набір — решта наступним проходом` : null,
  ].filter(Boolean);
  return {
    step: 'heal_missing_welcome_email',
    processed,
    errors,
    ...(infoParts.length > 0 ? { info: infoParts.join(' · ') } : {}),
  };
}

/// Запланована welcome-розсилка cohort-у. Менеджер міг (а) при запуску LaunchProgramModal
/// поставити чекбокс "✉️ Надіслати лист одразу" разом зі scheduled launch — `emailScheduledFor`
/// = `launchScheduledFor`; (б) пізніше, коли cohort уже launched, запланувати розсилку
/// окремо. В обох випадках cron перевіряє `emailScheduledFor <= now AND emailSentAt = null`
/// і виконує розсилку.
///
/// Порядок у GET handler гарантує: спочатку `runScheduledCohortLaunches` відкриває доступ
/// (виставляє статус ACTIVE), і тільки потім ця функція шле листи. Тому навіть для парного
/// сценарію launch+email розсилка йде ПІСЛЯ відкриття доступу — посилання у листі вже
/// працюють.
async function sendScheduledCohortLaunchEmails(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();

  const budgetMs = budgetLeftMs(cronDeadlineAt);
  if (budgetMs <= 0) {
    return { step: 'sendScheduledCohortLaunchEmails', processed: 0, errors, info: 'пропущено — бюджет проходу вичерпано, розсилка наступним проходом' };
  }
  const stepDeadlineAt = new Date(Date.now() + budgetMs);

  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      emailScheduledFor: { lte: now },
      emailSentAt: null,
    },
    select: { id: true, name: true, startDate: true, endDate: true, launchEmailSubject: true, launchEmailBody: true },
  });

  if (cohorts.length === 0) return { step: 'sendScheduledCohortLaunchEmails', processed: 0, errors };

  const { sendCohortLaunchEmails } = await import('@/lib/yearlyProgramSendEmails');

  let processed = 0;
  let deadlineHit = false;
  for (const cohort of cohorts) {
    if (Date.now() >= stepDeadlineAt.getTime()) {
      deadlineHit = true;
      break;
    }
    try {
      const summary = await sendCohortLaunchEmails(cohort, {
        actorLabel: 'scheduled-cron',
        source: 'cron',
        deadlineAt: stepDeadlineAt,
      });
      processed += summary.sent;
      if (summary.failed > 0) {
        errors.push(`${cohort.name}: ${summary.failed}/${summary.total} failed`);
      }
      if (summary.interrupted) {
        deadlineHit = true;
        errors.push(`${cohort.name}: розсилку перервано за дедлайном, лишилось ${summary.interrupted.remaining} — дошле heal_missing_welcome_email`);
      }
    } catch (e) {
      errors.push(`cohort ${cohort.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return {
    step: 'sendScheduledCohortLaunchEmails',
    processed,
    errors,
    ...(deadlineHit ? { info: 'бюджет проходу вичерпано — решта наступним проходом' } : {}),
  };
}

/// Авто-архів покинутих чекаутів: PENDING без жодного оплаченого платежу, старші за 7 діб.
/// Це незавершені спроби (закрив форму / картку відхилили й не повернувся) — не клієнти,
/// лише засмічують список. Переводимо в ARCHIVED (зникає з дефолтного вигляду Річної,
/// лишається доступним через фільтр «Архів»). Той самий payments-guard в updateMany —
/// захист від рейсу: якщо людина встигла оплатити саме в цей момент, підписку не чіпаємо.
///
/// ВАЖЛИВО: ручно додані студенти (manuallyAddedAt != null) НЕ архівуються — менеджер
/// свідомо завів їх у статусі «Очікує» і може підтверджувати оплату (готівка/переказ/ФОП)
/// будь-коли пізніше. Без цього винятку студент зник би в архів через добу.
///
/// Це safety net для тих, хто так і не оплатив. Дублі-спроби клієнтів, які ВЖЕ оплатили,
/// архівуються одразу в момент успішного платежу — `archiveDuplicatePendingSubscriptions`
/// (lib/yearlyProgramDedup.ts) з WFP-callback-у, без очікування доби.
///
/// ДРУГИЙ ВИНЯТОК — сліди корекції платежу. Підписка, у якої менеджер виключив з доступу
/// або видалив єдиний платіж, повертається у PENDING (`revertedToPending`) — і без цього
/// винятку вночі мовчки їхала б в ARCHIVED як «покинутий чекаут». Тому не архівуємо тих,
/// у кого є Payment зі слідом реальних грошей (PAID або виключений з доступу) або подія
/// корекції платежу в журналі (сам платіж міг бути видалений).
///
/// ⚠️ Умова саме `none: { PAID | excludedFromAccess }`, а НЕ `none: {}`. Чекаут створює
/// Payment(PENDING) у тому ж реквесті, що й підписку, тож «жодного Payment-рядка» не буває
/// ні в кого — з `none: {}` крок не архівував НІКОГО і список засмічувався покинутими
/// спробами оплати. PENDING/FAILED-рядок — це і є слід покинутого чекауту, він архівуванню
/// не заважає.
async function archiveStalePending(): Promise<StepResult> {
  const errors: string[] = [];
  // 7 діб, а не 24 год: «PENDING-платіж» покинутого чекаута і «загублений callback
  // реальної оплати» (наш endpoint упав, WFP-ретраї не долетіли) виглядають у БД
  // ІДЕНТИЧНО. Заархівований платник — це відкочений пізній callback (SUB_ARCHIVED),
  // платіж навічно PENDING і дубль-підписка при повторній покупці; тиждень дає час
  // WFP-ретраям, скаргам і оку менеджера. Ціна — покинуті спроби висять у списку 7 днів.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  /// «Платіж, який щось означає»: реально оплачений або свідомо виключений з доступу
  /// менеджером. Спільний предикат для вибірки і для guard-а в updateMany.
  const NO_MEANINGFUL_PAYMENT = {
    payments: { none: { OR: [{ status: 'PAID' }, { excludedFromAccess: true }] } },
  } satisfies Prisma.YearlyProgramSubscriptionWhereInput;
  const candidates = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
      ...NO_MEANINGFUL_PAYMENT,
      manuallyAddedAt: null,
    },
    select: { id: true },
    // Кап на прохід: перший запуск після деплою розгрібає багатомісячний беклог покинутих
    // спроб — без ліміту крок з'їв би час усього нічного проходу (він іде першим і
    // дедлайну не має). Хвіст добирається наступними ночами.
    take: 200,
    orderBy: { createdAt: 'asc' },
  });

  // Платежів у БД уже немає (видалили), але слід корекції лишився в подіях — не архівуємо.
  const correctedIds = candidates.length > 0
    ? new Set(
        (await prisma.yearlyProgramSubscriptionEvent.findMany({
          where: {
            subscriptionId: { in: candidates.map((s) => s.id) },
            OR: [
              { metadata: { path: ['paymentDeleted'], equals: true } },
              { metadata: { path: ['paymentAccess'], equals: true } },
            ],
          },
          select: { subscriptionId: true },
          distinct: ['subscriptionId'],
        })).map((e) => e.subscriptionId),
      )
    : new Set<string>();
  const subs = candidates.filter((s) => !correctedIds.has(s.id));

  let processed = 0;
  await processInParallel(subs, async (s) => {
    try {
      const res = await prisma.yearlyProgramSubscription.updateMany({
        where: { id: s.id, status: 'PENDING', ...NO_MEANINGFUL_PAYMENT, manuallyAddedAt: null },
        data: { status: 'ARCHIVED' },
      });
      if (res.count === 0) return; // встигли оплатити між вибіркою й апдейтом — не чіпаємо
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'admin_action',
          message: 'Авто-архів: незавершена спроба оплати без оплати понад 7 діб',
          metadata: { reason: 'stale-pending-autocleanup' },
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'archive_stale_pending', processed, errors };
}

async function transitionActiveToGrace(): Promise<StepResult> {
  const now = new Date();
  const errors: string[] = [];
  const graceDays = await getYearlyGraceDays(prisma);
  // Кінець grace — 00:00 КИЇВСЬКОЇ доби через graceDays днів, а не «зараз + N×24год».
  // Так у листі стоїть чесна календарна дата («до 12.08»), студент має весь останній день
  // цілком, а закриття не «повзе» разом із часом нічного проходу.
  const gracePeriodEndsAt = kyivMidnightUtc(now, graceDays);
  const candidates = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    select: { id: true, userId: true, plan: true, autoRenew: true, failedChargeCount: true, expiresAt: true },
  });

  // Буфер для MONTHLY-автоплатежу: WFP списує за розкладом, а cron біжить щодня о 04:00.
  // Якщо чергове списання за цей день ще не надійшло (Approved-callback приходить пізніше),
  // не штовхаємо підписку в GRACE одразу — інакше студент отримує хибний grace-лист, хоча
  // гроші спишуться за кілька годин і підписка повернеться в ACTIVE. Переводимо в GRACE лише
  // якщо: (а) списання реально провалилось — failedChargeCount > 0, або (б) доступ
  // протермінований довше за буфер (WFP тихо перестав списувати — тоді експайр обов'язковий,
  // щоб не лишити неоплачений доступ назавжди). Для YEARLY і MONTHLY-РАЗОВА буфера немає.
  const AUTOPAY_GRACE_BUFFER_MS = 2 * 24 * 60 * 60 * 1000;
  const subs = candidates.filter((s) => {
    const isAutopay = s.plan === 'MONTHLY' && s.autoRenew;
    if (!isAutopay) return true;
    if ((s.failedChargeCount ?? 0) > 0) return true;
    return s.expiresAt != null && s.expiresAt.getTime() < now.getTime() - AUTOPAY_GRACE_BUFFER_MS;
  });

  await processInParallel(subs, async (s) => {
    try {
      // Ставимо graceStartedAt=now і gracePeriodEndsAt=now+graceDays, щоб
      // expireGraceSubscriptions експайрав саме через graceDays після переходу,
      // а не одразу якщо cron пропустив день (Bug #8 fix).
      await prisma.yearlyProgramSubscription.update({
        where: { id: s.id },
        data: {
          status: 'GRACE',
          graceStartedAt: now,
          gracePeriodEndsAt,
        },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'grace_entered',
          message: `Moved to GRACE — expiresAt ${s.expiresAt?.toISOString().slice(0, 10)} · grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)}`,
        },
      });
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'active_to_grace', processed: subs.length, errors };
}

async function expireGraceSubscriptions(): Promise<StepResult> {
  const now = new Date();
  const graceDays = await getYearlyGraceDays(prisma);
  const graceCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
  const yearlySpCourseId = await getYearlySendpulseCourseId(prisma);
  const errors: string[] = [];

  // Семантика: експайраємо коли grace-період вже завершився (gracePeriodEndsAt <= now).
  // Beremo `lte` (не строго <), бо cron + transitionActiveToGrace стартують в одну й ту саму
  // годину — gracePeriodEndsAt = graceStartedAt + graceDays днів збігається з cron-«now»
  // на час закриття. Зі строгим `<` close спрацьовував би на день пізніше за очікуване.
  // Fallback для legacy-рядків (до міграції add_grace_period_ends_at) — старий фільтр по expiresAt.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      AND: [
        NOT_IN_UNLAUNCHED_COHORT,
        {
          OR: [
            { gracePeriodEndsAt: { lte: now } },
            { gracePeriodEndsAt: null, expiresAt: { lt: graceCutoff } },
          ],
        },
      ],
    },
    include: { user: true },
  });

  await processInParallel(subs, async (sub) => {
    try {
      // Закриваємо доступ у SendPulse (якщо можемо — є studentId і courseId).
      const courseId = yearlySpCourseId;
      let studentId = sub.sendpulseStudentId;

      // Знімаємо WFP-регулярки ДО будь-якого SendPulse-виклику — обидві SP-гілки нижче
      // (lookup-фейл і close-фейл) виходять через return без flip-у на EXPIRED, і без
      // цього підписка висіла б у GRACE з живим автосписанням (гроші йдуть, доступ
      // закривається). Повторний виклик завтра безпечний: «правило вже знято» (4102/4104)
      // рахується як успіх, а не помилка.
      const autopay = await removeSubscriptionAutopay(sub.id);
      await recordAutopayRemoveOutcome({ subscriptionId: sub.id, result: autopay, source: 'cron:expire-grace' });
      const wfpSummary = sub.plan === 'MONTHLY'
        ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
        : '';
      // Поля, які має отримати підписка разом із переходом у EXPIRED. autoRenew гасимо
      // завжди: доступ закритий, чекати списань більше нема сенсу, а живий прапорець
      // залишав підписку у звірках і листах як «автоплатіжну». `wfpRegularRef` чистимо
      // ЛИШЕ при успішному REMOVE — інакше це маркер для ретрай-кроку нижче.
      const autopayFields = {
        autoRenew: false,
        wfpNextChargeAt: null,
        ...(autopay.error ? {} : { wfpRegularRef: null }),
      };

      if (courseId && !studentId && sub.user?.email) {
        // Останній шанс знайти studentId
        try {
          studentId = await lookupStudentIdByEmail(courseId, sub.user.email);
          if (studentId) {
            await prisma.yearlyProgramSubscription.update({
              where: { id: sub.id },
              data: { sendpulseStudentId: studentId },
            });
          }
        } catch (e) {
          // Пошук ВПАВ (SP 5xx / timeout) — це не «студента немає», а «ми не знаємо».
          // Раніше ми йшли далі й позначали EXPIRED без реального закриття доступу:
          // 15 хвилин недоступності SP лишали людині безкоштовний доступ назавжди.
          // Тепер лишаємо підписку в GRACE і пробуємо завтра; подія — у «Помилках».
          const msg = (e as Error).message;
          errors.push(`${sub.id} lookup: ${msg}`);
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'access_close_failed',
              message: `Пошук studentId у SendPulse не вдався — доступ не закрито, статус лишається GRACE: ${msg.slice(0, 200)}${wfpSummary}`,
              metadata: {
                stage: 'lookup',
                courseId,
                error: msg.slice(0, 500),
                wfpRemovedCount: autopay.removed,
                wfpAttemptedCount: autopay.attempted,
                wfpError: autopay.error,
              },
            },
          }).catch(() => { /* лог не має валити крок */ });
          return;
        }
      }

      if (courseId && studentId) {
        try {
          await closeAccessInCourse(studentId, courseId);
          await prisma.yearlyProgramSubscription.update({
            where: { id: sub.id },
            data: {
              status: 'EXPIRED',
              sendpulseAccessClosedAt: new Date(),
              ...autopayFields,
            },
          });
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'access_closed',
              message: `SendPulse DELETE /students/${studentId}/${courseId}${wfpSummary}`,
              metadata: {
                // Доступ реально закритий у SendPulse — ця подія має право резолвити
                // SP_CLOSE_FAILED (на відміну від «локального EXPIRED» нижче).
                spClosed: true,
                wfpRemovedCount: autopay.removed,
                wfpAttemptedCount: autopay.attempted,
                wfpError: autopay.error,
              },
            },
          });
        } catch (e) {
          const msg = (e as Error).message;
          errors.push(`${sub.id} close: ${msg}`);
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'access_close_failed',
              message: `SendPulse DELETE /students/${studentId}/${courseId} не вдався — статус лишається GRACE: ${msg.slice(0, 200)}${wfpSummary}`,
              metadata: {
                stage: 'close',
                courseId,
                studentId,
                error: msg.slice(0, 500),
                wfpRemovedCount: autopay.removed,
                wfpAttemptedCount: autopay.attempted,
                wfpError: autopay.error,
              },
            },
          }).catch(() => { /* лог не має валити крок */ });
          // Не скидаємо на EXPIRED якщо не змогли закрити — спробуємо знову завтра.
          return;
        }
      } else {
        // Без courseId/studentId — позначаємо EXPIRED локально, але з поміткою.
        await prisma.yearlyProgramSubscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED', ...autopayFields },
        });
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            type: 'access_closed',
            message: (courseId
              ? 'Marked EXPIRED without SendPulse closure — studentId not found'
              : 'Marked EXPIRED locally — SENDPULSE_YEARLY_COURSE_ID not configured') + wfpSummary,
            metadata: {
              // ⚠️ Локальний EXPIRED БЕЗ реального закриття в SendPulse. Без цієї мітки
              // подія `access_closed` знімала critical SP_CLOSE_FAILED, хоча платний
              // доступ у SP лишився відкритим (див. classifyEvent у yearlyProgramIssues).
              spClosed: false,
              wfpRemovedCount: autopay.removed,
              wfpAttemptedCount: autopay.attempted,
              wfpError: autopay.error,
            },
          },
        });
      }

      // Доступ закрито → прибираємо студента з платного Telegram-каналу. Без цього
      // неплатник лишався в каналі назавжди (SP-доступ закритий, а контент у ТГ — ні).
      // Permanent: ban + відкликання invite, щоб не повернувся по збереженому лінку.
      // Best-effort — помилка не відкочує EXPIRED; сам kick пише подію в підписку.
      try {
        const kick = await kickSubscriptionFromChannel({
          subscriptionId: sub.id,
          mode: 'permanent',
          triggeredBy: 'cron:expire-grace',
        });
        if (!kick.ok && !kick.skipped) {
          errors.push(`${sub.id} tg_kick: ${(kick.error ?? 'unknown').slice(0, 120)}`);
        }
      } catch (e) {
        errors.push(`${sub.id} tg_kick: ${(e as Error).message.slice(0, 120)}`);
      }

      // Лист про закриття доступу (claim прапорця + відкат при недоставці — всередині helper-а).
      if (sub.user?.email) {
        const r = await sendReminderOnce({
          subscriptionId: sub.id,
          flag: 'reminderSentExpired',
          to: sub.user.email,
          render: () => accessClosed({ name: sub.user!.name }),
          eventType: 'reminder_expired',
        });
        if (r.outcome === 'failed') errors.push(`${sub.id} email_expired: ${r.error}`);
      }
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'expire_grace', processed: subs.length, errors };
}

/// «Оплатіть далі»-нагадування не мають сенсу для повністю оплаченої підписки
/// (усі СВОЇ модулі набору сплачені — її expiresAt це кінець пост-доступу, платити
/// нічого). Перевірка спільна для ВСІХ платіжних листів — і manual, і cyclical. Для
/// cyclical це критично: після останнього платежу WFP-правило знімається
/// (`wfpRegularRef` → null), тож `cyclicalNeedsWarning` вважав би таку підписку
/// «регулярка зникла» і слав би «списання не пройшло, оплатіть» людині, яка оплатила
/// все до копійки.
///
/// «Усі свої» — не завжди 9: пізній покупець стартує з пізнішого модуля набору і має
/// менше слотів (купив у жовтні → 8). Тому рахуємо через сітку `monthlySchedule`, а не
/// лічильником платежів.
function isFullyPaid(sub: ScheduleAwareSub): boolean {
  const schedule = subSchedule(sub);
  return schedule
    ? schedule.isFullyPaid
    : sub.payments.length >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
}

/// Мінімум даних для читання сітки модулів: межі набору + зараховані PAID-платежі.
/// Замінило `_count.payments` — самої кількості платежів для сітки не досить.
type ScheduleAwareSub = {
  cohort: { startDate: Date; endDate: Date } | null;
  payments: { amount: number; status: string; paidAt: Date | null; createdAt: Date; excludedFromAccess: boolean | null; manualMethod: string | null }[];
};

function subSchedule(sub: ScheduleAwareSub) {
  return sub.cohort ? monthlySchedule({ cohort: sub.cohort, payments: sub.payments }) : null;
}

const SCHEDULE_INCLUDE = {
  cohort: { select: { startDate: true, endDate: true } },
  payments: {
    // Орфанні списання (`excludedFromAccess`) не є сплаченим модулем — так само, як
    // у розрахунку доступу. Інакше одне зайве списання «закривало» б людині програму.
    where: { status: 'PAID' as const, excludedFromAccess: false },
    select: {
      amount: true, status: true, paidAt: true, createdAt: true,
      excludedFromAccess: true, manualMethod: true,
    },
    orderBy: [{ paidAt: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

/// Чи попереджати автоплатіжника (autoRenew=true), що доступ ось-ось закриється.
/// Дві причини для листа:
///   • `failedChargeCount > 0` — списання реально провалилось (картка/ліміт);
///   • `wfpRegularRef == null` — правила регулярки у WFP взагалі немає (зняли вручну,
///     не створилось при токенізації, підписку переносили). Списання не буде ніколи,
///     тому мовчати не можна: без цієї гілки людина втрачала доступ без жодного листа.
function cyclicalNeedsWarning(sub: { failedChargeCount: number | null; wfpRegularRef: string | null }): boolean {
  return (sub.failedChargeCount ?? 0) > 0 || sub.wfpRegularRef === null;
}

/// Тривалість grace, ЗАФІКСОВАНА в момент переходу ACTIVE→GRACE (gracePeriodEndsAt −
/// graceStartedAt). Увесь розклад листів усередині grace має рахуватись від неї, а не від
/// поточного `yearlyGraceDays` з налаштувань: інакше зміна налаштування посеред чужого
/// grace давала брехливі листи. Приклад (14 → 3): підписка увійшла в grace до 25.08,
/// менеджер міняє на 3 — і того ж вечора людина отримує «завтра закриваємо», хоча
/// у її записі стоїть 25.08 і закриття станеться саме тоді.
/// Fallback на поточне налаштування — лише для legacy-рядків без обох дат.
function storedGraceDays(
  sub: { graceStartedAt: Date | null; gracePeriodEndsAt: Date | null },
  fallback: number,
): number {
  if (!sub.graceStartedAt || !sub.gracePeriodEndsAt) return fallback;
  const days = Math.round((sub.gracePeriodEndsAt.getTime() - sub.graceStartedAt.getTime()) / DAY_MS);
  return days >= 1 ? days : fallback;
}

/// За скільки днів до автосписання клієнт отримує наше попередження.
/// 3 дні — щоб встиг написати нам і встигнути щось змінити (картка, дата, скасування)
/// ДО того, як WFP спише гроші: після списання це вже повернення коштів, а не правка.
const AUTOPAY_NOTICE_DAYS_BEFORE = 3;

/// AUTOPAY: «через 3 дні з картки спишеться N ₴». Тільки MONTHLY autoRenew=true ACTIVE.
///
/// Навіщо взагалі: досі єдиним попередженням про списання був технічний лист самого
/// WayForPay — з їхнім брендингом, службовою назвою товару і без жодного нашого контакту.
/// Клієнт бачив листа від невідомого сервісу і не мав куди відповісти. Тепер наш лист іде
/// першим і дає нормальний контекст + edu@uimp.com.ua.
///
/// Дедуп — НЕ boolean-прапорець, а дата у `autopayNoticeSentFor`: попередження
/// повторюється щомісяця, тож прапорець довелось би скидати після кожного списання
/// (ще одне місце, яке легко забути). Дата ж інвалідує себе сама, щойно WFP посуне
/// графік на наступний місяць. Claim атомарний (`updateMany` з умовою «дата ≠ цільова»),
/// тому паралельний ретрай cron-а другого листа не надішле.
async function sendAutopayPrechargeNotices(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const windowEnd = new Date(now.getTime() + AUTOPAY_NOTICE_DAYS_BEFORE * DAY_MS);
  // Нижня межа — початок сьогоднішньої доби, а не `now`: списання, призначене на сьогодні,
  // ще має сенс анонсувати («сьогодні спишеться»), а вчорашню дату — вже ні.
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: true,
      wfpNextChargeAt: { gte: todayStart, lte: windowEnd },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: {
      user: true,
      ...SCHEDULE_INCLUDE,
    },
  });
  if (subs.length === 0) return { step: 'autopay_precharge_notice', processed: 0, errors };

  const settings = await getYearlyProgramSettings(prisma);

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.wfpNextChargeAt) return;
      // 9/9 сплачено — правило регулярки має бути вже зняте (це робить крок
      // wfp_schedule_cache). Якщо кеш дати ще не оновився, попередження про десяте
      // списання лякало б людину неіснуючим платежем.
      if (isFullyPaid(sub)) return;

      const chargeAt = sub.wfpNextChargeAt;
      const target = new Date(Date.UTC(chargeAt.getUTCFullYear(), chargeAt.getUTCMonth(), chargeAt.getUTCDate()));
      const previous = sub.autopayNoticeSentFor;

      const claim = await prisma.yearlyProgramSubscription.updateMany({
        where: {
          id: sub.id,
          OR: [{ autopayNoticeSentFor: null }, { autopayNoticeSentFor: { not: target } }],
        },
        data: { autopayNoticeSentFor: target },
      });
      if (claim.count === 0) return;

      // Модуль, який покриє це списання: наступний після вже покритих.
      const schedule = subSchedule(sub);
      const nextModuleNumber = (schedule?.currentModuleNumber ?? sub.payments.length) + 1;
      const totalModules = sub.cohort ? cohortModuleCount(sub.cohort) : YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
      // Сума — з ОСТАННЬОГО реального WFP-списання (ручні рядки не еталон), прайс — fallback.
      const lastWfpAmount = [...sub.payments].reverse().find((pay) => pay.manualMethod === null)?.amount;
      const amount = lastWfpAmount ?? settings.monthlyPrice;
      let error: string | null = null;
      try {
        const res = await sendYearlyProgramUpcomingChargeEmail({
          to: sub.user.email,
          name: sub.user.name,
          amount,
          chargeAt,
          chargeProgress: { current: nextModuleNumber, total: totalModules },
        });
        if (!res.ok) error = res.error ?? 'send failed';
        // skipped=true → RESEND_API_KEY не заданий (або dev-гард). Це НЕ доставка:
        // без відкату claim-у лист «згорів» би назавжди — дата вже позначена як
        // попереджена, а людина нічого не отримала.
        else if (res.skipped) error = 'mailer_not_configured';
      } catch (e) {
        error = (e as Error).message;
      }

      if (error) {
        // Відкат claim-у на попереднє значення — завтрашній прохід спробує ще раз
        // (вікно відкрите на 3 доби, тож запас на кілька спроб є).
        await prisma.yearlyProgramSubscription.updateMany({
          where: { id: sub.id },
          data: { autopayNoticeSentFor: previous },
        });
        const since = new Date(Date.now() - FAILED_EVENT_DEDUP_MS);
        const recent = await prisma.yearlyProgramSubscriptionEvent.findFirst({
          where: {
            subscriptionId: sub.id,
            type: 'reminder_email_failed',
            createdAt: { gte: since },
            message: { startsWith: 'reminder_autopay_precharge ' },
          },
          select: { id: true },
        });
        if (!recent) {
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'reminder_email_failed',
              message: `reminder_autopay_precharge не надіслано: ${error.slice(0, 200)}`,
              metadata: { eventType: 'reminder_autopay_precharge', error: error.slice(0, 500) },
            },
          });
        }
        errors.push(`${sub.id}: ${error}`);
        return;
      }

      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'reminder_autopay_precharge',
          message: `Попередження про автосписання ${target.toISOString().slice(0, 10)} · ${amount} ₴ · модуль ${nextModuleNumber} з ${totalModules}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'autopay_precharge_notice', processed, errors };
}

/// MANUAL #1: за 3 дні до експайру. Тільки MANUAL (autoRenew=false) ACTIVE.
async function sendManualBeforeExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  // ВІДКРИТЕ вікно, не смуга [now+2d, now+3d). Жорстка смуга означала «лист має бути
  // надісланий рівно в цей добовий прохід»: один пропущений прогін cron-а (Vercel не
  // запустив, деплой, збій БД) — і лист не піде НІКОЛИ, бо завтра підписка з вікна
  // випадає. Від дублів захищає не вікно, а прапорець `reminderSent3d`: він claim-иться
  // атомарно перед відправкою, тож «перестигла» підписка отримає лист рівно один раз.
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { lte: windowEnd },
      reminderSent3d: false,
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...SCHEDULE_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.expiresAt) return;
      if (isFullyPaid(sub)) return;
      const expiresAt = sub.expiresAt;
      const r = await sendReminderOnce({
        subscriptionId: sub.id,
        flag: 'reminderSent3d',
        to: sub.user.email,
        render: () => manualBeforeExpiry({ name: sub.user!.name, expiresAt }),
        eventType: 'reminder_manual_before',
        eventMessage: `Manual 3d-before · expires ${expiresAt.toISOString().slice(0, 10)}`,
      });
      if (r.outcome === 'failed') errors.push(`${sub.id}: ${r.error}`);
      if (r.outcome === 'sent') processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'manual_before_expiry', processed, errors };
}

/// MANUAL #2: у день закінчення. Тільки MANUAL.
async function sendManualOnExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  // Верхня межа доби — київська, не UTC. З `setUTCHours(0)` доба різалась о 03:00 за
  // Києвом: підписка, що спливає 15.08 о 01:00 Kyiv (=14.08 22:00 UTC), рахувалась
  // «вчорашньою» і листа «сьогодні останній день» людина не отримувала взагалі.
  //
  // Нижньої межі свідомо НЕМАЄ (було `gte: startOfToday`): вікно в одну добу означало,
  // що пропущений прогін cron-а назавжди з'їдає цей лист. Дублі виключає прапорець
  // `reminderSentOnExpiry` (атомарний claim перед відправкою), а не вузьке вікно.
  const startOfTomorrow = kyivMidnightUtc(now, 1);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { lt: startOfTomorrow },
      reminderSentOnExpiry: false,
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...SCHEDULE_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email) return;
      if (isFullyPaid(sub)) return;
      const r = await sendReminderOnce({
        subscriptionId: sub.id,
        flag: 'reminderSentOnExpiry',
        to: sub.user.email,
        render: () => manualOnExpiry({ name: sub.user!.name }),
        eventType: 'reminder_manual_on_expiry',
        eventMessage: 'Manual on-expiry (last day)',
      });
      if (r.outcome === 'failed') errors.push(`${sub.id}: ${r.error}`);
      if (r.outcome === 'sent') processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'manual_on_expiry', processed, errors };
}

/// MANUAL #3 + CYCLICAL #1: день +1 після експайру.
/// Manual: "grace стартував". Cyclical: "charge failed" (тільки якщо є про що попереджати).
async function sendGraceStartReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  // Поточне значення graceDays — лише fallback для legacy-рядків без grace-дат. Для решти
  // у листі стоїть тривалість, зафіксована в момент переходу в GRACE (`storedGraceDays`),
  // щоб текст не суперечив реальній даті закриття.
  const graceDays = await getYearlyGraceDays(prisma);

  // «День +1»: не шлемо в тому ж проході, у якому підписка щойно перейшла в GRACE.
  // Інакше людина за секунди отримує два суперечливі листи — «сьогодні останній день
  // доступу» (manual_on_expiry) і одразу «пільговий період стартував». 20 годин, а не
  // 24 — щоб лист гарантовано пішов наступного добового проходу cron-а навіть якщо той
  // трохи «плаває» у часі.
  //
  // Виняток — короткий grace (graceDays < 3): mid/last там вимкнені, а закриття доступу
  // настане раніше за наступний добовий прохід, тож із затримкою лист не пішов би взагалі.
  // На такому налаштуванні шлемо одразу: краще двоє листів поспіль, ніж жодного попередження.
  const GRACE_START_MIN_AGE_MS = 20 * 60 * 60 * 1000;
  const graceStartCutoff = new Date(now.getTime() - GRACE_START_MIN_AGE_MS);

  // Гейт «день +1» застосовується per-subscription (за її власною тривалістю grace),
  // тому у вибірку беремо всіх, а відсіюємо в циклі.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceStart: false,
      gracePeriodEndsAt: { not: null },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...SCHEDULE_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
      const spanDays = storedGraceDays(sub, graceDays);
      // Короткий grace (<3 днів) — шлемо одразу, інакше лист не встиг би піти взагалі.
      if (spanDays >= 3 && sub.graceStartedAt && sub.graceStartedAt > graceStartCutoff) return;
      // Повністю оплачені (9/9) не отримують ЖОДНОГО платіжного нагадування — ні manual,
      // ні cyclical: платити нема за що, це просто кінець пост-доступу.
      if (isFullyPaid(sub)) return;
      // Для manual (autoRenew=false) — шлемо завжди (grace стартував).
      const isManual = !sub.autoRenew;
      if (!isManual && !cyclicalNeedsWarning(sub)) return;

      const gracePeriodEndsAt = sub.gracePeriodEndsAt;
      const r = await sendReminderOnce({
        subscriptionId: sub.id,
        flag: 'reminderSentGraceStart',
        to: sub.user.email,
        render: () => (isManual
          ? manualGraceStart({ name: sub.user!.name, gracePeriodEndsAt, graceDays: spanDays })
          : cyclicalChargeFailed1({ name: sub.user!.name, gracePeriodEndsAt, graceDays: spanDays })),
        eventType: isManual ? 'reminder_manual_grace_start' : 'reminder_cyclical_failed1',
        eventMessage: `Grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)}`,
      });
      if (r.outcome === 'failed') errors.push(`${sub.id}: ${r.error}`);
      if (r.outcome === 'sent') processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_start', processed, errors };
}

/// MID — день grace-періоду номер `midDay = ceil(graceDays/2)`.
/// Тригер: минуло щонайменше `midDay - 1` днів від graceStartedAt → сьогодні і є день номер midDay.
/// Спрацьовує тільки якщо graceDays ≥ 5 (інакше точка занадто близько до start/last → колізія).
/// Manual (autoRenew=false) і cyclical (autoRenew=true з failedChargeCount > 0) обробляються разом —
/// різні шаблони, спільне поле reminderSentGraceMid.
async function sendGraceMidReminders(): Promise<StepResult> {
  const graceDays = await getYearlyGraceDays(prisma);
  const errors: string[] = [];
  const now = new Date();

  // Поріг «≥5 днів» і точка midDay рахуються per-subscription від її ВЛАСНОЇ тривалості
  // grace (storedGraceDays) — вибірка тому широка, відсів у циклі.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceMid: false,
      graceStartedAt: { not: null },
      gracePeriodEndsAt: { not: null },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...SCHEDULE_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt || !sub.graceStartedAt) return;
      const spanDays = storedGraceDays(sub, graceDays);
      // <5 днів — проміжна точка занадто близько до start/last, шлемо тільки їх.
      if (spanDays < 5) return;
      const midDay = Math.ceil(spanDays / 2);
      // День +1 grace = graceStartedAt. Fire на день +midDay → має минути (midDay − 1) діб.
      if (now.getTime() < sub.graceStartedAt.getTime() + (midDay - 1) * DAY_MS) return;
      // 9/9 — платити нема за що, платіжні листи не шлемо нікому (див. isFullyPaid).
      if (isFullyPaid(sub)) return;
      const isManual = !sub.autoRenew;
      // Cyclical-mid — тільки коли є про що попереджати (провалене списання або зникле
      // WFP-правило); інакше підписка не в реальному grace-флоу autopay.
      if (!isManual && !cyclicalNeedsWarning(sub)) return;

      const gracePeriodEndsAt = sub.gracePeriodEndsAt;
      const r = await sendReminderOnce({
        subscriptionId: sub.id,
        flag: 'reminderSentGraceMid',
        to: sub.user.email,
        render: () => (isManual
          ? manualGraceMid({ name: sub.user!.name, gracePeriodEndsAt })
          : cyclicalGraceMid({ name: sub.user!.name, gracePeriodEndsAt })),
        eventType: isManual ? 'reminder_manual_grace_mid' : 'reminder_cyclical_grace_mid',
        eventMessage: `Grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)} · midDay=${midDay} · graceDays=${spanDays}`,
      });
      if (r.outcome === 'failed') errors.push(`${sub.id}: ${r.error}`);
      if (r.outcome === 'sent') processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_mid', processed, errors };
}

/// LAST — день grace-періоду номер `graceDays` (за день до закриття).
/// Тригер: минуло щонайменше `graceDays - 1` днів від graceStartedAt → сьогодні останній день grace
/// (закриття буде завтра в `expireGraceSubscriptions`). Спрацьовує тільки якщо graceDays ≥ 3 —
/// інакше колізія зі start (при graceDays=2 day-of-grace=2 = day закриття; при graceDays=1 — взагалі немає сенсу).
async function sendGraceLastReminders(): Promise<StepResult> {
  const graceDays = await getYearlyGraceDays(prisma);
  const errors: string[] = [];
  const now = new Date();

  // Як і в mid: поріг «≥3 днів» і точка «останній день» — від власної тривалості grace.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceLast: false,
      graceStartedAt: { not: null },
      // Safety: не шлемо «завтра закриваємо» якщо grace вже фактично завершився
      // (рідкісний edge — cron не запускався і експайр пропустили).
      gracePeriodEndsAt: { gt: now },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...SCHEDULE_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt || !sub.graceStartedAt) return;
      const spanDays = storedGraceDays(sub, graceDays);
      // <3 днів — «завтра закриваємо» дублювало б grace-start.
      if (spanDays < 3) return;
      // Fire на день +spanDays від graceStartedAt → має минути (spanDays − 1) діб.
      if (now.getTime() < sub.graceStartedAt.getTime() + (spanDays - 1) * DAY_MS) return;
      // 9/9 — платити нема за що, платіжні листи не шлемо нікому (див. isFullyPaid).
      if (isFullyPaid(sub)) return;
      const isManual = !sub.autoRenew;
      if (!isManual && !cyclicalNeedsWarning(sub)) return;

      const gracePeriodEndsAt = sub.gracePeriodEndsAt;
      const r = await sendReminderOnce({
        subscriptionId: sub.id,
        flag: 'reminderSentGraceLast',
        to: sub.user.email,
        render: () => (isManual
          ? manualGraceLast({ name: sub.user!.name, gracePeriodEndsAt })
          : cyclicalGraceLast({ name: sub.user!.name, gracePeriodEndsAt })),
        eventType: isManual ? 'reminder_manual_grace_last' : 'reminder_cyclical_grace_last',
        eventMessage: `Grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)} · graceDays=${spanDays}`,
      });
      if (r.outcome === 'failed') errors.push(`${sub.id}: ${r.error}`);
      if (r.outcome === 'sent') processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_last', processed, errors };
}

/// Тонкий враппер навколо shared `syncYearlyProgress` (lib/certificates/syncYearlyProgress.ts).
/// Логіка винесена щоб шарити її з manual-trigger ендпойнтом адмінки.
async function syncYearlyCourseProgress(): Promise<StepResult> {
  const result = await syncYearlyProgress();
  return {
    step: 'sync_progress',
    processed: result.processed,
    errors: result.errors,
    ...(result.studentIdsFilled ? { info: `studentIdsFilled=${result.studentIdsFilled}` } : {}),
  };
}

/// Скільки підписок максимум добиваємо ретраєм REMOVE за один прохід — щоб крок не з'їв
/// бюджет maxDuration (кожна підписка = 1 HTTP-виклик на кожен її WFP-платіж).
const AUTOPAY_RETRY_BATCH = 25;

/// Вікно і стеля вибірки подій REMOVE (див. `retryAutopayRemoval`). 90 днів із запасом
/// перекривають будь-який живий кейс: те, що не зняли за квартал, знімається руками.
const REMOVE_EVENT_WINDOW_MS = 90 * DAY_MS;
const REMOVE_EVENT_MAX_ROWS = 2000;

/// Ретрай зняття WFP-регулярки для підписок, які вже НЕ мають отримувати списань:
/// закриті (CANCELLED / EXPIRED / ARCHIVED), переведені на Річний план, або живі
/// місячні, яким автоплатіж вимикали (autoRenew=false), а REMOVE тоді провалився.
///
/// Навіщо окремий крок: REMOVE у момент дії (скасування, закриття доступу, конверсія)
/// міг не пройти — WFP лежав, таймаут, не налаштований merchantPassword. Раніше після
/// такої невдачі не повторював ніхто: правило лишалось живим, і картку студента
/// списували за доступ, якого вже немає.
///
/// Кандидат — підписка з ознакою «правило могло лишитись»:
///   • `wfpRegularRef != null` (кеш знає живе правило), АБО
///   • остання подія про REMOVE = провал (`wfp_remove_failed` новіша за `wfp_remove_succeeded`).
/// Успіх чистить кеш і пише подію (вона ж резолвить issue). Провал пише подію з лічильником
/// спроб поспіль — з третьої вона піднімається у вкладку «Помилки» (WFP_REMOVE_FAILED).
async function retryAutopayRemoval(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];

  // Останній результат REMOVE по кожній підписці. Вибірку обмежуємо вікном і стелею:
  // подій цих типів у нормі одиниці, але «вічно провальна» підписка генерує по одній
  // щоночі, тож без take/датного фільтра запит із часом читав би всю історію.
  const removeEvents = await prisma.yearlyProgramSubscriptionEvent.findMany({
    where: {
      type: { in: [WFP_REMOVE_FAILED_EVENT, WFP_REMOVE_SUCCEEDED_EVENT] },
      createdAt: { gte: new Date(Date.now() - REMOVE_EVENT_WINDOW_MS) },
    },
    select: { subscriptionId: true, type: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: REMOVE_EVENT_MAX_ROWS,
  });
  const lastOutcome = new Map<string, { type: string; streak: number }>();
  for (const e of removeEvents) {
    if (lastOutcome.has(e.subscriptionId)) continue;
    const meta = (e.metadata ?? null) as { consecutiveFailures?: number } | null;
    const streak = typeof meta?.consecutiveFailures === 'number' ? meta.consecutiveFailures : 1;
    lastOutcome.set(e.subscriptionId, { type: e.type, streak });
  }
  const failedEntries = [...lastOutcome.entries()].filter(([, v]) => v.type === WFP_REMOVE_FAILED_EVENT);
  const failedIds = failedEntries.map(([id]) => id);
  // Poison-pill: підписки, де REMOVE провалюється стабільно (streak ≥ порогу) уже висять
  // критичним issue WFP_REMOVE_FAILED і чекають ручного зняття правила в кабінеті WFP.
  // Тримати їх у денній вибірці шкідливо: сортування за updatedAt ставить їх на початок,
  // вони щоночі з'їдають увесь батч і блокують нові, ще виправні випадки (head-of-line).
  const poisonIds = failedEntries
    .filter(([, v]) => v.streak >= WFP_REMOVE_ISSUE_THRESHOLD)
    .map(([id]) => id);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      OR: [
        { status: { in: ['CANCELLED', 'EXPIRED', 'ARCHIVED'] } },
        { plan: 'YEARLY' },
        // Downgrade «автоплатіж → разова»: підписка лишається ЖИВОЮ (ACTIVE MONTHLY),
        // але з autoRenew=false списувати вже не можна. Якщо REMOVE у момент downgrade-у
        // не пройшов (WFP лежав, таймаут), правило живе далі — а стара вибірка бачила
        // тільки закриті підписки і YEARLY, тож ретрай для таких не запускався НІКОЛИ:
        // картку студента списували за підписку, яку він з автоплатежу вже зняв.
        //
        // Умова свідомо ВУЖЧА за «будь-яка MONTHLY з autoRenew=false і живим ref»:
        // сам прапорець `autoRenew` може брехати (inconclusive-probe у callback-у,
        // ручна правка), і зняти по ньому чужу робочу регулярку означало б обірвати
        // оплати клієнту, який нічого не скасовував. Тому беремо лише тих, кому REMOVE
        // уже РОБИЛИ і він провалився — тут намір зняти правило зафіксований подією.
        ...(failedIds.length > 0
          ? [{ plan: 'MONTHLY' as const, autoRenew: false, id: { in: failedIds } }]
          : []),
      ],
      AND: [
        {
          OR: [
            { wfpRegularRef: { not: null } },
            ...(failedIds.length > 0 ? [{ id: { in: failedIds } }] : []),
          ],
        },
        ...(poisonIds.length > 0 ? [{ id: { notIn: poisonIds } }] : []),
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: AUTOPAY_RETRY_BATCH,
  });
  const poisonInfo = poisonIds.length > 0
    ? `пропущено ${poisonIds.length} з ≥${WFP_REMOVE_ISSUE_THRESHOLD} провалами поспіль — вони у «Помилках» (WFP_REMOVE_FAILED)`
    : null;
  if (subs.length === 0) {
    return { step: 'retry_autopay_remove', processed: 0, errors, ...(poisonInfo ? { info: poisonInfo } : {}) };
  }

  let processed = 0;
  let deadlineHit = false;
  for (const s of subs) {
    // Кожна підписка — HTTP-виклик у WFP на кожен її платіж. Дотягнути до кінця важливо
    // менше, ніж лишити час на push_critical_issues: недознятий REMOVE повториться завтра.
    if (Date.now() >= cronDeadlineAt) {
      deadlineHit = true;
      break;
    }
    try {
      // force: план уже міг стати YEARLY (конверсія) — без нього helper вийшов би no-op
      // саме там, де правило найімовірніше й лишилось живим.
      const result = await removeSubscriptionAutopay(s.id, { force: true });
      const { consecutiveFailures } = await recordAutopayRemoveOutcome({
        subscriptionId: s.id,
        result,
        source: 'cron:retry-autopay-remove',
      });
      if (result.error) {
        errors.push(`${s.id}: спроба ${consecutiveFailures} · ${result.error.slice(0, 160)}`);
        continue;
      }
      // Помилок немає (зняли або правила й не було) — кеш більше не має тримати ref.
      await prisma.yearlyProgramSubscription.update({
        where: { id: s.id },
        data: { wfpRegularRef: null, wfpNextChargeAt: null, wfpScheduleCheckedAt: new Date() },
      });
      processed++;
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  const infoParts = [
    deadlineHit ? 'бюджет проходу вичерпано — решта наступним проходом' : null,
    subs.length === AUTOPAY_RETRY_BATCH ? `batch cap ${AUTOPAY_RETRY_BATCH} — решта наступним проходом` : null,
    poisonInfo,
  ].filter(Boolean);
  return {
    step: 'retry_autopay_remove',
    processed,
    errors,
    ...(infoParts.length > 0 ? { info: infoParts.join(' · ') } : {}),
  };
}

/// Push критичних issue-ів менеджерам (email + Telegram) — раз на добу, з дедупом.
/// Уся логіка вибору/дедупу — в `lib/yearlyProgramIssueAlerts.ts`; тут лише виклик і звіт.
async function pushCriticalIssues(): Promise<StepResult> {
  const { alertCriticalYearlyIssues } = await import('@/lib/yearlyProgramIssueAlerts');
  const r = await alertCriticalYearlyIssues();
  return {
    step: 'push_critical_issues',
    processed: r.fresh,
    errors: r.errors,
    info: `active=${r.candidates} · fresh=${r.fresh} · cleared=${r.cleared} · email ${r.emailsSent}/${r.recipients}`
      + (r.emailsSkipped > 0 ? ` · mailer_off=${r.emailsSkipped}` : '')
      + ` · tg ${r.telegramSent}`,
  };
}

/// Щоденна звірка кешу «Наступний платіж» з WFP (regularApi STATUS, БЕЗ CHANGE).
/// Оновлює wfpNextChargeAt/wfpScheduleCheckedAt для всіх автоплатіжних ACTIVE/GRACE —
/// колонка в адмінці завжди показує реальний графік WFP, розбіжність із «Доступ до»
/// видно оком. Помилки конкретних підписок не зупиняють решту.
async function refreshWfpScheduleCache(cronDeadlineAt: number): Promise<StepResult> {
  const errors: string[] = [];
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      plan: 'MONTHLY',
      autoRenew: true,
      status: { in: ['ACTIVE', 'GRACE'] },
    },
    select: { id: true },
  });

  let processed = 0;
  /// Правило у WFP є, але не Active (Suspended/Paused). Не помилка проходу — але й не
  /// «все гаразд»: підписка вже висить у «Помилках» (WFP_RULE_NOT_ACTIVE), а тут лише
  /// показуємо лічильник, щоб це було видно у відповіді cron-а.
  let inactiveRules = 0;
  let driftDetected = 0;
  /// Звірка — читаюча і повністю відкладна: пропущені сьогодні підписки перевіряться
  /// завтра. Тому вона перша поступається часом, коли глобальний дедлайн близько.
  let skippedByDeadline = 0;
  await processInParallel(subs, async (s) => {
    if (Date.now() >= cronDeadlineAt) {
      skippedByDeadline++;
      return;
    }
    try {
      const r = await syncAutopaySchedule(s.id, { apply: false, source: 'cron_check' });
      // Підписка оплачена повністю (9/9), а правило регулярки у WFP усе ще живе — тобто
      // REMOVE у callback-у не пройшов. Читаюча звірка сама нічого не змінює, тому одразу
      // добиваємо знімальним викликом: інакше WFP спише 10-й місяць (orphan charge), і
      // розбиратись довелось би поверненням коштів.
      if (r.outcome === 'checked' && r.reason === 'fully_paid_rule_still_active') {
        const applied = await syncAutopaySchedule(s.id, { apply: true, source: 'cron_fully_paid_remove' });
        if (applied.outcome === 'error') {
          errors.push(`${s.id} fully_paid REMOVE: ${(applied.reason ?? 'unknown').slice(0, 120)}`);
          // Провал REMOVE має бути видимим окремим типом події — інакше ретрай-крок
          // (він шукає підписки з останньою невдалою спробою) і вкладка «Помилки»
          // цього кейсу не побачать: syncAutopaySchedule уже занулив wfpRegularRef.
          await recordAutopayRemoveOutcome({
            subscriptionId: s.id,
            result: { removed: 0, attempted: 1, error: (applied.reason ?? 'unknown').slice(0, 300) },
            source: 'cron:fully_paid_remove',
          });
        } else {
          processed++;
        }
        return;
      }
      if (r.outcome === 'error') {
        errors.push(`${s.id}: ${r.reason ?? 'unknown'}`);
      } else {
        if (r.outcome === 'rule_inactive') inactiveRules++;
        if (r.outcome === 'checked' && r.reason === 'drift_detected') driftDetected++;
        processed++;
      }
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message.slice(0, 120)}`);
    }
  });

  const infoParts = [
    inactiveRules > 0 ? `правил не в статусі Active: ${inactiveRules}` : null,
    driftDetected > 0 ? `розбіжність графіка: ${driftDetected}` : null,
  ].filter(Boolean);
  return {
    step: 'wfp_schedule_cache',
    processed,
    errors,
    ...(infoParts.length > 0 || skippedByDeadline > 0
      ? {
          info: [
            ...(infoParts.length > 0 ? [`${infoParts.join(' · ')} — деталі у «Помилках»`] : []),
            ...(skippedByDeadline > 0 ? [`бюджет проходу вичерпано — не звірено ${skippedByDeadline}, звірка наступним проходом`] : []),
          ].join(' · '),
        }
      : {}),
  };
}
