/// Issue tracker для Річної програми.
///
/// Архітектура:
///   - `YearlyProgramSubscriptionEvent` — immutable audit-лог (вже існує).
///   - `YearlyProgramIssueDismissal` — менеджер може заглушити issue (subId, kind).
///   - Цей модуль агрегує все в один типізований view: bins per (subId, kind) з
///     `lastOccurredAt` + `occurrenceCount` + paired auto-resolution.
///
/// Source-of-truth — БД. Issue не зберігається як окремий рядок: він обчислюється з
/// failure-подій / state-полів. Це гарантує, що list завжди свіжий і не може
/// розійтися з реальністю. Заглушення — окремий механізм для випадків коли
/// failure залишається в історії, але адмін підтвердив, що проблема вирішена.
///
/// Про перформанс: для ~500 підписок повний скан < 100ms на одному запиті, тому
/// кешування поки не потрібне. Якщо база зросте — додати materialized view
/// або таблицю-cache з recompute через cron.

import prisma from '@/lib/prisma';

/// Стабільний enum типів issue. Не перейменовуй значення — вони зберігаються
/// у `YearlyProgramIssueDismissal.kind` як рядки (історичні dismissal-и зламаються).
/// Додавати нові — можна. Видаляти — лише з міграцією, що чистить старі dismissal-и.
/// «Помилки» — це ТЕХНІЧНІ збої системи (SP API не відповів, Telegram bot не зміг
/// створити invite, шаблон листа не відрендерився). НЕ бізнес-події типу
/// «студентська картка не пройшла» — це нормальне життя автоплатежів, видно у
/// розділі підписки expand, не варто рахувати як «помилку».
export type IssueKind =
  | 'LAUNCH_ACCESS_FAILED'
  | 'LAUNCH_EMAIL_FAILED'
  | 'LAUNCH_OVERDUE'
  | 'TG_INVITE_FAILED'
  | 'TG_KICK_FAILED'
  | 'SP_CLOSE_FAILED'
  | 'SP_REOPEN_FAILED'
  | 'ORPHAN_NO_PAYMENT'
  | 'ORPHAN_RECURRING_CHARGE'
  | 'RECURRING_CALLBACK_SKIPPED'
  | 'REVIVED_WITH_DEBT'
  | 'EMAIL_FAILED';

export const ISSUE_KIND_VALUES: IssueKind[] = [
  'LAUNCH_ACCESS_FAILED',
  'LAUNCH_EMAIL_FAILED',
  'LAUNCH_OVERDUE',
  'TG_INVITE_FAILED',
  'TG_KICK_FAILED',
  'SP_CLOSE_FAILED',
  'SP_REOPEN_FAILED',
  'ORPHAN_NO_PAYMENT',
  'ORPHAN_RECURRING_CHARGE',
  'RECURRING_CALLBACK_SKIPPED',
  'REVIVED_WITH_DEBT',
  'EMAIL_FAILED',
];

export type IssueSeverity = 'critical' | 'warning' | 'info';

/// Severity per kind. Має 1-в-1 збігатись з CATALOG у IssuesModal.tsx (UI-каталог).
/// Дублюється свідомо: UI-каталог тримає тексти/іконки/дії (client-only), а ця мапа
/// потрібна на сервері для агрегації «highest severity per subscription» без тягнення
/// клієнтського модуля у server bundle.
export const ISSUE_KIND_SEVERITY: Record<IssueKind, IssueSeverity> = {
  LAUNCH_ACCESS_FAILED: 'critical',
  LAUNCH_EMAIL_FAILED: 'warning',
  LAUNCH_OVERDUE: 'critical',
  TG_INVITE_FAILED: 'warning',
  TG_KICK_FAILED: 'info',
  // warning, не info: поки закриття не вдалось, студент фактично зберігає платний доступ.
  SP_CLOSE_FAILED: 'warning',
  SP_REOPEN_FAILED: 'warning',
  ORPHAN_NO_PAYMENT: 'critical',
  ORPHAN_RECURRING_CHARGE: 'critical',
  RECURRING_CALLBACK_SKIPPED: 'critical',
  REVIVED_WITH_DEBT: 'critical',
  EMAIL_FAILED: 'warning',
};

const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

/// Будує мапу `subscriptionId → найвища severity активних issue-ів + кількість`.
/// Використовується для бейджа на рядку таблиці підписок.
export function buildSubscriptionSeverityMap(payload: IssuesPayload): Record<string, { severity: IssueSeverity; count: number }> {
  const acc: Record<string, { severity: IssueSeverity; count: number }> = {};
  for (const rec of payload.active) {
    // Issue без прив'язки до підписки (нерозпізнаний callback) не має рядка в таблиці — пропускаємо.
    if (!rec.subscriptionId) continue;
    const sev = ISSUE_KIND_SEVERITY[rec.kind];
    const prev = acc[rec.subscriptionId];
    if (!prev) {
      acc[rec.subscriptionId] = { severity: sev, count: 1 };
    } else {
      prev.count += 1;
      if (SEVERITY_RANK[sev] < SEVERITY_RANK[prev.severity]) prev.severity = sev;
    }
  }
  return acc;
}

export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  LAUNCH_ACCESS_FAILED: 'Запуск: SP-доступ не відкрито',
  LAUNCH_EMAIL_FAILED: 'Запуск: welcome-лист не доставлено',
  LAUNCH_OVERDUE: 'Запуск прострочено',
  TG_INVITE_FAILED: 'Telegram: invite-link не згенеровано',
  TG_KICK_FAILED: 'Telegram: вилучення/ban не виконано',
  SP_CLOSE_FAILED: 'SendPulse: close-access помилка',
  SP_REOPEN_FAILED: 'SendPulse: reopen-access помилка',
  ORPHAN_NO_PAYMENT: 'Цілісність: активна підписка без жодної оплати',
  ORPHAN_RECURRING_CHARGE: 'Гроші списані після закриття підписки',
  RECURRING_CALLBACK_SKIPPED: 'Автосписання не зараховано (callback пропущено)',
  REVIVED_WITH_DEBT: 'Оплата з боргом — потрібне рішення менеджера',
  EMAIL_FAILED: 'Лист-нагадування не доставлено',
};

/// Чи є retry-action для kind-у — впливає на UI (показ кнопки «Спробувати ще»).
/// Auto-retry-кнопки відомі: invite-link generation, cohort launch retry.
export const ISSUE_HAS_RETRY: Record<IssueKind, boolean> = {
  LAUNCH_ACCESS_FAILED: true,   // POST /cohorts/[id]/launch?retry=1
  LAUNCH_EMAIL_FAILED: false,   // через окрему "Дослати лист" модалку (per-recipient)
  LAUNCH_OVERDUE: false,        // issue на рівні набору — менеджер тисне 🚀 Запустити в шапці cohort-у
  TG_INVITE_FAILED: true,       // POST /yearly-program/[id]/telegram-invite (force=true)
  TG_KICK_FAILED: false,        // одноразова дія, повторювати не варто
  SP_CLOSE_FAILED: false,       // менеджер натискає "Закрити доступ" знову вручну
  SP_REOPEN_FAILED: false,      // менеджер натискає "Відкрити доступ" знову вручну
  ORPHAN_NO_PAYMENT: false,     // ручний розбір: видалити сироту або знайти втрачений платіж
  ORPHAN_RECURRING_CHARGE: false, // ручне рішення: повернути гроші або поновити підписку
  RECURRING_CALLBACK_SKIPPED: false, // ручний розбір: звірити з кабінетом WFP
  REVIVED_WITH_DEBT: false,          // рішення менеджера: «Продовжити» / «Ручна оплата» / повернення
  EMAIL_FAILED: false,               // cron сам ретраїть щодня; ручна дія — виправити email студента
};

/// Skip-причини WFP-callback-а, за яких гроші реально списані, а платіж НЕ зарахований.
/// `PaymentCallbackLog` з такою причиною за останні `CALLBACK_LOG_WINDOW_DAYS` днів
/// піднімається у вкладку «Помилки» (kind `RECURRING_CALLBACK_SKIPPED`).
/// Джерело запису — `app/api/wayforpay/callback/route.ts`; рядки мають збігатись.
export const YEARLY_CALLBACK_SKIP_REASONS = [
  'subscription_not_found',
  'amount_mismatch',
  'monthly_cap_reached',
  'user_not_found',
  /// WFP повідомив про повернення коштів, а вихідного платежу в нас немає — гроші
  /// пішли назад «у нікуди» з точки зору обліку. Такий випадок теж треба розібрати вручну.
  'refund_payment_not_found',
] as const;

/// Префікс `actionsTaken`-мітки, якою callback позначає розпізнану підписку
/// (`sub:<subscriptionId>`). Дає змогу привʼязати лог-запис до підписки без окремої колонки.
/// Пишеться в callback-route, читається тут — міняти можна лише в обох місцях одночасно.
export const CALLBACK_LOG_SUB_ACTION_PREFIX = 'sub:';

/// Вікно, у якому «завислі» callback-и вважаються актуальною проблемою.
const CALLBACK_LOG_WINDOW_DAYS = 30;
/// Стеля вибірки лог-записів — захист від разового сплеску (нормою є одиниці рядків).
const CALLBACK_LOG_MAX_ROWS = 500;

export interface IssueRecord {
  /// null — issue не вдалось привʼязати до підписки (нерозпізнаний рекурентний callback).
  /// Такі записи не можна ані «Відкрити», ані «Заглушити» (dismissal має FK на підписку).
  subscriptionId: string | null;
  /// Стабільний ключ для issue-ів без підписки (orderReference або id лог-запису).
  /// Для звичайних issue-ів — null (ключ = subscriptionId::kind).
  sourceId: string | null;
  kind: IssueKind;
  /// Час останнього прояву (для event-based: createdAt останнього failure;
  /// для state-based: updatedAt підписки).
  lastOccurredAt: string;
  /// Кількість failure-подій для цієї пари (для state-based — 1).
  occurrenceCount: number;
  /// Excerpt помилки (до 200 символів) для UI. Повний текст — у "Подіях" підписки.
  errorExcerpt: string | null;
  /// Метадані останнього failure (для UI).
  user: { id: string; name: string | null; email: string };
  plan: 'YEARLY' | 'MONTHLY';
  cohortName: string | null;
  /// Якщо заглушено — повертаємо в окремому масиві `dismissed`.
  dismissedAt: string | null;
  dismissedBy: string | null;
  dismissedReason: string | null;
}

export interface IssuesPayload {
  active: IssueRecord[];
  dismissed: IssueRecord[];
  /// Лічильники активних по kind — для badge у toolbar.
  activeCounts: Record<IssueKind, number>;
  /// Сумарний лічильник активних — для red-dot.
  activeTotal: number;
}

interface RawSubscription {
  id: string;
  plan: 'YEARLY' | 'MONTHLY';
  status: string;
  updatedAt: Date;
  telegramInviteError: string | null;
  telegramInvitedAt: Date | null;
  lastChargeError: string | null;
  failedChargeCount: number;
  lastChargeAttemptAt: Date | null;
  manuallyAddedAt: Date | null;
  reminderSent3d: boolean;
  reminderSentOnExpiry: boolean;
  reminderSentGraceStart: boolean;
  reminderSentGraceMid: boolean;
  reminderSentGraceLast: boolean;
  reminderSentExpired: boolean;
  user: { id: string; name: string | null; email: string } | null;
  cohort: { name: string } | null;
}

/// Прапорці «лист надіслано» (дзеркало ReminderFlag у cron-і). Використовуються
/// детектором EMAIL_FAILED: подія про фейл актуальна лише поки відповідний прапорець
/// усе ще `false` (тобто лист так і не пішов).
const REMINDER_FLAG_KEYS = [
  'reminderSent3d',
  'reminderSentOnExpiry',
  'reminderSentGraceStart',
  'reminderSentGraceMid',
  'reminderSentGraceLast',
  'reminderSentExpired',
] as const;

function reminderFlagValue(sub: RawSubscription, flag: string): boolean | undefined {
  if (!(REMINDER_FLAG_KEYS as readonly string[]).includes(flag)) return undefined;
  return (sub as unknown as Record<string, boolean>)[flag];
}

/// Вікно, у якому недоставлений лист вважається актуальною проблемою. Cron ретраїть
/// щодня і пише не більше однієї події на добу — тож 3 дні означають «проблема жива
/// щонайменше останню добу», а стара разова невдача сама зникає з вкладки.
const EMAIL_FAILED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface RawEvent {
  id: string;
  subscriptionId: string;
  type: string;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface RawDismissal {
  subscriptionId: string;
  kind: string;
  dismissedAt: Date;
  dismissedBy: string;
  reason: string | null;
}

/// Одне місце, де failure-подія мапиться у IssueKind. Якщо в коді з'являється новий
/// тип failure-події — додай тут, щоб він автоматично підхопився trekker-ом.
function classifyEvent(e: RawEvent): {
  kind: IssueKind | null;
  /// Чи це success-подія, що "закриває" issue. Повертаємо kind (або кілька), які вона
  /// resolve-ить: одна дія менеджера може знімати одразу два різні issue.
  resolvesKind?: IssueKind | IssueKind[];
} {
  // Success events (resolve відповідного failure):
  if (e.type === 'access_opened') return { kind: null, resolvesKind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_sent') return { kind: null, resolvesKind: 'LAUNCH_EMAIL_FAILED' };
  // Менеджер розібрався з боргом: «Відкрити знову» (reactivated) — доступ і дати виставлені
  // вручну. Та сама подія знімає і невдале повторне відкриття доступу в SP, і зависле
  // «не вдалось закрити» — після свідомого reopen закривати доступ уже не треба.
  if (e.type === 'reactivated') return { kind: null, resolvesKind: ['REVIVED_WITH_DEBT', 'SP_REOPEN_FAILED', 'SP_CLOSE_FAILED'] };

  // Доступ таки закрито (cron дотиснув наступного дня або менеджер закрив вручну) —
  // знімає попередній `access_close_failed`.
  if (e.type === 'access_closed') return { kind: null, resolvesKind: 'SP_CLOSE_FAILED' };

  // Збої SendPulse на закритті/повторному відкритті доступу. Пишуться cron-ом (крок
  // expire), рефанд-гілкою WFP-callback-а та адмін-діями. Без цього мапінгу kind-и
  // SP_CLOSE_FAILED / SP_REOPEN_FAILED були «мертвими» — подія в лозі є, у «Помилках» пусто.
  if (e.type === 'access_close_failed') return { kind: 'SP_CLOSE_FAILED' };
  if (e.type === 'access_reopen_failed') return { kind: 'SP_REOPEN_FAILED' };

  // Оплата оживила мертву підписку, але за графіком набору доступ уже вичерпано:
  // гроші зайшли, а скільки саме доступу давати — рішення менеджера (callback лише фіксує факт).
  if (e.type === 'revived_with_debt') return { kind: 'REVIVED_WITH_DEBT' };

  // Failure events (видні в активних):
  if (e.type === 'access_open_failed') return { kind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_failed') return { kind: 'LAUNCH_EMAIL_FAILED' };
  // Рекурентне списання прийшло на закриту (EXPIRED/CANCELLED/ARCHIVED) підписку:
  // Payment створено і залінковано, але доступ НЕ продовжено — рішення за менеджером.
  if (e.type === 'orphan_recurring_charge') return { kind: 'ORPHAN_RECURRING_CHARGE' };

  // Legacy: до явних `*_failed` типів ми писали failure-події з type='admin_action'
  // або 'access_opened' з мітками FAILED у message. Ловимо їх по тексту.
  if (e.message) {
    if (/Cohort launch · access open FAILED/i.test(e.message)) return { kind: 'LAUNCH_ACCESS_FAILED' };
    if (/Extra-launch FAILED \(SendPulse\)/i.test(e.message)) return { kind: 'LAUNCH_ACCESS_FAILED' };
    if (/Extra-launch email FAILED/i.test(e.message)) return { kind: 'LAUNCH_EMAIL_FAILED' };
    // Адмін вручну змінив термін доступу — «Продовжити +Nд» або «Ручна оплата» з перерахунком
    // expiresAt. Обидва означають, що борг опрацьовано і рішення прийнято.
    if (/^Extended \+\d+d\b/i.test(e.message)) return { kind: null, resolvesKind: 'REVIVED_WITH_DEBT' };
    // Ручна оплата гасить борг ТІЛЬКИ якщо після неї доступ реально дотягнувся до
    // майбутнього. Внесення одного місяця з трьох пропущених — це часткове погашення:
    // студент і далі без доступу, тож critical-issue має лишитись висіти.
    if (/^Ручна оплата .*expiresAt=/i.test(e.message)) {
      const at = /expiresAt=(\d{4}-\d{2}-\d{2})/.exec(e.message)?.[1];
      const resolvedForward = !!at && new Date(`${at}T23:59:59.999Z`).getTime() > Date.now();
      return resolvedForward ? { kind: null, resolvesKind: 'REVIVED_WITH_DEBT' } : { kind: null };
    }
  }

  // TG-kick events із масивом помилок у metadata.errors:
  if (e.type === 'admin_action' && e.metadata && typeof e.metadata === 'object') {
    const meta = e.metadata as { mode?: string; errors?: unknown };
    if ((meta.mode === 'returnable' || meta.mode === 'permanent') && Array.isArray(meta.errors) && meta.errors.length > 0) {
      return { kind: 'TG_KICK_FAILED' };
    }
  }

  return { kind: null };
}

/// Зчитує stateful-issue-и з полів підписки (без потреби в подіях).
function stateBasedIssues(sub: RawSubscription, hasPaidPayment: boolean): { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] {
  const out: { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] = [];
  // Невдалий invite показуємо лише для реальних клієнтів: підписка або оплачена, або
  // вже в робочому статусі. Інакше вкладку засмічують неоплачені чернетки — прямі
  // POST-и з битим @username створюють `telegramInviteError` ще до будь-якої оплати.
  const isRealClient = hasPaidPayment || sub.status === 'ACTIVE' || sub.status === 'GRACE';
  if (sub.telegramInviteError && isRealClient) {
    out.push({
      kind: 'TG_INVITE_FAILED',
      errorExcerpt: sub.telegramInviteError.slice(0, 200),
      // Best approximation: останнє ненульове `telegramInvitedAt`, інакше updatedAt.
      lastOccurredAt: sub.telegramInvitedAt ?? sub.updatedAt,
    });
  }
  return out;
}

/// Збирає всі issue-и (active + dismissed) для всіх підписок. Ефективно: один батч
/// запитів, далі агрегація в пам'яті. Не залежить від адмін-сесії — викликається з API
/// route, який сам гейтується isAdmin.
export async function collectAllIssues(): Promise<IssuesPayload> {
  const now = new Date();
  const callbackLogSince = new Date(Date.now() - CALLBACK_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [subs, events, dismissals, paidRows, callbackLogs, overdueCohorts] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        plan: true,
        status: true,
        updatedAt: true,
        telegramInviteError: true,
        telegramInvitedAt: true,
        lastChargeError: true,
        failedChargeCount: true,
        lastChargeAttemptAt: true,
        manuallyAddedAt: true,
        reminderSent3d: true,
        reminderSentOnExpiry: true,
        reminderSentGraceStart: true,
        reminderSentGraceMid: true,
        reminderSentGraceLast: true,
        reminderSentExpired: true,
        user: { select: { id: true, name: true, email: true } },
        cohort: { select: { name: true } },
      },
    }),
    /// Тягнемо тільки потенційно-релевантні події: failure-типи + success-типи
    /// для resolve-логіки. Інші типи (created/charge_success/cancelled тощо) пропускаємо.
    prisma.yearlyProgramSubscriptionEvent.findMany({
      where: {
        OR: [
          { type: { in: ['access_open_failed', 'launch_email_failed', 'access_opened', 'launch_email_sent', 'orphan_recurring_charge', 'revived_with_debt', 'reactivated', 'reminder_email_failed', 'access_close_failed', 'access_reopen_failed'] } },
          { type: 'admin_action' },
        ],
      },
      select: {
        id: true,
        subscriptionId: true,
        type: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.yearlyProgramIssueDismissal.findMany({
      select: {
        subscriptionId: true,
        kind: true,
        dismissedAt: true,
        dismissedBy: true,
        reason: true,
      },
    }),
    /// Для детектора цілісності ORPHAN_NO_PAYMENT — множина підписок, що мають
    /// хоч один PAID-платіж. Підписка в «оплаченому» статусі поза цією множиною = аномалія.
    prisma.payment.findMany({
      where: { yearlyProgramSubscriptionId: { not: null }, status: 'PAID' },
      select: { yearlyProgramSubscriptionId: true },
      distinct: ['yearlyProgramSubscriptionId'],
    }),
    /// «Гроші списані — не зараховані»: callback Річної, який ми свідомо пропустили
    /// (не знайшли підписку/користувача, сума не збіглась, ліміт списань вичерпано).
    /// WFP такий callback більше не повторить — без цього блоку кейс залишався б
    /// видимим лише в сирих логах платежів.
    prisma.paymentCallbackLog.findMany({
      where: {
        kind: { in: ['monthly', 'yearly'] },
        skipped: true,
        skipReason: { in: [...YEARLY_CALLBACK_SKIP_REASONS] },
        createdAt: { gt: callbackLogSince },
      },
      select: {
        id: true,
        orderReference: true,
        clientEmail: true,
        kind: true,
        skipReason: true,
        actionsTaken: true,
        error: true,
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: CALLBACK_LOG_MAX_ROWS,
    }),
    /// «Запуск прострочено»: набір, дата старту якого вже настала, але його ніхто не
    /// запустив і не поставив у чергу (`launchScheduledFor` теж порожній). Наявність
    /// оплачених підписок перевіряємо нижче — без них це просто порожня заготовка.
    /// `endDate >= now` відсікає історію: незапущений набір минулих років уже нікого не
    /// врятує, а вічний critical-бейдж у «Помилках» лише притупляє увагу до свіжих проблем.
    prisma.yearlyProgramCohort.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        launchedAt: null,
        launchScheduledFor: null,
      },
      select: { id: true, name: true, startDate: true },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const paidSubIds = new Set(paidRows.map((r) => r.yearlyProgramSubscriptionId).filter(Boolean) as string[]);

  const subById = new Map<string, RawSubscription>(subs.map((s) => [s.id, s]));

  /// ARCHIVED-підписки свідомо не входять у вибірку (їхні старі failure — історія).
  /// Єдиний виняток: орфанне рекурентне списання — гроші прийшли ПІСЛЯ архівації,
  /// і це треба показати менеджеру. Дотягуємо такі підписки точково.
  const orphanChargeSubIds = new Set(
    events.filter((e) => e.type === 'orphan_recurring_charge').map((e) => e.subscriptionId),
  );
  const missingSubIds = [...orphanChargeSubIds].filter((id) => !subById.has(id));
  if (missingSubIds.length > 0) {
    const archivedWithCharge = await prisma.yearlyProgramSubscription.findMany({
      where: { id: { in: missingSubIds } },
      select: {
        id: true,
        plan: true,
        status: true,
        updatedAt: true,
        telegramInviteError: true,
        telegramInvitedAt: true,
        lastChargeError: true,
        failedChargeCount: true,
        lastChargeAttemptAt: true,
        manuallyAddedAt: true,
        reminderSent3d: true,
        reminderSentOnExpiry: true,
        reminderSentGraceStart: true,
        reminderSentGraceMid: true,
        reminderSentGraceLast: true,
        reminderSentExpired: true,
        user: { select: { id: true, name: true, email: true } },
        cohort: { select: { name: true } },
      },
    });
    for (const s of archivedWithCharge) subById.set(s.id, s);
  }

  // Мапа: subId → kind → найсвіжіший resolved-час (з success-events).
  const resolvedAt = new Map<string, Map<IssueKind, Date>>();
  // Мапа: subId → kind → { latestFailureAt, occurrenceCount, latestErrorExcerpt }
  const failureAgg = new Map<string, Map<IssueKind, { latestAt: Date; count: number; excerpt: string | null }>>();

  for (const e of events) {
    const c = classifyEvent(e);
    if (c.resolvesKind) {
      let map = resolvedAt.get(e.subscriptionId);
      if (!map) { map = new Map(); resolvedAt.set(e.subscriptionId, map); }
      for (const resolved of Array.isArray(c.resolvesKind) ? c.resolvesKind : [c.resolvesKind]) {
        const prev = map.get(resolved);
        if (!prev || e.createdAt > prev) map.set(resolved, e.createdAt);
      }
    }
    if (c.kind) {
      let map = failureAgg.get(e.subscriptionId);
      if (!map) { map = new Map(); failureAgg.set(e.subscriptionId, map); }
      const prev = map.get(c.kind);
      const excerpt = e.message?.slice(0, 200) ?? null;
      if (!prev) {
        map.set(c.kind, { latestAt: e.createdAt, count: 1, excerpt });
      } else {
        prev.count += 1;
        if (e.createdAt > prev.latestAt) {
          prev.latestAt = e.createdAt;
          prev.excerpt = excerpt;
        }
      }
    }
  }

  // Мапа дисмісалів для швидкого lookup.
  const dismissalKey = (subId: string, kind: string) => `${subId}::${kind}`;
  const dismissalMap = new Map<string, RawDismissal>();
  for (const d of dismissals) {
    dismissalMap.set(dismissalKey(d.subscriptionId, d.kind), d);
  }

  // Збираємо event-based issues.
  const records: IssueRecord[] = [];
  for (const [subId, kindMap] of failureAgg) {
    const sub = subById.get(subId);
    if (!sub || !sub.user) continue;
    for (const [kind, agg] of kindMap) {
      // Resolve check: якщо є success-подія цього kind після останнього failure → пропускаємо.
      const successAt = resolvedAt.get(subId)?.get(kind);
      if (successAt && successAt > agg.latestAt) continue;

      const dismissal = dismissalMap.get(dismissalKey(subId, kind));
      records.push({
        subscriptionId: subId,
        sourceId: null,
        kind,
        lastOccurredAt: agg.latestAt.toISOString(),
        occurrenceCount: agg.count,
        errorExcerpt: agg.excerpt,
        user: sub.user,
        plan: sub.plan,
        cohortName: sub.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Збираємо state-based issues. Уникнення дублів: якщо вже є event-based record
  // того ж kind для цієї sub — пропускаємо state-based (event є точнішим джерелом).
  const recordKey = (r: IssueRecord) => `${r.subscriptionId}::${r.kind}`;
  const haveEventRecord = new Set(records.map(recordKey));
  for (const sub of subs) {
    if (!sub.user) continue;
    for (const stateIssue of stateBasedIssues(sub, paidSubIds.has(sub.id))) {
      if (haveEventRecord.has(`${sub.id}::${stateIssue.kind}`)) continue;
      const dismissal = dismissalMap.get(dismissalKey(sub.id, stateIssue.kind));
      records.push({
        subscriptionId: sub.id,
        sourceId: null,
        kind: stateIssue.kind,
        lastOccurredAt: stateIssue.lastOccurredAt.toISOString(),
        occurrenceCount: 1,
        errorExcerpt: stateIssue.errorExcerpt,
        user: sub.user,
        plan: sub.plan,
        cohortName: sub.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Детектор цілісності ORPHAN_NO_PAYMENT: підписка в «оплаченому» статусі
  // (ACTIVE/GRACE/EXPIRED/CANCELLED) без жодного PAID-платежу — це порушення інваріанта
  // (втрачений платіж / тестовий залишок / ручна правка БД). PENDING сюди НЕ входить —
  // там відсутність оплати нормальна (незавершений чекаут, його архівує cron).
  const ORPHAN_PAID_STATUSES = new Set(['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED']);
  for (const sub of subs) {
    if (!sub.user) continue;
    if (!ORPHAN_PAID_STATUSES.has(sub.status)) continue;
    if (paidSubIds.has(sub.id)) continue;
    // Ручне додавання без оплати (перенесення з минулорічного набору) — легітимно
    // безплатна підписка. НЕ вважаємо її «сиротою»/порушенням інваріанта.
    if (sub.manuallyAddedAt) continue;
    if (haveEventRecord.has(`${sub.id}::ORPHAN_NO_PAYMENT`)) continue;
    const dismissal = dismissalMap.get(dismissalKey(sub.id, 'ORPHAN_NO_PAYMENT'));
    records.push({
      subscriptionId: sub.id,
      sourceId: null,
      kind: 'ORPHAN_NO_PAYMENT',
      lastOccurredAt: sub.updatedAt.toISOString(),
      occurrenceCount: 1,
      errorExcerpt: `Статус ${sub.status}, але жодного PAID-платежу не знайдено.`,
      user: sub.user,
      plan: sub.plan,
      cohortName: sub.cohort?.name ?? null,
      dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
      dismissedBy: dismissal?.dismissedBy ?? null,
      dismissedReason: dismissal?.reason ?? null,
    });
  }

  // Детектор EMAIL_FAILED: cron не зміг доставити лист-нагадування і відкотив прапорець.
  // Показуємо лише поки проблема жива: подія свіжа (≤3 днів) І відповідний прапорець
  // усе ще `false`. Якщо наступного дня лист пішов — прапорець стає `true` і issue
  // зникає сам, без ручного «заглушити».
  {
    const emailFailedSince = new Date(Date.now() - EMAIL_FAILED_WINDOW_MS);
    // Групуємо по (підписка, прапорець): у однієї підписки можуть «висіти» різні листи,
    // і кожен резолвиться своїм прапорцем незалежно.
    const emailFailAgg = new Map<string, Map<string, { latestAt: Date; count: number; excerpt: string | null }>>();
    for (const e of events) {
      if (e.type !== 'reminder_email_failed') continue;
      if (e.createdAt < emailFailedSince) continue;
      const meta = e.metadata as { flag?: string } | null;
      const flag = meta?.flag;
      // Записи без метаданих (теоретично — з майбутніх/сторонніх джерел) пропускаємо:
      // без прапорця неможливо сказати, чи проблема ще актуальна.
      if (!flag) continue;
      let perFlag = emailFailAgg.get(e.subscriptionId);
      if (!perFlag) { perFlag = new Map(); emailFailAgg.set(e.subscriptionId, perFlag); }
      const prev = perFlag.get(flag);
      const excerpt = e.message?.slice(0, 200) ?? null;
      if (!prev) {
        perFlag.set(flag, { latestAt: e.createdAt, count: 1, excerpt });
      } else {
        prev.count += 1;
        if (e.createdAt > prev.latestAt) {
          prev.latestAt = e.createdAt;
          prev.excerpt = excerpt;
        }
      }
    }

    for (const [subId, perFlag] of emailFailAgg) {
      const sub = subById.get(subId);
      if (!sub || !sub.user) continue;
      // Лишаємо тільки нерозвʼязані листи: прапорець true → лист таки пішов наступного
      // проходу. Одна картка на підписку — за найсвіжішим із «живих» фейлів, сумарна
      // кількість повторень по всіх них.
      const unresolved = [...perFlag.entries()].filter(([flag]) => reminderFlagValue(sub, flag) === false);
      if (unresolved.length === 0) continue;
      const agg = unresolved
        .map(([, v]) => v)
        .reduce((best, v) => (v.latestAt > best.latestAt ? v : best));
      const totalCount = unresolved.reduce((sum, [, v]) => sum + v.count, 0);
      const dismissal = dismissalMap.get(dismissalKey(subId, 'EMAIL_FAILED'));
      records.push({
        subscriptionId: subId,
        sourceId: null,
        kind: 'EMAIL_FAILED',
        lastOccurredAt: agg.latestAt.toISOString(),
        occurrenceCount: totalCount,
        errorExcerpt: agg.excerpt,
        user: sub.user,
        plan: sub.plan,
        cohortName: sub.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Детектор «Запуск прострочено» (рівень набору, не підписки). Набір, у якого вже
  // настала дата старту, але launchedAt порожній і запуск навіть не запланований, при
  // цьому люди вже заплатили — студенти сидять без доступу, а система нічого не зробить
  // сама (cron запускає лише те, що має launchScheduledFor).
  if (overdueCohorts.length > 0) {
    const paidRowsInOverdue = await prisma.yearlyProgramSubscription.findMany({
      where: {
        cohortId: { in: overdueCohorts.map((c) => c.id) },
        payments: { some: { status: 'PAID' } },
      },
      select: { cohortId: true },
    });
    const paidPerCohort = new Map<string, number>();
    for (const r of paidRowsInOverdue) {
      if (!r.cohortId) continue;
      paidPerCohort.set(r.cohortId, (paidPerCohort.get(r.cohortId) ?? 0) + 1);
    }

    for (const c of overdueCohorts) {
      const paidCount = paidPerCohort.get(c.id) ?? 0;
      // Без жодної оплаченої підписки прострочений запуск нікому не шкодить — не шумимо.
      if (paidCount === 0) continue;
      records.push({
        // Issue належить набору, а не конкретній підписці: у таблиці рядка немає,
        // заглушити (dismissal має FK на підписку) не можна — тільки запустити набір.
        subscriptionId: null,
        sourceId: `cohort::${c.id}`,
        kind: 'LAUNCH_OVERDUE',
        lastOccurredAt: c.startDate.toISOString(),
        occurrenceCount: 1,
        errorExcerpt: `Старт ${c.startDate.toISOString().slice(0, 10)} · оплачених підписок: ${paidCount} · запуск не виконано і не заплановано.`,
        user: { id: '', name: `Набір «${c.name}»`, email: '—' },
        plan: 'YEARLY',
        cohortName: c.name,
        dismissedAt: null,
        dismissedBy: null,
        dismissedReason: null,
      });
    }
  }

  // Детектор «гроші списані — не зараховані» з PaymentCallbackLog.
  // Callback уже відповів WFP «accept» (інакше WFP ретраїть 24 год і задвоїть), тому
  // єдиний слід такого платежу — лог-запис. Групуємо: розпізнані — по підписці (щоб
  // менеджер міг заглушити), нерозпізнані — по orderReference.
  if (callbackLogs.length > 0) {
    // Auto-resolve: якщо для цього orderReference платіж уже існує в статусі PAID
    // (менеджер провів вручну або пізніший ретрай спрацював) — проблеми більше немає.
    const loggedRefs = callbackLogs.map((l) => l.orderReference).filter(Boolean) as string[];
    const settledRefs = new Set(
      loggedRefs.length === 0
        ? []
        : (
            await prisma.payment.findMany({
              where: { orderReference: { in: loggedRefs }, status: 'PAID' },
              select: { orderReference: true },
            })
          ).map((p) => p.orderReference),
    );

    type LogGroup = {
      subscriptionId: string | null;
      sourceId: string | null;
      latestAt: Date;
      count: number;
      excerpt: string;
      email: string | null;
      plan: 'YEARLY' | 'MONTHLY';
    };
    const logGroups = new Map<string, LogGroup>();
    for (const log of callbackLogs) {
      if (log.orderReference && settledRefs.has(log.orderReference)) continue;
      const subRef = log.actionsTaken
        ?.split(',')
        .find((a) => a.startsWith(CALLBACK_LOG_SUB_ACTION_PREFIX))
        ?.slice(CALLBACK_LOG_SUB_ACTION_PREFIX.length) ?? null;
      const groupKey = subRef ?? `log::${log.orderReference ?? log.id}`;
      const excerpt = [
        log.skipReason,
        log.orderReference,
        log.amount != null ? `${log.amount} грн` : null,
        log.clientEmail,
        log.error,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 200);
      const prev = logGroups.get(groupKey);
      if (!prev) {
        logGroups.set(groupKey, {
          subscriptionId: subRef,
          sourceId: subRef ? null : groupKey,
          latestAt: log.createdAt,
          count: 1,
          excerpt,
          email: log.clientEmail,
          plan: log.kind === 'yearly' ? 'YEARLY' : 'MONTHLY',
        });
      } else {
        prev.count += 1;
        if (log.createdAt > prev.latestAt) {
          prev.latestAt = log.createdAt;
          prev.excerpt = excerpt;
          prev.email = log.clientEmail;
        }
      }
    }

    for (const group of logGroups.values()) {
      const sub = group.subscriptionId ? subById.get(group.subscriptionId) : undefined;
      const dismissal = group.subscriptionId
        ? dismissalMap.get(dismissalKey(group.subscriptionId, 'RECURRING_CALLBACK_SKIPPED'))
        : undefined;
      records.push({
        subscriptionId: group.subscriptionId,
        sourceId: group.sourceId,
        kind: 'RECURRING_CALLBACK_SKIPPED',
        lastOccurredAt: group.latestAt.toISOString(),
        occurrenceCount: group.count,
        errorExcerpt: group.excerpt,
        // Підписки може не бути взагалі (нерозпізнаний callback) — тоді все, що ми
        // знаємо про людину, це email із платіжної сторінки WFP.
        user: sub?.user ?? { id: '', name: null, email: group.email ?? '—' },
        plan: sub?.plan ?? group.plan,
        cohortName: sub?.cohort?.name ?? null,
        dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
        dismissedBy: dismissal?.dismissedBy ?? null,
        dismissedReason: dismissal?.reason ?? null,
      });
    }
  }

  // Розділяємо active vs dismissed. Issue active якщо:
  //   - dismissal відсутній, АБО
  //   - lastOccurredAt > dismissedAt (нова failure після заглушення → знову вилазить).
  const active: IssueRecord[] = [];
  const dismissed: IssueRecord[] = [];
  for (const r of records) {
    if (r.dismissedAt && new Date(r.lastOccurredAt) <= new Date(r.dismissedAt)) {
      dismissed.push(r);
    } else {
      active.push(r);
    }
  }

  // Сортуємо: active за lastOccurredAt desc, dismissed за dismissedAt desc.
  active.sort((a, b) => new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime());
  dismissed.sort((a, b) => {
    const aAt = a.dismissedAt ? new Date(a.dismissedAt).getTime() : 0;
    const bAt = b.dismissedAt ? new Date(b.dismissedAt).getTime() : 0;
    return bAt - aAt;
  });

  const activeCounts = ISSUE_KIND_VALUES.reduce(
    (acc, k) => ({ ...acc, [k]: active.filter((r) => r.kind === k).length }),
    {} as Record<IssueKind, number>,
  );

  return {
    active,
    dismissed,
    activeCounts,
    activeTotal: active.length,
  };
}

/// Заглушити issue. Idempotent: якщо вже заглушено — оновлюємо `reason`/`dismissedBy`/`dismissedAt`.
export async function dismissIssue(args: {
  subscriptionId: string;
  kind: IssueKind;
  dismissedBy: string;
  reason?: string | null;
}): Promise<void> {
  const { subscriptionId, kind, dismissedBy, reason } = args;
  await prisma.yearlyProgramIssueDismissal.upsert({
    where: { subscriptionId_kind: { subscriptionId, kind } },
    create: { subscriptionId, kind, dismissedBy, reason: reason ?? null },
    update: { dismissedBy, reason: reason ?? null, dismissedAt: new Date() },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId,
      type: 'admin_action',
      message: `Issue dismissed [${kind}] by ${dismissedBy}${reason ? `: ${reason}` : ''}`,
      metadata: { issueDismissed: true, kind, reason: reason ?? null, dismissedBy },
    },
  });
}

/// Повернути dismissed issue в active (видаляє dismissal-запис).
export async function undismissIssue(args: {
  subscriptionId: string;
  kind: IssueKind;
  undismissedBy: string;
}): Promise<void> {
  const { subscriptionId, kind, undismissedBy } = args;
  await prisma.yearlyProgramIssueDismissal.deleteMany({
    where: { subscriptionId, kind },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId,
      type: 'admin_action',
      message: `Issue un-dismissed [${kind}] by ${undismissedBy}`,
      metadata: { issueUndismissed: true, kind, undismissedBy },
    },
  });
}
