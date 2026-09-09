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
import {
  splitTelegramInviteError,
  TG_INVITE_FAILED_EVENT_TYPE,
  TG_JOIN_DECLINED_EVENT_KIND,
  TG_JOIN_PENDING_EVENT_KIND,
} from '@/lib/yearlyProgramTelegramMarks';
import { getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';

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
  | 'TG_JOIN_DECLINED'
  | 'TG_JOIN_PENDING'
  | 'TG_KICK_FAILED'
  | 'TG_USERNAME_MISSING'
  | 'SP_CLOSE_FAILED'
  | 'SP_REOPEN_FAILED'
  | 'ORPHAN_NO_PAYMENT'
  | 'ORPHAN_RECURRING_CHARGE'
  | 'RECURRING_CALLBACK_SKIPPED'
  | 'REVIVED_WITH_DEBT'
  | 'WFP_REMOVE_FAILED'
  | 'WFP_SCHEDULE_DRIFT'
  | 'WFP_RULE_NOT_ACTIVE'
  | 'WFP_SCHEDULE_SYNC_FAILED'
  | 'ACCESS_OPENED_NO_EMAIL'
  | 'EMAIL_FAILED';

export const ISSUE_KIND_VALUES: IssueKind[] = [
  'LAUNCH_ACCESS_FAILED',
  'LAUNCH_EMAIL_FAILED',
  'LAUNCH_OVERDUE',
  'TG_INVITE_FAILED',
  'TG_JOIN_DECLINED',
  'TG_JOIN_PENDING',
  'TG_KICK_FAILED',
  'TG_USERNAME_MISSING',
  'SP_CLOSE_FAILED',
  'SP_REOPEN_FAILED',
  'ORPHAN_NO_PAYMENT',
  'ORPHAN_RECURRING_CHARGE',
  'RECURRING_CALLBACK_SKIPPED',
  'REVIVED_WITH_DEBT',
  'WFP_REMOVE_FAILED',
  'WFP_SCHEDULE_DRIFT',
  'WFP_RULE_NOT_ACTIVE',
  'WFP_SCHEDULE_SYNC_FAILED',
  'ACCESS_OPENED_NO_EMAIL',
  'EMAIL_FAILED',
];

/// Скільки провалів REMOVE поспіль треба, щоб підняти issue у вкладку «Помилки».
/// Один провал — це найчастіше разова недоступність WFP: нічний ретрай-крок cron-а
/// дотисне сам. Три поспіль означають, що правило живе і само не зникне, а картку
/// клієнта продовжують списувати.
/// Експортовано для cron-кроку `retry_autopay_remove`: підписки, що вже перетнули поріг,
/// він викидає з денної вибірки (вони й так висять у «Помилках» і чекають ручного втручання).
export const WFP_REMOVE_ISSUE_THRESHOLD = 3;

/// Скільки має «вистоятись» відкритий доступ без welcome-листа, щоб це стало issue.
/// Нічний heal-крок (`heal_missing_welcome_email`) добиває лист сам, тож свіжий розрив
/// між відкриттям доступу і листом — нормальний стан, а не проблема менеджера.
const ACCESS_OPENED_NO_EMAIL_MIN_AGE_MS = 36 * 60 * 60 * 1000;

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
  // warning: студент лишився поза каналом — але це не про гроші й не про доступ до навчання.
  TG_JOIN_DECLINED: 'warning',
  // info: заявка висить у самому Telegram і нікуди не подінеться; менеджер розбирає її вручну.
  TG_JOIN_PENDING: 'info',
  TG_KICK_FAILED: 'info',
  // warning: доки нік не вписаний, людині нема куди слати invite — вона просто не
  // потрапить у канал, і система сама цього не виправить (не про гроші чи доступ до навчання).
  TG_USERNAME_MISSING: 'warning',
  // warning, не info: поки закриття не вдалось, студент фактично зберігає платний доступ.
  SP_CLOSE_FAILED: 'warning',
  SP_REOPEN_FAILED: 'warning',
  ORPHAN_NO_PAYMENT: 'critical',
  ORPHAN_RECURRING_CHARGE: 'critical',
  RECURRING_CALLBACK_SKIPPED: 'critical',
  REVIVED_WITH_DEBT: 'critical',
  // critical: поки правило живе, картку клієнта списують за доступ, якого вже немає.
  WFP_REMOVE_FAILED: 'critical',
  // warning: гроші поки не втрачені, але дати списань розійшлись із розкладом набору —
  // без ручної синхронізації клієнта спишуть не тоді, коли має бути.
  WFP_SCHEDULE_DRIFT: 'warning',
  // warning: правило у WFP є, але призупинене — чергові списання не пройдуть, і доступ
  // одного дня згасне «без причини». Виправляється тільки в кабінеті WayForPay.
  WFP_RULE_NOT_ACTIVE: 'warning',
  // warning: спроба перенести графік списань у WFP не пройшла — правило лишилось зі старими
  // датами. Гроші поки на місці, але наступне списання піде не тоді, коли має.
  WFP_SCHEDULE_SYNC_FAILED: 'warning',
  // warning: доступ у людини Є (гроші відпрацьовані), бракує лише листа з входом —
  // неприємно, але не про втрату грошей чи доступу.
  ACCESS_OPENED_NO_EMAIL: 'warning',
  EMAIL_FAILED: 'warning',
};

/// Issue-и, про які менеджерам шлеться push (email + Telegram) із денного cron-а.
/// Вужче за «всі critical»: сюди входить лише те, де ціна мовчання — гроші клієнта
/// або цілий набір без доступу, і де система сама вже нічого не виправить.
export const PUSHED_ISSUE_KINDS: IssueKind[] = [
  'ORPHAN_RECURRING_CHARGE',
  'RECURRING_CALLBACK_SKIPPED',
  'WFP_REMOVE_FAILED',
  'LAUNCH_OVERDUE',
];

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
  TG_JOIN_DECLINED: 'Telegram: заявку на вступ відхилено',
  TG_JOIN_PENDING: 'Telegram: заявка чекає ручного підтвердження',
  TG_KICK_FAILED: 'Telegram: вилучення/ban не виконано',
  TG_USERNAME_MISSING: 'Telegram: не вказано username студента',
  SP_CLOSE_FAILED: 'SendPulse: close-access помилка',
  SP_REOPEN_FAILED: 'SendPulse: reopen-access помилка',
  ORPHAN_NO_PAYMENT: 'Цілісність: активна підписка без жодної оплати',
  ORPHAN_RECURRING_CHARGE: 'Гроші списані після закриття підписки',
  RECURRING_CALLBACK_SKIPPED: 'Автосписання не зараховано (callback пропущено)',
  REVIVED_WITH_DEBT: 'Оплата з боргом — потрібне рішення менеджера',
  WFP_REMOVE_FAILED: 'Автосписання у WayForPay не вдалося зняти',
  WFP_SCHEDULE_DRIFT: 'Графік списань WayForPay розійшовся з розкладом набору',
  WFP_RULE_NOT_ACTIVE: 'Правило автосписання у WayForPay призупинене',
  WFP_SCHEDULE_SYNC_FAILED: 'Не вдалося синхронізувати графік списань WayForPay',
  ACCESS_OPENED_NO_EMAIL: 'Доступ відкрито, але welcome-лист не пішов',
  EMAIL_FAILED: 'Лист-нагадування не доставлено',
};

/// Чи є retry-action для kind-у — впливає на UI (показ кнопки «Спробувати ще»).
/// Auto-retry-кнопки відомі: invite-link generation, cohort launch retry.
export const ISSUE_HAS_RETRY: Record<IssueKind, boolean> = {
  LAUNCH_ACCESS_FAILED: true,   // POST /cohorts/[id]/launch?retry=1
  LAUNCH_EMAIL_FAILED: false,   // через окрему "Дослати лист" модалку (per-recipient)
  LAUNCH_OVERDUE: false,        // issue на рівні набору — менеджер тисне 🚀 Запустити в шапці cohort-у
  TG_INVITE_FAILED: true,       // POST /yearly-program/[id]/telegram-invite (force=true)
  // Регенерація інвайта тут нічого не лікує: заявку вже відхилено, спершу треба виправити
  // username у підписці (найчастіша причина) — інакше наступна заявка відхилиться так само.
  TG_JOIN_DECLINED: false,
  // Заявка висить у самому Telegram — підтвердити/відхилити її можна лише в каналі.
  TG_JOIN_PENDING: false,
  TG_KICK_FAILED: false,        // одноразова дія, повторювати не варто
  TG_USERNAME_MISSING: false,   // нема з чого генерувати invite — спершу менеджер вписує нік вручну
  SP_CLOSE_FAILED: false,       // менеджер натискає "Закрити доступ" знову вручну
  SP_REOPEN_FAILED: false,      // менеджер натискає "Відкрити доступ" знову вручну
  ORPHAN_NO_PAYMENT: false,     // ручний розбір: видалити сироту або знайти втрачений платіж
  ORPHAN_RECURRING_CHARGE: false, // ручне рішення: повернути гроші або поновити підписку
  RECURRING_CALLBACK_SKIPPED: false, // ручний розбір: звірити з кабінетом WFP
  REVIVED_WITH_DEBT: false,          // рішення менеджера: «Продовжити» / «Ручна оплата» / повернення
  WFP_REMOVE_FAILED: false,          // нічний cron ретраїть сам; ручна дія — зняти правило в кабінеті WFP
  WFP_SCHEDULE_DRIFT: false,         // ручна дія — «Синхронізувати графік» у панелі підписки
  WFP_RULE_NOT_ACTIVE: false,        // виправляється лише в кабінеті WayForPay
  WFP_SCHEDULE_SYNC_FAILED: false,   // ручна дія — «Синхронізувати графік» у панелі підписки
  ACCESS_OPENED_NO_EMAIL: false,     // нічний heal досилає сам; ручна дія — «Дослати лист» у наборі
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

/// Експортовано для юніт-тестів `stateBasedIssues` — форма мінімальної вибірки полів
/// підписки, потрібних детекторам (див. `SUBSCRIPTION_SELECT`).
export interface RawSubscription {
  id: string;
  plan: 'YEARLY' | 'MONTHLY';
  status: string;
  /// Стабільна дата, яку не зсуває жоден нічний процес — на відміну від `updatedAt`.
  /// Використовується як «час виявлення» для state-based issue-ів (див. `STATE_ISSUE_ANCHOR`).
  createdAt: Date;
  updatedAt: Date;
  telegramInviteError: string | null;
  telegramUsername: string | null;
  telegramJoinedAt: Date | null;
  lastChargeError: string | null;
  failedChargeCount: number;
  lastChargeAttemptAt: Date | null;
  manuallyAddedAt: Date | null;
  sendpulseAccessOpenedAt: Date | null;
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

/// Події read-only звірки графіка WFP (`lib/yearlyProgramScheduleSync.ts` — константи
/// WFP_SCHEDULE_DRIFT_EVENT / WFP_RULE_NOT_ACTIVE_EVENT). Рядки дублюються свідомо:
/// цей модуль не має тягнути за собою WFP-клієнт. Міняти — в обох місцях одночасно.
const NIGHTLY_ECHO_EVENT_KINDS: Record<string, IssueKind> = {
  wfp_schedule_drift: 'WFP_SCHEDULE_DRIFT',
  wfp_rule_not_active: 'WFP_RULE_NOT_ACTIVE',
};

/// Вікно свіжості для таких подій: звірка пише їх раз на добу, поки проблема жива.
/// 3 доби = «сигнал був щонайменше вчора-позавчора», старіші сигнали гаснуть самі.
const NIGHTLY_ECHO_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

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
  // Legacy: до явних `*_failed` типів ми писали failure-події з type='admin_action'
  // або 'access_opened' з мітками FAILED у message. Ловимо їх по тексту.
  //
  // ⚠️ Порядок важливий: текст перевіряємо ДО трактування типу. Подія `access_opened`
  // з міткою «access open FAILED» — це провал, а не успіх; якби спершу спрацювала
  // гілка типу, така подія знімала б issue замість того, щоб його підняти.
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
    //
    // ⚠️ Порівнюємо з часом САМОЇ ПОДІЇ, а не з `Date.now()`. Резолв — це факт із минулого:
    // борг був закритий тоді, коли менеджер вносив оплату. З `Date.now()` та сама подія
    // резолвила issue сьогодні і переставала резолвити через місяць — давно розібраний
    // REVIVED_WITH_DEBT воскресав сам собою. Якщо борг виник заново, про це скаже нова
    // подія `revived_with_debt` з новішим `createdAt` — вона й підніме issue.
    if (/^Ручна оплата .*expiresAt=/i.test(e.message)) {
      const at = /expiresAt=(\d{4}-\d{2}-\d{2})/.exec(e.message)?.[1];
      const resolvedForward = !!at && new Date(`${at}T23:59:59.999Z`).getTime() > e.createdAt.getTime();
      return resolvedForward ? { kind: null, resolvesKind: 'REVIVED_WITH_DEBT' } : { kind: null };
    }
  }

  // Success events (resolve відповідного failure):
  // `access_opened` знімає і провал відкриття доступу при запуску.
  if (e.type === 'access_opened') return { kind: null, resolvesKind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_sent') return { kind: null, resolvesKind: 'LAUNCH_EMAIL_FAILED' };
  // Менеджер розібрався з боргом: «Відкрити знову» (reactivated) — доступ і дати виставлені
  // вручну. Та сама подія знімає і невдале повторне відкриття доступу в SP, і зависле
  // «не вдалось закрити» — після свідомого reopen закривати доступ уже не треба.
  // І LAUNCH_ACCESS_FAILED: адмін-дія «Відкрити доступ» пише саме `reactivated`, тобто
  // доступ у SendPulse відкритий — провал запуску по цій підписці більше не актуальний.
  if (e.type === 'reactivated') {
    return { kind: null, resolvesKind: ['REVIVED_WITH_DEBT', 'SP_REOPEN_FAILED', 'SP_CLOSE_FAILED', 'LAUNCH_ACCESS_FAILED'] };
  }

  // Доступ таки закрито (cron дотиснув наступного дня або менеджер закрив вручну) —
  // знімає попередній `access_close_failed`.
  //
  // ⚠️ Крім гілок «локального EXPIRED»: cron пише `access_closed` і тоді, коли закриття в
  // SendPulse НЕ виконувалось (studentId не знайдено / courseId не налаштований) — там
  // стоїть `metadata.spClosed = false`. Така подія НЕ резолвить issue: локальний статус
  // змінився, а платний доступ у SendPulse лишився відкритим.
  if (e.type === 'access_closed') {
    const meta = (e.metadata ?? null) as { spClosed?: boolean } | null;
    return meta?.spClosed === false ? { kind: null } : { kind: null, resolvesKind: 'SP_CLOSE_FAILED' };
  }

  // Збої SendPulse на закритті/повторному відкритті доступу. Пишуться cron-ом (крок
  // expire), рефанд-гілкою WFP-callback-а та адмін-діями. Без цього мапінгу kind-и
  // SP_CLOSE_FAILED / SP_REOPEN_FAILED були «мертвими» — подія в лозі є, у «Помилках» пусто.
  if (e.type === 'access_close_failed') return { kind: 'SP_CLOSE_FAILED' };
  if (e.type === 'access_reopen_failed') return { kind: 'SP_REOPEN_FAILED' };

  // Зняття WFP-регулярки. Успіх (ретрай cron-а дотиснув або менеджер зняв правило
  // вручну) закриває issue. Провал піднімає його лише з WFP_REMOVE_ISSUE_THRESHOLD-ї
  // спроби поспіль — лічильник пише `recordAutopayRemoveOutcome`.
  if (e.type === 'wfp_remove_succeeded') return { kind: null, resolvesKind: 'WFP_REMOVE_FAILED' };

  // Успішна синхронізація графіка (ручна кнопка, запуск, зміна дат набору) закриває
  // обидва «графікові» issue одразу: після CHANGE дати збігаються, а якщо правило було
  // призупинене — CHANGE по ньому взагалі не пройшов би.
  if (e.type === 'wfp_schedule_synced') {
    return { kind: null, resolvesKind: ['WFP_SCHEDULE_DRIFT', 'WFP_RULE_NOT_ACTIVE', 'WFP_SCHEDULE_SYNC_FAILED'] };
  }
  // Дзеркало до `wfp_schedule_synced`: спроба перенести графік у WFP не пройшла (CHANGE
  // з помилкою або REMOVE після повної оплати). Тип писався у трьох місцях, але у вибірку
  // не потрапляв і не класифікувався — подія була, у «Помилках» порожньо.
  if (e.type === 'wfp_schedule_sync_failed') return { kind: 'WFP_SCHEDULE_SYNC_FAILED' };
  if (e.type === 'wfp_remove_failed') {
    const meta = (e.metadata ?? null) as { consecutiveFailures?: number } | null;
    const streak = typeof meta?.consecutiveFailures === 'number' ? meta.consecutiveFailures : 1;
    return { kind: streak >= WFP_REMOVE_ISSUE_THRESHOLD ? 'WFP_REMOVE_FAILED' : null };
  }

  // Оплата оживила мертву підписку, але за графіком набору доступ уже вичерпано:
  // гроші зайшли, а скільки саме доступу давати — рішення менеджера (callback лише фіксує факт).
  if (e.type === 'revived_with_debt') return { kind: 'REVIVED_WITH_DEBT' };

  // Failure events (видні в активних):
  if (e.type === 'access_open_failed') return { kind: 'LAUNCH_ACCESS_FAILED' };
  if (e.type === 'launch_email_failed') return { kind: 'LAUNCH_EMAIL_FAILED' };
  // Рекурентне списання прийшло на закриту (EXPIRED/CANCELLED/ARCHIVED) підписку:
  // Payment створено і залінковано, але доступ НЕ продовжено — рішення за менеджером.
  if (e.type === 'orphan_recurring_charge') return { kind: 'ORPHAN_RECURRING_CHARGE' };

  // TG-kick events: `kickSubscriptionFromChannel` пише подію і на провалі, і на успіху.
  // Провал (непорожній `metadata.errors`) піднімає issue, успішний кік/розбан — знімає
  // його. Без resolve-гілки issue був вічним: у «Помилках» назавжди висіло побутове
  // «user not found» по людині, яку давно вилучили.
  if (e.type === 'admin_action' && e.metadata && typeof e.metadata === 'object') {
    const meta = e.metadata as { mode?: string; errors?: unknown };
    if (meta.mode === 'returnable' || meta.mode === 'permanent') {
      const failed = Array.isArray(meta.errors) && meta.errors.length > 0;
      return failed ? { kind: 'TG_KICK_FAILED' } : { kind: null, resolvesKind: 'TG_KICK_FAILED' };
    }
  }

  return { kind: null };
}

/// Скільки часу failure-подія лишається «живою проблемою». Без вікна issue висить вічно
/// навіть тоді, коли за ним ніхто ніколи не прийде: resolve-події для таких kind-ів у
/// системі немає або вона трапляється рідко.
///   • TG_KICK_FAILED — одноразова дія, повторів немає. Через місяць після невдалого кіку
///     ситуацію або розібрали вручну, або вона вже нікого не турбує.
///   • WFP_SCHEDULE_SYNC_FAILED — нічна звірка йде в read-only режимі і `wfp_schedule_synced`
///     сама не пише, тож старий провал інакше не згас би ніколи. Якщо графік і далі
///     розʼїхався — про це окремо кричить WFP_SCHEDULE_DRIFT.
const KIND_FRESHNESS_WINDOW_MS: Partial<Record<IssueKind, number>> = {
  TG_KICK_FAILED: 30 * 24 * 60 * 60 * 1000,
  WFP_SCHEDULE_SYNC_FAILED: 30 * 24 * 60 * 60 * 1000,
};

/// Час прояву для state-based issue-ів: у полях підписки часу помилки немає, а `updatedAt`
/// для цього непридатний — нічна синхронізація прогресу SendPulse
/// ([lib/certificates/syncYearlyProgress.ts](certificates/syncYearlyProgress.ts)) щодня
/// оновлює його ВСІМ живим підпискам. Заглушений issue через це щоранку ставав «свіжішим
/// за заглушення» і повертався в активні на верх списку.
///
/// Тому беремо: час відповідної події (якщо вона є) → інакше `createdAt` підписки.
/// Обидва варіанти стабільні: заглушення тримається, поки стан реально не зміниться, а
/// нова помилка приходить з новою подією і сама піднімає issue назад.
///
/// ⚠️ Відоме обмеження fallback-гілки. `createdAt` підписки завжди старіший за будь-яке
/// заглушення, тож поки нової події немає, заглушений «телеграмний» issue не повернеться
/// сам — навіть якщо мітка у `telegramInviteError` зʼявилась заново. На практиці це не
/// проблема: усі три джерела міток (генерація інвайта, decline і pending з webhook-а)
/// пишуть свою подію, тож fallback лишається тільки для історичних рядків, записаних до
/// введення подій. Нову мітку без події не додавати — issue по ній буде «німим».
function stateIssueAnchor(sub: RawSubscription, eventAt: Date | undefined): Date {
  return eventAt ?? sub.createdAt;
}

/// Північ поточної UTC-доби — `lastOccurredAt` для issue-ів, які мають самі «оживати»
/// щодня, поки умова, що їх підняла, реально не зникне. Заглушення звіряється з
/// `lastOccurredAt`: заглушене сьогодні (dismissedAt > lastOccurredAt=сьогоднішня північ)
/// лишається прихованим до кінця доби, а завтра нова північ уже пізніша за вчорашній
/// dismissedAt — issue повертається сам, без нової failure-події.
/// Використовується для TG_USERNAME_MISSING: `sub.createdAt` як якір робив би заглушення
/// вічним (createdAt завжди старіший за будь-яке dismissedAt), хоча нік так і не вписано.
export function startOfUtcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/// Спільне визначення «реальний клієнт» (не чернетка/незавершений чекаут) для всіх
/// telegram-детекторів: підписка або мала хоч один PAID-платіж, або вже в робочому статусі
/// (ACTIVE/GRACE — включно з manually-added, у яких платежу може не бути). Дублювалось між
/// `stateBasedIssues` (TG_INVITE_FAILED/TG_JOIN_*) і детектором TG_USERNAME_MISSING.
export function isRealYearlyClient(status: string, hasPaidPayment: boolean): boolean {
  return hasPaidPayment || status === 'ACTIVE' || status === 'GRACE';
}

/// Чи піднімати TG_USERNAME_MISSING: реальний клієнт (оплачений або ACTIVE/GRACE) у наборі,
/// глобальний autoAdd увімкнений, і нема ні username, ні фактичного приєднання до каналу.
/// Без username invite нікому слати — це не технічний збій, який cron сам полагодить,
/// а дірка в даних, яку може закрити лише менеджер, спитавши нік у студента.
export function shouldFlagUsernameMissing(args: {
  hasCohort: boolean;
  isRealClient: boolean;
  autoAddEnabled: boolean;
  telegramUsername: string | null;
  telegramJoinedAt: Date | null;
}): boolean {
  if (!args.hasCohort || !args.isRealClient || !args.autoAddEnabled) return false;
  if (args.telegramUsername || args.telegramJoinedAt) return false;
  return true;
}

/// Час останніх Telegram-подій підписки, з яких виводиться `lastOccurredAt` для трьох
/// «телеграмних» issue-ів (поле `telegramInviteError` часу не зберігає).
interface TelegramErrorTimes {
  inviteFailedAt?: Date;
  joinDeclinedAt?: Date;
  joinPendingAt?: Date;
}

/// Зчитує stateful-issue-и з полів підписки (час прояву — з подій, див. `stateIssueAnchor`).
export function stateBasedIssues(
  sub: RawSubscription,
  hasPaidPayment: boolean,
  tgTimes: TelegramErrorTimes | undefined,
): { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] {
  const out: { kind: IssueKind; errorExcerpt: string; lastOccurredAt: Date }[] = [];
  // Невдалий invite показуємо лише для реальних клієнтів: підписка або оплачена, або
  // вже в робочому статусі. Інакше вкладку засмічують неоплачені чернетки — прямі
  // POST-и з битим @username створюють `telegramInviteError` ще до будь-якої оплати.
  const isRealClient = isRealYearlyClient(sub.status, hasPaidPayment);
  if (!sub.telegramInviteError || !isRealClient) return out;

  // Одне поле — до трьох різних проблем з різними діями менеджера. Webhook дописує свої
  // мітки до наявного тексту, тож у полі можуть лежати і відмова Bot API, і заявка.
  const parts = splitTelegramInviteError(sub.telegramInviteError);
  if (parts.apiError) {
    const failedAt = stateIssueAnchor(sub, tgTimes?.inviteFailedAt);
    // Клієнт уже реально в каналі, і приєднався ПІСЛЯ цієї відмови (пізніший invite
    // спрацював, або approve пройшов і без свіжого success-event встиг записатись
    // legacy-рядок) — стара мітка в полі більше не описує живу проблему. Без цієї
    // перевірки 31 з 34 прод-кейсів висіли в «Помилках» попри telegramJoinedAt.
    const joinedAfterFailure = sub.telegramJoinedAt != null && sub.telegramJoinedAt > failedAt;
    if (!joinedAfterFailure) {
      out.push({
        kind: 'TG_INVITE_FAILED',
        errorExcerpt: parts.apiError.slice(0, 200),
        lastOccurredAt: failedAt,
      });
    }
  }
  if (parts.declined) {
    out.push({
      kind: 'TG_JOIN_DECLINED',
      errorExcerpt: parts.declined.slice(0, 200),
      lastOccurredAt: stateIssueAnchor(sub, tgTimes?.joinDeclinedAt),
    });
  }
  if (parts.pending) {
    out.push({
      kind: 'TG_JOIN_PENDING',
      errorExcerpt: parts.pending.slice(0, 200),
      lastOccurredAt: stateIssueAnchor(sub, tgTimes?.joinPendingAt),
    });
  }
  return out;
}

/// Поля підписки, потрібні детекторам. Один об'єкт на обидві вибірки (жива + дібраний
/// архів), щоб вони не розʼїжджались.
const SUBSCRIPTION_SELECT = {
  id: true,
  plan: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  telegramInviteError: true,
  telegramUsername: true,
  telegramJoinedAt: true,
  lastChargeError: true,
  failedChargeCount: true,
  lastChargeAttemptAt: true,
  manuallyAddedAt: true,
  sendpulseAccessOpenedAt: true,
  reminderSent3d: true,
  reminderSentOnExpiry: true,
  reminderSentGraceStart: true,
  reminderSentGraceMid: true,
  reminderSentGraceLast: true,
  reminderSentExpired: true,
  user: { select: { id: true, name: true, email: true } },
  cohort: { select: { name: true } },
} as const;

/// Події типу `admin_action` пишуть усі підряд (кожен кік, кожна заявка, кожне заглушення),
/// тож без вікна вибірка росла б назавжди. 180 днів із запасом перекривають усі детектори,
/// що на них спираються: найдовше вікно серед них — 30 днів (TG_KICK_FAILED).
const ADMIN_ACTION_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/// Виняток із вікна вище: `admin_action`-и, яких вікно НЕ стосується взагалі.
///   • «Продовжити +Nд» / «Ручна оплата» — РЕЗОЛВЕРИ REVIVED_WITH_DEBT, чия failure-подія
///     (`revived_with_debt`) вікна не має. Випади вони з вибірки — давно розібраний борг
///     воскрес би у «Помилках» рівно на 181-й день.
///   • «Extra-launch …» — навпаки, самі FAILURE-події (`Extra-launch FAILED (SendPulse)`,
///     `Extra-launch email FAILED`). Резолвляться подіями `access_opened`/`launch_email_sent`,
///     які вікна не мають; без цієї гілки НЕрозвʼязаний провал пізнього запуску просто
///     мовчки зникав з «Помилок» на 181-й день — без резолву і без сліду.
///     Успішний extra-launch пишеться типами `access_opened`/`launch_email_sent`, тож під
///     цей префікс потрапляють рівно провали.
const ADMIN_ACTION_NO_WINDOW_PREFIXES = ['Extended +', 'Ручна оплата ', 'Extra-launch'];

/// Так само поза вікном — події заявок на вступ у Telegram-канал. Вони теж пишуться типом
/// `admin_action`, а розпізнаються по `metadata.kind`, і саме з них береться час двох
/// state-based issue-ів (TG_JOIN_DECLINED / TG_JOIN_PENDING). Мітка у `telegramInviteError`
/// живе, поки її не зняли, тому й подія-джерело часу має лишатись видимою скільки завгодно.
const TG_JOIN_EVENT_KINDS = [TG_JOIN_DECLINED_EVENT_KIND, TG_JOIN_PENDING_EVENT_KIND];

/// Compat-read для заглушень, зроблених ДО розкладення «телеграмної» помилки на три kind-и.
/// Раніше і відхилена заявка, і висяча заявка жили під `TG_INVITE_FAILED` — саме його
/// менеджери й заглушували. Після розділення ті заглушення формально не підходять до нових
/// kind-ів, і на першому ж відкритті вкладки випала б пачка «нових» issue-ів по давно
/// розібраних випадках. Тому дивимось і на заглушення старого kind тієї ж підписки.
/// Міграції свідомо не робимо: старі рядки лишаються як є, читання їх покриває.
const DISMISSAL_COMPAT_FALLBACK: Partial<Record<IssueKind, IssueKind>> = {
  TG_JOIN_DECLINED: 'TG_INVITE_FAILED',
  TG_JOIN_PENDING: 'TG_INVITE_FAILED',
};

/// Межа дії compat-read вище — дата розкатки розділення kind-ів. БЕЗ неї fallback
/// застосовувався б і до СВІЖИХ заглушень: менеджер глушить відмову Bot API
/// (TG_INVITE_FAILED), а разом із нею мовчки зникає висяча заявка (TG_JOIN_PENDING) —
/// людина назавжди лишається за дверима каналу. Гірше того, «Повернути» для TG_JOIN_*
/// видаляло б 0 рядків (прямого dismissal-у не існує), тож issue не повертався б ніколи.
/// Заглушення, старші за цю дату, — історичні: там fallback і задумувався.
/// Дата = момент ДЕПЛОЮ розділення kind-ів НА ПРОД (не дата коміту): всі прод-заглушення
/// до деплою зроблені під старим єдиним kind-ом і мають покриватись fallback-ом.
/// Якщо пуш на прод зсунеться пізніше 18.08 — підняти дату до фактичного моменту деплою.
const TG_SPLIT_DEPLOYED_AT = new Date('2026-08-18T00:00:00Z');

/// Типи подій, які читають детектори (окрім `admin_action`, у якого своє вікно).
const TRACKED_EVENT_TYPES = [
  'access_open_failed',
  'launch_email_failed',
  'access_opened',
  'launch_email_sent',
  'orphan_recurring_charge',
  'revived_with_debt',
  'reactivated',
  'reminder_email_failed',
  'access_close_failed',
  // Резолвер SP_CLOSE_FAILED. Без нього kind був «мертвий»: подія `access_closed` у лозі
  // є, але у вибірку не потрапляла — і невдале закриття доступу висіло вічно.
  'access_closed',
  'access_reopen_failed',
  // Повний рефанд знімає з платежу статус PAID — саме він може заново створити стан
  // ORPHAN_NO_PAYMENT. Потрібен як «якір часу» для цього детектора (див. orphanAnchorAt).
  'refunded',
  'wfp_remove_failed',
  'wfp_remove_succeeded',
  'wfp_schedule_synced',
  'wfp_schedule_drift',
  'wfp_rule_not_active',
  'wfp_schedule_sync_failed',
  TG_INVITE_FAILED_EVENT_TYPE,
];

/// Значення `cohortId`, яким вкладка просить зріз «Без набору» — підписки з `cohortId = null`.
/// Вони існують реально (ручне додавання без набору, видалений набір, сирота після імпорту),
/// і серед них бувають найдорожчі issue-и: ORPHAN_RECURRING_CHARGE і WFP_REMOVE_FAILED, де
/// картку студента продовжують списувати. У фільтрі по конкретному набору їх не видно, тож
/// без цієї опції вони лишались видимими тільки у зрізі «Усі набори».
export const NO_COHORT_FILTER_VALUE = 'none';

export interface CollectIssuesOptions {
  /// Показати issue-и лише одного набору. `null`/`undefined` — усі набори (так працює
  /// SSR-бейдж і денні push-алерти; вкладка «Помилки» за замовчуванням просить поточний).
  /// `NO_COHORT_FILTER_VALUE` — лише підписки без набору.
  cohortId?: string | null;
}

/// Збирає всі issue-и (active + dismissed). Ефективно: один батч запитів, далі агрегація
/// в пам'яті. Не залежить від адмін-сесії — викликається з API route, який сам гейтується
/// isAdmin.
export async function collectAllIssues(options: CollectIssuesOptions = {}): Promise<IssuesPayload> {
  const rawCohortId = options.cohortId ?? null;
  /// Зріз «Без набору»: підписки з `cohortId = null`. Далі `cohortId` — це вже рівно
  /// «конкретний набір або нічого», тому решта коду не мусить знати про сентинел.
  const noCohortOnly = rawCohortId === NO_COHORT_FILTER_VALUE;
  const cohortId = noCohortOnly ? null : rawCohortId;
  /// Чи звужена вибірка взагалі (набором або зрізом «Без набору») — впливає на те, чи
  /// показувати issue-и, чиї підписки у вибірку не потрапили.
  const scopedToSubset = cohortId !== null || noCohortOnly;
  const now = new Date();
  const callbackLogSince = new Date(Date.now() - CALLBACK_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const adminActionSince = new Date(Date.now() - ADMIN_ACTION_WINDOW_MS);
  const subCohortWhere = noCohortOnly ? { cohortId: null } : (cohortId ? { cohortId } : {});
  /// Фільтр набору для дочірніх таблиць — через звʼязок з підпискою, щоб події й
  /// заглушення підтягувались рівно по тих підписках, які лишились у вибірці.
  const cohortScope = scopedToSubset ? { subscription: subCohortWhere } : {};
  const [subs, events, dismissals, paidRows, callbackLogs, overdueCohorts, tgSettings] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      where: { status: { not: 'ARCHIVED' }, ...subCohortWhere },
      select: SUBSCRIPTION_SELECT,
    }),
    /// Тягнемо тільки потенційно-релевантні події: failure-типи + success-типи
    /// для resolve-логіки. Інші типи (created/charge_success/cancelled тощо) пропускаємо.
    prisma.yearlyProgramSubscriptionEvent.findMany({
      where: {
        ...cohortScope,
        OR: [
          { type: { in: TRACKED_EVENT_TYPES } },
          { type: 'admin_action', createdAt: { gt: adminActionSince } },
          ...ADMIN_ACTION_NO_WINDOW_PREFIXES.map((prefix) => ({
            type: 'admin_action',
            message: { startsWith: prefix },
          })),
          ...TG_JOIN_EVENT_KINDS.map((kind) => ({
            type: 'admin_action',
            metadata: { path: ['kind'], equals: kind },
          })),
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
      where: cohortScope,
      select: {
        subscriptionId: true,
        kind: true,
        dismissedAt: true,
        dismissedBy: true,
        reason: true,
      },
    }),
    /// Для детектора цілісності ORPHAN_NO_PAYMENT — множина підписок, що мають хоч один
    /// PAID-платіж, який реально дає доступ. `excludedFromAccess` не рахуємо: це списання,
    /// які система свідомо не зарахувала (орфанне рекурентне після закриття підписки) —
    /// вони не роблять підписку «оплаченою» ніде більше в коді, тож і тут не мають
    /// маскувати порушення інваріанта.
    prisma.payment.findMany({
      where: { yearlyProgramSubscriptionId: { not: null }, status: 'PAID', excludedFromAccess: false },
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
    /// У зрізі «Без набору» цей детектор не має сенсу — там наборів немає за визначенням.
    noCohortOnly ? Promise.resolve([] as { id: string; name: string; startDate: Date }[]) : prisma.yearlyProgramCohort.findMany({
      where: {
        ...(cohortId ? { id: cohortId } : {}),
        startDate: { lte: now },
        endDate: { gte: now },
        launchedAt: null,
        launchScheduledFor: null,
      },
      select: { id: true, name: true, startDate: true },
      orderBy: { startDate: 'asc' },
    }),
    getYearlyProgramTelegramSettings(),
  ]);

  const paidSubIds = new Set(paidRows.map((r) => r.yearlyProgramSubscriptionId).filter(Boolean) as string[]);

  const subById = new Map<string, RawSubscription>(subs.map((s) => [s.id, s]));

  /// ARCHIVED-підписки свідомо не входять у вибірку (їхні старі failure — історія).
  /// Винятки, які треба показати менеджеру навіть в архіві:
  ///   • орфанне рекурентне списання — гроші прийшли ПІСЛЯ архівації;
  ///   • незняте автосписання у WFP — картку списують далі, попри архів.
  /// Дотягуємо такі підписки точково.
  const ARCHIVED_VISIBLE_EVENT_TYPES = new Set(['orphan_recurring_charge', 'wfp_remove_failed']);
  /// Рівно ті kind-и, заради яких архівну підписку взагалі дотягли. Решту її історії
  /// (старі TG-помилки, провали листів, борги) показувати не можна: архів на те й архів,
  /// а інакше кожен такий добір вивалював у список усі kind-и підписки минулих років.
  const ARCHIVED_VISIBLE_KINDS = new Set<IssueKind>(['ORPHAN_RECURRING_CHARGE', 'WFP_REMOVE_FAILED']);
  const orphanChargeSubIds = new Set(
    events.filter((e) => ARCHIVED_VISIBLE_EVENT_TYPES.has(e.type)).map((e) => e.subscriptionId),
  );
  const missingSubIds = [...orphanChargeSubIds].filter((id) => !subById.has(id));
  /// Підписки, яких у «живій» вибірці не було — вони тут ЛИШЕ як носії двох kind-ів вище.
  const archivedOnlySubIds = new Set(missingSubIds);
  if (missingSubIds.length > 0) {
    const archivedWithCharge = await prisma.yearlyProgramSubscription.findMany({
      where: { id: { in: missingSubIds } },
      select: SUBSCRIPTION_SELECT,
    });
    for (const s of archivedWithCharge) subById.set(s.id, s);
  }

  // Мапа: subId → kind → найсвіжіший resolved-час (з success-events).
  const resolvedAt = new Map<string, Map<IssueKind, Date>>();
  // Мапа: subId → kind → { latestFailureAt, occurrenceCount, latestErrorExcerpt }
  const failureAgg = new Map<string, Map<IssueKind, { latestAt: Date; count: number; excerpt: string | null }>>();
  /// Час останніх Telegram-подій — джерело `lastOccurredAt` для трьох state-based
  /// «телеграмних» issue-ів. `events` відсортовані desc, тож перше влучання і є найсвіжіше.
  const tgErrorTimes = new Map<string, TelegramErrorTimes>();
  const rememberTgTime = (subId: string, field: keyof TelegramErrorTimes, at: Date) => {
    let rec = tgErrorTimes.get(subId);
    if (!rec) { rec = {}; tgErrorTimes.set(subId, rec); }
    if (!rec[field]) rec[field] = at;
  };
  /// Найсвіжіша подія, яка могла ЗАНОВО створити стан «статус є, оплати немає»:
  /// видалення платежу, виключення платежу з доступу, повний рефанд. Це «якір часу»
  /// для ORPHAN_NO_PAYMENT — без нього issue брав `sub.createdAt`, який завжди старіший
  /// за будь-яке заглушення, і одного разу заглушений kind не повертався НІКОЛИ, навіть
  /// коли менеджер сьогодні видалив останній платіж живої підписки.
  const orphanAnchorAt = new Map<string, Date>();

  for (const e of events) {
    {
      const meta = (e.metadata ?? null) as { paymentDeleted?: unknown; paymentAccess?: unknown } | null;
      const isOrphanTrigger = e.type === 'refunded'
        || (typeof meta === 'object' && meta !== null && (meta.paymentDeleted === true || meta.paymentAccess === true));
      if (isOrphanTrigger) {
        const prev = orphanAnchorAt.get(e.subscriptionId);
        if (!prev || e.createdAt > prev) orphanAnchorAt.set(e.subscriptionId, e.createdAt);
      }
    }
    if (e.type === TG_INVITE_FAILED_EVENT_TYPE) {
      rememberTgTime(e.subscriptionId, 'inviteFailedAt', e.createdAt);
    } else if (e.type === 'admin_action' && e.metadata && typeof e.metadata === 'object') {
      const metaKind = (e.metadata as { kind?: unknown }).kind;
      if (metaKind === TG_JOIN_DECLINED_EVENT_KIND) rememberTgTime(e.subscriptionId, 'joinDeclinedAt', e.createdAt);
      else if (metaKind === TG_JOIN_PENDING_EVENT_KIND) rememberTgTime(e.subscriptionId, 'joinPendingAt', e.createdAt);
    }

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

  const lookupDismissal = (subId: string, kind: IssueKind): RawDismissal | undefined => {
    const direct = dismissalMap.get(dismissalKey(subId, kind));
    if (direct) return direct;
    const fallbackKind = DISMISSAL_COMPAT_FALLBACK[kind];
    if (!fallbackKind) return undefined;
    const legacy = dismissalMap.get(dismissalKey(subId, fallbackKind));
    // Compat лише для ІСТОРИЧНИХ заглушень (див. TG_SPLIT_DEPLOYED_AT). Свіже заглушення
    // TG_INVITE_FAILED не має ховати сусідні TG_JOIN_*.
    return legacy && legacy.dismissedAt < TG_SPLIT_DEPLOYED_AT ? legacy : undefined;
  };

  // Збираємо event-based issues.
  const records: IssueRecord[] = [];
  for (const [subId, kindMap] of failureAgg) {
    const sub = subById.get(subId);
    if (!sub || !sub.user) continue;
    for (const [kind, agg] of kindMap) {
      // Архівну підписку дотягли заради конкретних kind-ів — решту її історії не показуємо.
      if (archivedOnlySubIds.has(subId) && !ARCHIVED_VISIBLE_KINDS.has(kind)) continue;
      // Resolve check: якщо є success-подія цього kind після останнього failure → пропускаємо.
      const successAt = resolvedAt.get(subId)?.get(kind);
      if (successAt && successAt > agg.latestAt) continue;
      // Вікно свіжості (для kind-ів, які самі по собі ніколи не «розсмоктуються»).
      const window = KIND_FRESHNESS_WINDOW_MS[kind];
      if (window && now.getTime() - agg.latestAt.getTime() > window) continue;

      const dismissal = lookupDismissal(subId, kind);
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
    for (const stateIssue of stateBasedIssues(sub, paidSubIds.has(sub.id), tgErrorTimes.get(sub.id))) {
      if (haveEventRecord.has(`${sub.id}::${stateIssue.kind}`)) continue;
      const dismissal = lookupDismissal(sub.id, stateIssue.kind);
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

  // Детектор TG_USERNAME_MISSING: реальний клієнт у наборі з увімкненим autoAdd, без
  // username і без факту приєднання — invite нема кому генерувати, менеджер має спитати
  // нік у студента і вписати його через «Редагувати». Без retry-кнопки: авто тут нічого
  // не полагодить.
  for (const sub of subs) {
    if (!sub.user) continue;
    const isRealClient = isRealYearlyClient(sub.status, paidSubIds.has(sub.id));
    const flag = shouldFlagUsernameMissing({
      hasCohort: sub.cohort != null,
      isRealClient,
      autoAddEnabled: tgSettings.autoAdd,
      telegramUsername: sub.telegramUsername,
      telegramJoinedAt: sub.telegramJoinedAt,
    });
    if (!flag) continue;
    if (haveEventRecord.has(`${sub.id}::TG_USERNAME_MISSING`)) continue;
    const dismissal = lookupDismissal(sub.id, 'TG_USERNAME_MISSING');
    records.push({
      subscriptionId: sub.id,
      sourceId: null,
      kind: 'TG_USERNAME_MISSING',
      // Північ поточної доби, не sub.createdAt — інакше заглушення тримало б issue
      // прихованим НАЗАВЖДИ, навіть коли username так і не вписали (createdAt завжди
      // старіший за dismissedAt). З північчю заглушене сьогодні саме повернеться завтра.
      lastOccurredAt: startOfUtcDay(now).toISOString(),
      occurrenceCount: 1,
      errorExcerpt: 'Не вказано Telegram — запросити нік і вписати через Редагувати.',
      user: sub.user,
      plan: sub.plan,
      cohortName: sub.cohort?.name ?? null,
      dismissedAt: dismissal?.dismissedAt.toISOString() ?? null,
      dismissedBy: dismissal?.dismissedBy ?? null,
      dismissedReason: dismissal?.reason ?? null,
    });
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
    const dismissal = lookupDismissal(sub.id, 'ORPHAN_NO_PAYMENT');
    // Якір часу = найпізніше з двох: створення підписки і остання подія, яка могла ЗАНОВО
    // забрати в неї оплату (видалення платежу / виключення з доступу / повний рефанд).
    // `updatedAt` тут не годиться взагалі — його щоночі зсуває синхронізація прогресу
    // SendPulse, і заглушений issue щоранку повертався б у активні. Але й самого лише
    // `createdAt` замало: він завжди старіший за будь-яке заглушення, тож раз заглушений
    // kind не повертався НІКОЛИ — навіть коли менеджер сьогодні видалив останній платіж.
    const orphanAnchor = orphanAnchorAt.get(sub.id);
    const orphanAt = orphanAnchor && orphanAnchor > sub.createdAt ? orphanAnchor : sub.createdAt;
    records.push({
      subscriptionId: sub.id,
      sourceId: null,
      kind: 'ORPHAN_NO_PAYMENT',
      lastOccurredAt: orphanAt.toISOString(),
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
      if (archivedOnlySubIds.has(subId)) continue;
      // Лишаємо тільки нерозвʼязані листи: прапорець true → лист таки пішов наступного
      // проходу. Одна картка на підписку — за найсвіжішим із «живих» фейлів, сумарна
      // кількість повторень по всіх них.
      const unresolved = [...perFlag.entries()].filter(([flag]) => reminderFlagValue(sub, flag) === false);
      if (unresolved.length === 0) continue;
      const agg = unresolved
        .map(([, v]) => v)
        .reduce((best, v) => (v.latestAt > best.latestAt ? v : best));
      const totalCount = unresolved.reduce((sum, [, v]) => sum + v.count, 0);
      const dismissal = lookupDismissal(subId, 'EMAIL_FAILED');
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

  // Детектори «нічного відлуння»: WFP_SCHEDULE_DRIFT і WFP_RULE_NOT_ACTIVE.
  // Ці події пише READ-ONLY звірка графіка (`lib/yearlyProgramScheduleSync.ts`) не частіше
  // разу на добу, поки проблема жива. Тому issue активний лише поки остання подія свіжа:
  // щойно звірка перестала її писати (менеджер синхронізував графік, правило ожило або
  // регулярку зняли) — картка зникає сама, без ручного «заглушити».
  {
    const echoSince = new Date(Date.now() - NIGHTLY_ECHO_WINDOW_MS);
    const echoAgg = new Map<string, Map<IssueKind, { latestAt: Date; count: number; excerpt: string | null }>>();
    for (const e of events) {
      const kind = NIGHTLY_ECHO_EVENT_KINDS[e.type];
      if (!kind) continue;
      if (e.createdAt < echoSince) continue;
      let perKind = echoAgg.get(e.subscriptionId);
      if (!perKind) { perKind = new Map(); echoAgg.set(e.subscriptionId, perKind); }
      const prev = perKind.get(kind);
      const excerpt = e.message?.slice(0, 200) ?? null;
      if (!prev) {
        perKind.set(kind, { latestAt: e.createdAt, count: 1, excerpt });
      } else {
        prev.count += 1;
        if (e.createdAt > prev.latestAt) {
          prev.latestAt = e.createdAt;
          prev.excerpt = excerpt;
        }
      }
    }

    for (const [subId, perKind] of echoAgg) {
      const sub = subById.get(subId);
      if (!sub || !sub.user) continue;
      if (archivedOnlySubIds.has(subId)) continue;
      for (const [kind, agg] of perKind) {
        // Успішний sync після останнього сигналу — проблеми вже немає.
        const successAt = resolvedAt.get(subId)?.get(kind);
        if (successAt && successAt > agg.latestAt) continue;
        const dismissal = lookupDismissal(subId, kind);
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
  }

  // Детектор ACCESS_OPENED_NO_EMAIL: доступ у SendPulse відкрито, а welcome-листа з
  // входом людина так і не отримала (масова розсилка її пропустила / лист впав /
  // extra-launch відкрив доступ, але відправка не вдалася). Студент оплатив і формально
  // «в програмі», але не знає ні що навчання почалось, ні куди заходити.
  // Резолв автоматичний: щойно з'явиться подія `launch_email_sent` — issue зникає.
  {
    const emailSentSubIds = new Set(
      events.filter((e) => e.type === 'launch_email_sent').map((e) => e.subscriptionId),
    );
    const noEmailCutoff = new Date(Date.now() - ACCESS_OPENED_NO_EMAIL_MIN_AGE_MS);
    for (const sub of subs) {
      if (!sub.user) continue;
      // Лише живі підписки в наборі: welcome-лист прив'язаний до cohort-шаблону, а для
      // EXPIRED/CANCELLED досилати «вітаємо в програмі» вже безглуздо.
      if (sub.status !== 'ACTIVE' && sub.status !== 'GRACE') continue;
      if (!sub.cohort) continue;
      if (!sub.sendpulseAccessOpenedAt || sub.sendpulseAccessOpenedAt > noEmailCutoff) continue;
      if (emailSentSubIds.has(sub.id)) continue;
      if (haveEventRecord.has(`${sub.id}::ACCESS_OPENED_NO_EMAIL`)) continue;
      const dismissal = lookupDismissal(sub.id, 'ACCESS_OPENED_NO_EMAIL');
      records.push({
        subscriptionId: sub.id,
        sourceId: null,
        kind: 'ACCESS_OPENED_NO_EMAIL',
        lastOccurredAt: sub.sendpulseAccessOpenedAt.toISOString(),
        occurrenceCount: 1,
        errorExcerpt: `Доступ відкрито ${sub.sendpulseAccessOpenedAt.toISOString().slice(0, 10)}, події launch_email_sent немає.`,
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
      // Фільтр набору: розпізнаний лог показуємо лише якщо його підписка є у вибірці.
      // Нерозпізнані (без підписки взагалі) лишаємо завжди — це живі гроші, які ніде
      // більше не видно, і сховати їх через фільтр набору означало б їх втратити.
      if (scopedToSubset && group.subscriptionId && !sub) continue;
      const dismissal = group.subscriptionId
        ? lookupDismissal(group.subscriptionId, 'RECURRING_CALLBACK_SKIPPED')
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
