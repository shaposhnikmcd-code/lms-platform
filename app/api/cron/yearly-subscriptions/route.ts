import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getYearlyGraceDays, getYearlySendpulseCourseId, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import {
  closeAccessInCourse,
  lookupStudentIdByEmail,
} from '@/lib/sendpulse';
import { removeSubscriptionAutopay } from '@/lib/yearlyProgramAutopay';
import { syncYearlyProgress } from '@/lib/certificates/syncYearlyProgress';
import { verifyBearer } from '@/lib/authTiming';
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

/// Скільки підписок максимум лікуємо за один прохід heal_unopened — щоб крок не з'їв
/// увесь бюджет maxDuration (300с на 13 кроків) і не заблокував решту. Залишок підбереться завтра.
const HEAL_UNOPENED_BATCH = 15;

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
/// — Шле нагадування за адаптивним розкладом, що залежить від `graceDays` із налаштувань
///   (`yearlyGraceDays` в `AppSetting`, редагується з адмінки — тому кількість днів ніде
///   не хардкодиться, а mid/last вмикаються лише за достатньої тривалості):
///   MANUAL (разова оплата, autoRenew=false):
///     за 3 дні до закінчення → у день закінчення → grace-start → mid (≥5д) → last (≥3д) → закриття
///   CYCLICAL (автоплатіж) — коли є про що попереджати, тобто списання провалилось
///   АБО правила регулярки у WFP немає взагалі (див. `cyclicalNeedsWarning`):
///     grace-start → mid (≥5д) → last (≥3д) → закриття
///
/// Порядок кроків у GET нижче не випадковий: обидва manual-нагадування йдуть ДО переходу
/// в GRACE (інакше лист «сьогодні останній день» не міг би піти), а grace-start має
/// 20-годинний гейт — тобто виходить наступним добовим проходом, а не в тому ж, у якому
/// підписка щойно потрапила в GRACE. Виняток — короткий grace (<3 днів), там лист іде одразу.
/// Повністю оплачені підписки (9/9) з усіх платіжних нагадувань виключені (`isFullyPaid`).
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StepResult[] = [];

  results.push(await runStep('runScheduledCohortLaunches', runScheduledCohortLaunches));
  results.push(await runStep('heal_unopened', healUnopenedAccess));
  results.push(await runStep('archive_stale_pending', archiveStalePending));
  // ВАЖЛИВО: обидва manual-нагадування йдуть ДО transitionActiveToGrace. Вони шукають
  // підписки в статусі ACTIVE, а grace-перехід у той самий прохід забирає з ACTIVE усе,
  // що протермінувалось — при зворотному порядку лист «сьогодні останній день» не міг
  // піти взагалі (підписка вже була в GRACE).
  results.push(await runStep('manual_before_expiry', sendManualBeforeExpiryReminders));
  results.push(await runStep('manual_on_expiry', sendManualOnExpiryReminders));
  results.push(await runStep('active_to_grace', transitionActiveToGrace));
  results.push(await runStep('expire_grace', expireGraceSubscriptions));
  results.push(await runStep('grace_start', sendGraceStartReminders));
  results.push(await runStep('grace_mid', sendGraceMidReminders));
  results.push(await runStep('grace_last', sendGraceLastReminders));
  results.push(await runStep('sendScheduledCohortLaunchEmails', sendScheduledCohortLaunchEmails));
  results.push(await runStep('sync_progress', syncYearlyCourseProgress));
  results.push(await runStep('wfp_schedule_cache', refreshWfpScheduleCache));

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
async function runScheduledCohortLaunches(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      launchScheduledFor: { lte: now },
      launchedAt: null,
    },
    select: { id: true, name: true, startDate: true, endDate: true, launchScheduledFor: true },
  });
  if (cohorts.length === 0) return { step: 'runScheduledCohortLaunches', processed: 0, errors };

  const { executeLaunchLoop } = await import('@/lib/yearlyProgramLaunch');

  let processed = 0;
  for (const c of cohorts) {
    try {
      // Атомарний claim, аналогічно до launch-route — захищає від паралельного запуску.
      const claim = await prisma.yearlyProgramCohort.updateMany({
        where: { id: c.id, launchedAt: null },
        data: { launchedAt: now, launchScheduledFor: null },
      });
      if (claim.count === 0) continue; // інший процес уже claim-ив

      const summary = await executeLaunchLoop(
        { id: c.id, startDate: c.startDate, endDate: c.endDate },
        'scheduled-cron',
      );
      processed++;
      if (summary.failed > 0) {
        errors.push(`${c.name}: ${summary.failed}/${summary.total} failed`);
      }
    } catch (e) {
      errors.push(`cohort ${c.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return { step: 'runScheduledCohortLaunches', processed, errors };
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
async function healUnopenedAccess(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      sendpulseAccessOpenedAt: null,
      OR: [
        { status: { in: ['ACTIVE', 'GRACE'] } },
        { status: 'PENDING', expiresAt: { gte: now } },
      ],
      cohort: { launchedAt: { not: null }, endDate: { gte: now } },
      payments: { some: { status: 'PAID' } },
    },
    select: {
      id: true,
      telegramUsername: true,
      telegramInviteLink: true,
      telegramInvitedAt: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: HEAL_UNOPENED_BATCH,
  });
  if (subs.length === 0) return { step: 'heal_unopened', processed: 0, errors };

  const { runExtraLaunchForSubscription } = await import('@/lib/yearlyProgramLaunch');

  // Налаштування каналу однакові для всього проходу — читаємо один раз.
  let tgSettings: Awaited<ReturnType<typeof getYearlyProgramTelegramSettings>> | null = null;
  try {
    tgSettings = await getYearlyProgramTelegramSettings();
  } catch (e) {
    errors.push(`telegram_settings: ${(e as Error).message.slice(0, 200)}`);
  }

  let processed = 0;
  for (const s of subs) {
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

  return { step: 'heal_unopened', processed, errors };
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
async function sendScheduledCohortLaunchEmails(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
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
  for (const cohort of cohorts) {
    try {
      const summary = await sendCohortLaunchEmails(cohort, {
        actorLabel: 'scheduled-cron',
        source: 'cron',
      });
      processed += summary.sent;
      if (summary.failed > 0) {
        errors.push(`${cohort.name}: ${summary.failed}/${summary.total} failed`);
      }
    } catch (e) {
      errors.push(`cohort ${cohort.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return { step: 'sendScheduledCohortLaunchEmails', processed, errors };
}

/// Авто-архів покинутих чекаутів: PENDING без жодної успішної оплати, старші за 24 год.
/// Це незавершені спроби (закрив форму / картку відхилили й не повернувся) — не клієнти,
/// лише засмічують список. Переводимо в ARCHIVED (зникає з дефолтного вигляду Річної,
/// лишається доступним через фільтр «Архів»). Guard payments.none(PAID) у updateMany —
/// захист від рейсу: якщо людина встигла оплатити саме в цей момент, підписку не чіпаємо.
///
/// ВАЖЛИВО: ручно додані студенти (manuallyAddedAt != null) НЕ архівуються — менеджер
/// свідомо завів їх у статусі «Очікує» і може підтверджувати оплату (готівка/переказ/ФОП)
/// будь-коли пізніше. Без цього винятку студент зник би в архів через добу.
///
/// Це safety net для тих, хто так і не оплатив. Дублі-спроби клієнтів, які ВЖЕ оплатили,
/// архівуються одразу в момент успішного платежу — `archiveDuplicatePendingSubscriptions`
/// (lib/yearlyProgramDedup.ts) з WFP-callback-у, без очікування доби.
async function archiveStalePending(): Promise<StepResult> {
  const errors: string[] = [];
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
      payments: { none: { status: 'PAID' } },
      manuallyAddedAt: null,
    },
    select: { id: true },
  });

  let processed = 0;
  await processInParallel(subs, async (s) => {
    try {
      const res = await prisma.yearlyProgramSubscription.updateMany({
        where: { id: s.id, status: 'PENDING', payments: { none: { status: 'PAID' } }, manuallyAddedAt: null },
        data: { status: 'ARCHIVED' },
      });
      if (res.count === 0) return; // встигли оплатити між вибіркою й апдейтом — не чіпаємо
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'admin_action',
          message: 'Авто-архів: незавершена спроба оплати без оплати понад 24 год',
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
  const gracePeriodEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
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
      const wfpSummary = sub.plan === 'MONTHLY'
        ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
        : '';

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
            },
          });
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'access_closed',
              message: `SendPulse DELETE /students/${studentId}/${courseId}${wfpSummary}`,
              metadata: {
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
          data: { status: 'EXPIRED' },
        });
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            type: 'access_closed',
            message: (courseId
              ? 'Marked EXPIRED without SendPulse closure — studentId not found'
              : 'Marked EXPIRED locally — SENDPULSE_YEARLY_COURSE_ID not configured') + wfpSummary,
            metadata: {
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
/// (усі 9/9 внесків зроблені — її expiresAt це кінець пост-доступу, платити нічого).
/// Перевірка спільна для ВСІХ платіжних листів — і manual, і cyclical. Для cyclical це
/// критично: після 9-го платежу WFP-правило знімається (`wfpRegularRef` → null), тож
/// `cyclicalNeedsWarning` вважав би таку підписку «регулярка зникла» і слав би
/// «списання не пройшло, оплатіть» людині, яка оплатила все до копійки.
function isFullyPaid(sub: { _count: { payments: number } }): boolean {
  return sub._count.payments >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
}

const PAID_COUNT_INCLUDE = {
  _count: { select: { payments: { where: { status: 'PAID' as const } } } },
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

/// MANUAL #1: за 3 дні до експайру. Тільки MANUAL (autoRenew=false) ACTIVE.
async function sendManualBeforeExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { gte: windowStart, lt: windowEnd },
      reminderSent3d: false,
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...PAID_COUNT_INCLUDE },
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
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { gte: startOfToday, lt: startOfTomorrow },
      reminderSentOnExpiry: false,
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...PAID_COUNT_INCLUDE },
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
  // Поточне значення graceDays із налаштувань — передаємо у render-функції, щоб тексти
  // листів автоматично відображали актуальну тривалість пільгового періоду.
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
  const applyAgeGate = graceDays >= 3;
  const graceStartCutoff = new Date(now.getTime() - GRACE_START_MIN_AGE_MS);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceStart: false,
      gracePeriodEndsAt: { not: null },
      ...(applyAgeGate ? { graceStartedAt: { lte: graceStartCutoff } } : {}),
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...PAID_COUNT_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
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
          ? manualGraceStart({ name: sub.user!.name, gracePeriodEndsAt, graceDays })
          : cyclicalChargeFailed1({ name: sub.user!.name, gracePeriodEndsAt, graceDays })),
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
  if (graceDays < 5) {
    return { step: 'grace_mid', processed: 0, errors: [] };
  }
  const errors: string[] = [];
  const now = new Date();
  const midDay = Math.ceil(graceDays / 2);
  // День +1 grace = graceStartedAt. Хочемо fire на день +midDay → потрібно щоб минуло (midDay - 1) діб.
  // Беремо <= щоб точка-в-точку співпадіння теж тригерило (cron + transitionActiveToGrace на одній годині).
  const cutoff = new Date(now.getTime() - (midDay - 1) * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceMid: false,
      graceStartedAt: { lte: cutoff },
      gracePeriodEndsAt: { not: null },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...PAID_COUNT_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
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
        eventMessage: `Grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)} · midDay=${midDay} · graceDays=${graceDays}`,
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
  if (graceDays < 3) {
    return { step: 'grace_last', processed: 0, errors: [] };
  }
  const errors: string[] = [];
  const now = new Date();
  // Той самий принцип, що й у mid — fire на день +graceDays від graceStartedAt.
  const cutoff = new Date(now.getTime() - (graceDays - 1) * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceLast: false,
      graceStartedAt: { lte: cutoff },
      // Safety: не шлемо «завтра закриваємо» якщо grace вже фактично завершився
      // (рідкісний edge — cron не запускався і експайр пропустили).
      gracePeriodEndsAt: { gt: now },
      ...NOT_IN_UNLAUNCHED_COHORT,
    },
    include: { user: true, ...PAID_COUNT_INCLUDE },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
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
        eventMessage: `Grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)} · graceDays=${graceDays}`,
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

/// Щоденна звірка кешу «Наступний платіж» з WFP (regularApi STATUS, БЕЗ CHANGE).
/// Оновлює wfpNextChargeAt/wfpScheduleCheckedAt для всіх автоплатіжних ACTIVE/GRACE —
/// колонка в адмінці завжди показує реальний графік WFP, розбіжність із «Доступ до»
/// видно оком. Помилки конкретних підписок не зупиняють решту.
async function refreshWfpScheduleCache(): Promise<StepResult> {
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
  await processInParallel(subs, async (s) => {
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
        } else {
          processed++;
        }
        return;
      }
      if (r.outcome === 'error') {
        errors.push(`${s.id}: ${r.reason ?? 'unknown'}`);
      } else {
        processed++;
      }
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message.slice(0, 120)}`);
    }
  });

  return { step: 'wfp_schedule_cache', processed, errors };
}
