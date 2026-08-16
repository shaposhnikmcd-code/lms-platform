import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { openAccessViaEvent, lookupStudentIdByEmail, withSendpulseRosterCache } from '@/lib/sendpulse';
import { YEARLY_PROGRAM_CONFIG, getYearlyPostAccessMonths, getYearlySendpulseCourseId, RESET_REMINDER_AND_GRACE_FIELDS } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';
import { renderTelegramInviteEmailBlock } from '@/lib/yearlyProgramTelegram';

/// Спільна логіка "запустити cohort": викликається з адмінки (POST .../launch) і з cron-у
/// (для cohort-ів зі `launchScheduledFor` у минулому). Приймає cohort, який ВЖЕ має
/// `launchedAt` (тобто claim або cron вже виставили цю дату). Виконує SendPulse +
/// перерахунок expiresAt + лог events.
///
/// Idempotent: для підписок, у яких `sendpulseAccessOpenedAt` вже виставлений, пропускає
/// SendPulse-виклик (тільки оновлює статус та expiresAt).
///
/// Класифікація результату:
///   accessOpened=true                   → opened
///   accessOpened=false + skipReason     → skipped (очікуваний пропуск, не помилка)
///   accessOpened=false + error          → failed (справжній збій SP/мережі)
export type LaunchSkipReason = 'no_paid_payments' | 'pending_access_expired' | 'already_opened';

/// Єдиний предикат «підписка отримає доступ на запуску» — дзеркало guard-ів у циклі
/// нижче (`no_paid_payments` + `pending_access_expired`). Лічильники адмінки будують
/// свій запит ЗВІДСИ, а не копіюють умови: інакше «Відкриє доступ для N» знову розійдеться
/// з тим, що цикл робить насправді.
export function launchEligibleSubscriptionWhere(now: Date = new Date()): Prisma.YearlyProgramSubscriptionWhereInput {
  return {
    // Хоч одна оплата, ЗАРАХОВАНА в доступ. Виключені списання (orphan, понад ліміт,
    // розбіжність суми) не є сплаченим місяцем — і для guard-а теж не рахуються.
    payments: { some: { status: 'PAID', excludedFromAccess: false } },
    OR: [
      { status: { in: ['ACTIVE', 'GRACE'] } },
      // PENDING зі старими PAID, але вичерпаним доступом — залишок минулого циклу,
      // а не оплачений цикл. Той самий критерій, що в heal-cron-і.
      { status: 'PENDING', expiresAt: { gte: now } },
    ],
  };
}

/// Предикат «підписка ще чекає відкриття доступу»: launch-eligible, `sendpulseAccessOpenedAt`
/// порожній і набір ЩЕ НЕ завершився. Останнє — симетрично з heal-cron-ом: на торішньому
/// наборі ніхто вже нічого не відкриває, тож вічна кнопка «Повторити запуск (1)» на ньому
/// була б неправдою.
function pendingLaunchAccessWhere(now: Date = new Date()): Prisma.YearlyProgramSubscriptionWhereInput {
  return {
    ...launchEligibleSubscriptionWhere(now),
    sendpulseAccessOpenedAt: null,
    cohort: { endDate: { gte: now } },
  };
}

/// Скільки підписок кожного набору ще ЧЕКАЮТЬ відкриття доступу. Це й число для модалки
/// запуску («Відкриє доступ для N»), і умова видимості кнопки «Повторити запуск» після
/// перезавантаження сторінки.
/// Перенесені з минулого набору (SP-доступ відкритий торік) сюди не входять — їм цикл
/// лише перерахує `expiresAt`, нічого не відкриваючи.
export async function countPendingLaunchAccessByCohort(): Promise<Map<string, number>> {
  const rows = await prisma.yearlyProgramSubscription.findMany({
    where: {
      ...pendingLaunchAccessWhere(),
      cohortId: { not: null },
    },
    select: { cohortId: true },
  });
  const byCohort = new Map<string, number>();
  for (const r of rows) {
    if (!r.cohortId) continue;
    byCohort.set(r.cohortId, (byCohort.get(r.cohortId) ?? 0) + 1);
  }
  return byCohort;
}

/// Те саме число, але для ОДНОГО набору — свіжий стан після циклу запуску. Сервер рахує
/// його сам і віддає клієнту (`pendingAccessAfter`): фронт не має права віднімати
/// `opened` від старого лічильника, бо це різні популяції (перенесені студенти входять
/// в `opened`, але не в лічильник; підписки без email — навпаки).
export async function countPendingLaunchAccessForCohort(cohortId: string): Promise<number> {
  return prisma.yearlyProgramSubscription.count({
    where: { ...pendingLaunchAccessWhere(), cohortId },
  });
}

/// Статуси, для яких відкривати доступ не можна ЖОДНИМ шляхом: підписку закрито
/// адміністративно або вона вичерпалась. Старі PAID-платежі в такої підписки лишаються,
/// тож без цього guard-а прямий POST на extra-launch «воскрешав» би її в ACTIVE.
const ACCESS_BLOCKED_STATUSES = ['ARCHIVED', 'CANCELLED', 'EXPIRED'];

export interface LaunchResult {
  subscriptionId: string;
  email: string;
  accessOpened: boolean;
  expiresAt: string | null;
  /// Set коли підписку свідомо пропустили (не платив, нема email тощо).
  /// Не вважається помилкою — окремий counter `skipped` у summary.
  skipReason?: LaunchSkipReason;
  /// Set коли стався справжній збій (SP API down, мережа). Counter `failed`.
  error?: string;
  /// Ітерація впала непередбачувано (БД недоступна, unique-конфлікт тощо) і була проковтнута
  /// per-subscription catch-ем, щоб не зривати решту запуску. Такі теж рахуються у `failed`.
  crashed?: true;
}

export interface LaunchSummary {
  total: number;
  opened: number;
  /// Свідомо пропущені (нема оплати). НЕ збільшує `failed` — це expected behaviour.
  skipped: number;
  failed: number;
  results: LaunchResult[];
  /// Підписки, на яких ітерація впала з винятком. Порожньо у нормальному запуску.
  /// Менеджеру видно, кого добирати руками (або чекати нічний heal_unopened).
  crashed: Array<{ subscriptionId: string; email: string | null; error: string }>;
  /// Цикл зупинено штатно за м'яким дедлайном (не вистачило ліміту функції). Оброблені
  /// підписки збережені, решту добирає «Повторити запуск» або нічний heal_unopened.
  /// `remaining` — скільки підписок реально пішли б у роботу (без тих, кого guard-и
  /// все одно пропустили б), а не скільки рядків лишилось необійденими.
  interrupted?: { reason: 'deadline'; remaining: number };
}

export async function executeLaunchLoop(
  cohort: { id: string; startDate: Date; endDate: Date; launchedAt?: Date | null },
  actorLabel: string,
  options: {
    /// М'який дедлайн: коли час вийшов, цикл переривається ШТАТНО і віддає partial-summary.
    /// Без нього платформа рубає функцію по `maxDuration` посеред роботи — `launchedAt` уже
    /// claim-нутий, менеджер не бачить ні прогресу, ні того, кого не встигли обробити.
    deadlineAt?: Date | null;
  } = {},
): Promise<LaunchSummary> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { id: true, email: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
    },
  });

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const yearlySpCourseId = await getYearlySendpulseCourseId(prisma);
  // Ціна плану, а НЕ сума першого платежу: перенесення з минулого набору лежить як 0 ₴,
  // адмін-тести — як 1-2 ₴, і саме це число потрапляло в угоду SP-CRM.
  const programSettings = await getYearlyProgramSettings(prisma);
  const results: LaunchResult[] = [];
  const now = new Date();

  const crashed: LaunchSummary['crashed'] = [];
  let interrupted: LaunchSummary['interrupted'];

  /// Доступ уже відкривали В МЕЖАХ ЦЬОГО набору — таку підписку цикл не мутує взагалі.
  /// Винесено в предикат, бо те саме питання ставиться двічі: у циклі (skip) і при
  /// перериванні за дедлайном (скільки РЕАЛЬНОЇ роботи лишилось).
  const alreadyOpenedInThisCohort = (s: (typeof subs)[number]) =>
    Boolean(s.sendpulseAccessOpenedAt && cohort.launchedAt && s.sendpulseAccessOpenedAt >= cohort.launchedAt);

  /// Чи підписка справді пішла б у роботу (SendPulse + мутація), а не була б пропущена
  /// guard-ами. Дзеркалить порядок перевірок у циклі — потрібно, щоб `interrupted.remaining`
  /// не лякав менеджера числом рядків, серед яких половина все одно була б skipped.
  const wouldBeProcessed = (s: (typeof subs)[number]) => {
    if (!s.user?.email) return false;
    if (alreadyOpenedInThisCohort(s)) return false;
    if (!s.payments.some((p) => p.status === 'PAID' && !p.excludedFromAccess)) return false;
    if (s.status === 'PENDING' && !(s.expiresAt && s.expiresAt >= now)) return false;
    return true;
  };

  // Ростер SendPulse тягнеться ОДИН раз на весь цикл (див. withSendpulseRosterCache):
  // без цього lookupStudentIdByEmail пагінував увесь курс на кожного студента і запуск
  // на 300 людей не встигав у ліміт функції.
  await withSendpulseRosterCache(async () => {
  for (const [idx, s] of subs.entries()) {
    // М'який дедлайн (див. options.deadlineAt): краще віддати чесний partial-summary
    // «оброблено X з Y», ніж дати платформі зарубати функцію посеред ітерації.
    if (options.deadlineAt && Date.now() >= options.deadlineAt.getTime()) {
      // `remaining` — тільки ті, кого цикл реально мав би обробити. Рахувати всі
      // необійдені рядки означало б лякати менеджера числом, у якому сидять і ті,
      // кого guard-и все одно пропустили б (немає оплати, доступ уже відкрито).
      const remaining = subs.slice(idx).filter(wouldBeProcessed).length;
      interrupted = { reason: 'deadline', remaining };
      console.warn(`[yearly-launch] cohort ${cohort.id}: м'який дедлайн, оброблено ${idx}/${subs.length}, лишилось у роботі ${remaining}`);
      break;
    }
    // Кожен студент ізольований: непередбачуваний виняток (обрив БД, конфлікт запису)
    // раніше клав увесь запуск — усі наступні лишались без доступу, а розсилка кредів
    // взагалі не стартувала, бо помилка вилітала в route. Тепер падіння одного —
    // подія в його лозі + запис у `crashed`, цикл їде далі.
    let recorded = false;
    try {
      if (!s.user?.email) continue;

      // Доступ уже відкривали В ЦЬОМУ наборі (retry після часткового запуску, extra-launch
      // пізнього покупця, ручний reopen) → підписку НЕ мутуємо взагалі. Раніше цикл
      // безумовно писав status='ACTIVE' + RESET_REMINDER_AND_GRACE_FIELDS: повторний
      // запуск піднімав боржника з GRACE назад в ACTIVE (несплачений місяць прощався)
      // і обнуляв ланцюг нагадувань. Мутації — лише для тих, кому доступ реально
      // відкривається вперше в цьому проході.
      // Порівнюємо саме з `launchedAt` набору, а не просто з наявністю прапорця: у
      // перенесеного з минулого набору студента `sendpulseAccessOpenedAt` стоїть з
      // торішнього запуску, і пропуск лишив би його без перерахованого expiresAt.
      if (alreadyOpenedInThisCohort(s)) {
        results.push({
          subscriptionId: s.id,
          email: s.user.email,
          accessOpened: false,
          expiresAt: s.expiresAt?.toISOString() ?? null,
          skipReason: 'already_opened',
        });
        // Подію тут НЕ пишемо: кожен повтор запуску інакше додавав по рядку «доступ уже
        // відкрито» в лог КОЖНОЇ вже обробленої підписки (набір на 300 людей × кожне
        // натискання «Повторити запуск» = сотні порожніх записів, у яких тонуть реальні
        // збої). Факт пропуску видно в summary (`skipReason: already_opened`).
        recorded = true;
        continue;
      }

      // `excludedFromAccess` — списання, які система свідомо не зарахувала в доступ
      // (orphan по закритій підписці, понад ліміт, розбіжність суми). Без цього фільтра
      // підписка, у якої ВСІ платежі виключені, проходила guard, отримувала SP-доступ і
      // expiresAt=null від calculateAccessUntil — вічний доступ поза полем зору cron-ів.
      const paidPayments = s.payments.filter((p) => p.status === 'PAID' && !p.excludedFromAccess);
      if (paidPayments.length === 0) {
        // Свідомий пропуск: підписка існує, але платіж ще не пройшов. Не вважається
        // помилкою (counter `skipped`, не `failed`). Не пишемо event — це не failure.
        results.push({
          subscriptionId: s.id,
          email: s.user.email,
          accessOpened: false,
          expiresAt: null,
          skipReason: 'no_paid_payments',
        });
        recorded = true;
        continue;
      }

      // PENDING зі старими PAID-платежами, але вичерпаним (або невизначеним) доступом —
      // не оплачений цикл, а залишок минулого. Критерій той самий, що в heal-cron-і:
      // PENDING допускається тільки з чинним expiresAt. ACTIVE/GRACE — без змін.
      if (s.status === 'PENDING' && !(s.expiresAt && s.expiresAt >= now)) {
        results.push({
          subscriptionId: s.id,
          email: s.user.email,
          accessOpened: false,
          expiresAt: s.expiresAt?.toISOString() ?? null,
          skipReason: 'pending_access_expired',
        });
        recorded = true;
        continue;
      }

      let openedNow = false;
      let openErr: string | null = null;
      if (!s.sendpulseAccessOpenedAt) {
        try {
          await openAccessViaEvent(
            s.user.email,
            YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
            s.plan === 'YEARLY' ? programSettings.yearlyPrice : programSettings.monthlyPrice,
          );
          openedNow = true;
          if (!s.sendpulseStudentId && yearlySpCourseId) {
            try {
              const studentId = await lookupStudentIdByEmail(
                yearlySpCourseId,
                s.user.email,
              );
              if (studentId) {
                await prisma.yearlyProgramSubscription.update({
                  where: { id: s.id },
                  data: { sendpulseStudentId: studentId },
                });
              }
            } catch {
              // ignore lookup err — буде підтянуто пізніше cron-ом
            }
          }
        } catch (e) {
          openErr = (e as Error).message;
        }
      } else {
        openedNow = true;
      }

      const newExpiresAt = calculateAccessUntil({
        plan: s.plan,
        autoRenew: s.autoRenew,
        cohort: { startDate: cohort.startDate, endDate: cohort.endDate },
        payments: s.payments,
        postAccessMonths,
      });

      await prisma.yearlyProgramSubscription.update({
        where: { id: s.id },
        data: {
          status: 'ACTIVE',
          startDate: s.startDate ?? cohort.startDate,
          expiresAt: newExpiresAt,
          // Запуск = початок свіжого циклу життя: гасимо спожиті до запуску прапори
          // нагадувань і grace-залишки (могли лишитись від періоду з кривими датами),
          // інакше перший реальний цикл після запуску пройде без жодного листа.
          ...RESET_REMINDER_AND_GRACE_FIELDS,
          ...(openedNow && !s.sendpulseAccessOpenedAt
            ? { sendpulseAccessOpenedAt: new Date(), sendpulseAccessClosedAt: null }
            : {}),
        },
      });

      // Переносимо WFP-графік автосписань під дати cohort-у (HTTP поза транзакцією — тут
      // її і немає). Помилка не валить запуск: подія wfp_schedule_sync_failed у лозі підписки.
      if (s.plan === 'MONTHLY' && s.autoRenew) {
        try {
          await syncAutopaySchedule(s.id, { apply: true, source: `launch:${actorLabel}` });
        } catch {
          // подія вже створена всередині syncAutopaySchedule або впав сам виклик — не блокуємо запуск
        }
      }

      // Тип події точно відображає семантику: success → "access_opened", failure → "access_open_failed".
      // Issue-tracker полюється на ці типи, плюс старі записи (legacy "admin_action" з FAILED у message)
      // ловить regex-fallback у classifyEvent.
      const eventType = openErr
        ? 'access_open_failed'
        : (openedNow && !s.sendpulseAccessOpenedAt ? 'access_opened' : 'admin_action');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: eventType,
          message: openErr
            ? `Cohort launch · access open FAILED: ${openErr.slice(0, 200)}`
            : `Cohort launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
          metadata: { cohortId: cohort.id, openedNow, openErr },
        },
      });

      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        accessOpened: openedNow && !openErr,
        expiresAt: newExpiresAt?.toISOString() ?? null,
        error: openErr ?? undefined,
      });
      recorded = true;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      console.error(`[yearly-launch] subscription ${s.id} crashed: ${message}`);
      crashed.push({ subscriptionId: s.id, email: s.user?.email ?? null, error: message });
      if (!recorded) {
        results.push({
          subscriptionId: s.id,
          email: s.user?.email ?? '',
          accessOpened: false,
          expiresAt: null,
          error: message,
          crashed: true,
        });
      }
      // Слід у лозі підписки — best-effort: якщо впала сама БД, писати нікуди.
      try {
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: s.id,
            type: 'access_open_failed',
            message: `Cohort launch · ітерація впала: ${message.slice(0, 200)}`,
            metadata: { cohortId: cohort.id, crashed: true, error: message },
          },
        });
      } catch {
        // лог у БД теж недоступний — лишається console.error вище
      }
    }
  }
  });

  const opened = results.filter((r) => r.accessOpened).length;
  const skipped = results.filter((r) => !r.accessOpened && r.skipReason).length;
  const failed = results.filter((r) => !r.accessOpened && !r.skipReason).length;
  return { total: results.length, opened, skipped, failed, results, crashed, ...(interrupted ? { interrupted } : {}) };
}

export interface ExtraLaunchResult {
  ok: boolean;
  reason?: string;
  expiresAt: string | null;
  sendpulseAccessOpened: boolean;
  studentId: number | null;
  email: { sent: boolean; skipped?: string; error?: string };
}

/// "Екстра запуск" для одного студента, який оплатив після того як cohort вже launched
/// (вручну менеджером через UI або автоматично з callback-у при первинній оплаті).
/// Виконує: openAccessViaEvent → lookup studentId → update sub (ACTIVE + expiresAt + access flags)
/// → лог access_opened → cohort launch lett (з тих самих shablonів що й при груповій розсилці).
/// Idempotent: якщо доступ вже відкрито → reason='already_opened'; якщо лист уже надсилався —
/// пропускаємо лист.
export async function runExtraLaunchForSubscription(
  subscriptionId: string,
  actorLabel: string,
  options: { telegramInviteLink?: string | null } = {},
): Promise<ExtraLaunchResult> {
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
      events: { where: { type: 'launch_email_sent' }, select: { metadata: true } },
    },
  });
  if (!sub) return { ok: false, reason: 'sub_not_found', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  // Закрита підписка не воскресає з бічних дверей. PENDING лишається дозволеним:
  // heal-cron і callback штатно доводять до ACTIVE щойно оплачені підписки.
  if (ACCESS_BLOCKED_STATUSES.includes(sub.status)) {
    return { ok: false, reason: 'status_blocked', expiresAt: sub.expiresAt?.toISOString() ?? null, sendpulseAccessOpened: false, studentId: sub.sendpulseStudentId, email: { sent: false } };
  }
  if (!sub.user?.email) return { ok: false, reason: 'no_user_email', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (!sub.cohort) return { ok: false, reason: 'no_cohort', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (!sub.cohort.launchedAt) return { ok: false, reason: 'cohort_not_launched', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (sub.sendpulseAccessOpenedAt) return { ok: false, reason: 'already_opened', expiresAt: sub.expiresAt?.toISOString() ?? null, sendpulseAccessOpened: true, studentId: sub.sendpulseStudentId, email: { sent: false, skipped: 'already_opened' } };

  // Той самий фільтр, що й в executeLaunchLoop: виключені зі заліку списання не дають
  // права на доступ. Без нього підписка з одними лише orphan-платежами отримувала SP-доступ
  // і expiresAt=null (вічний доступ, невидимий для cron-ів).
  const paidPayments = sub.payments.filter((p) => p.status === 'PAID' && !p.excludedFromAccess);
  if (paidPayments.length === 0) return { ok: false, reason: 'no_paid_payments', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };

  const yearlySpCourseId = await getYearlySendpulseCourseId(prisma);
  // Та сама причина, що й у executeLaunchLoop: в SP-CRM має йти ціна плану, а не
  // сума першого платежу (carryover = 0 ₴, адмін-тест = 1-2 ₴).
  const programSettings = await getYearlyProgramSettings(prisma);
  const planPrice = sub.plan === 'YEARLY' ? programSettings.yearlyPrice : programSettings.monthlyPrice;
  let openErr: string | null = null;
  let studentId: number | null = sub.sendpulseStudentId;
  try {
    await openAccessViaEvent(sub.user.email, YEARLY_PROGRAM_CONFIG.sendpulseEventSlug, planPrice);
    if (!studentId && yearlySpCourseId) {
      try {
        studentId = await lookupStudentIdByEmail(yearlySpCourseId, sub.user.email);
      } catch {
        // ignore lookup err — досипається пізніше
      }
    }
  } catch (e) {
    openErr = (e as Error).message;
  }
  if (openErr) {
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `Extra-launch FAILED (SendPulse): ${openErr.slice(0, 200)}`,
        metadata: { extraLaunch: true, openErr, actor: actorLabel },
      },
    });
    return { ok: false, reason: `sendpulse_open_failed:${openErr}`, expiresAt: null, sendpulseAccessOpened: false, studentId, email: { sent: false } };
  }

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const newExpiresAt = calculateAccessUntil({
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    cohort: { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate },
    payments: sub.payments,
    postAccessMonths,
  });

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      startDate: sub.startDate ?? sub.cohort.startDate,
      expiresAt: newExpiresAt,
      // Свіжий цикл життя після extra-launch — як і в executeLaunchLoop.
      ...RESET_REMINDER_AND_GRACE_FIELDS,
      sendpulseAccessOpenedAt: new Date(),
      sendpulseAccessClosedAt: null,
      ...(studentId ? { sendpulseStudentId: studentId } : {}),
    },
  });

  // WFP-графік автосписань → під дати cohort-у (не блокує extra-launch при помилці).
  if (sub.plan === 'MONTHLY' && sub.autoRenew) {
    try {
      await syncAutopaySchedule(sub.id, { apply: true, source: `extra-launch:${actorLabel}` });
    } catch {
      // подія в лозі підписки вже створена / помилку видно в cron-звірці
    }
  }

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'access_opened',
      message: `Extra-launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: { extraLaunch: true, cohortId: sub.cohort.id, actor: actorLabel },
    },
  });

  // Cohort launch lett (з manager-customizable shablonів). Idempotent: якщо вже шили — пропускаємо.
  const alreadySent = sub.events.some((ev) => {
    const m = ev.metadata as { cohortId?: string } | null;
    return m?.cohortId === sub.cohort?.id;
  });

  let emailResult: ExtraLaunchResult['email'] = { sent: false };
  if (alreadySent) {
    emailResult = { sent: false, skipped: 'already_sent' };
  } else {
    const subjectTpl = sub.cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
    const bodyTpl = sub.cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;
    const { subject, body } = renderLaunchEmailTemplate({
      subject: subjectTpl,
      body: bodyTpl,
      variables: {
        name: sub.user.name,
        email: sub.user.email,
        startDate: sub.cohort.startDate,
        endDate: sub.cohort.endDate,
        cohortName: sub.cohort.name,
      },
    });
    try {
      const fullBody = body + renderTelegramInviteEmailBlock(options.telegramInviteLink ?? sub.telegramInviteLink ?? null);
      const res = await sendEmail({ to: sub.user.email, subject, html: fullBody });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'launch_email_sent',
          message: `Welcome email (extra-launch) by ${actorLabel}`,
          metadata: { cohortId: sub.cohort.id, extraLaunch: true, messageId: res.messageId },
        },
      });
      emailResult = { sent: true };
    } catch (e) {
      emailResult = { sent: false, error: (e as Error).message.slice(0, 200) };
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `Extra-launch email FAILED: ${emailResult.error}`,
          metadata: { extraLaunch: true, emailErr: emailResult.error },
        },
      });
    }
  }

  return {
    ok: true,
    expiresAt: newExpiresAt?.toISOString() ?? null,
    sendpulseAccessOpened: true,
    studentId,
    email: emailResult,
  };
}
