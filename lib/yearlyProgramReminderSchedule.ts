/// Чисті правила розкладу manual-нагадувань Річної (разова місячна оплата, autoRenew=false)
/// і старту пільгового періоду. Живуть окремо від cron-а, щоб їх можна було покрити
/// `node:test` без бази: cron лише читає звідси «чи час» і «який саме лист».
///
/// «День закінчення» — київська календарна доба, у яку потрапляє `expiresAt` (для набору 2026
/// це 5-те число: expiresAt = 5-те 00:00 UTC = 03:00 Київ). Добовий прохід cron-а — 07:00 Київ.
///   • за 3 дні     — `expiresAt <= now + 3 доби` (2-ге число);
///   • за 1 день    — `expiresAt < початок київської доби «післязавтра»` (4-те: завтра останній день);
///   • останній день — `expiresAt < початок київської доби «завтра»` (5-те).
/// Нижньої межі в жодного вікна немає: пропущений прохід cron-а не має з'їдати лист назавжди,
/// від дублів захищають прапорці `reminderSent*` (атомарний claim у cron-і).

import { kyivMidnightUtc } from './timezone';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ManualReminderKind = 'before3d' | 'before1d' | 'onExpiry';

/// Порядок «за змістом»: пізніший лист робить ранішій зайвим. Людина, якій сьогодні вже
/// «останній день», не має отримати поряд ще й «через 3 дні завершується».
const MANUAL_ORDER: ManualReminderKind[] = ['before3d', 'before1d', 'onExpiry'];

/// Верхня межа вибірки «за 3 дні» (включно).
export function manualBefore3dWindowEnd(now: Date): Date {
  return new Date(now.getTime() + 3 * DAY_MS);
}

/// Верхня межа вибірки «за 1 день» (строго менше): початок київської доби післязавтра.
/// Підписка, що спливає будь-коли протягом завтрашньої київської доби або раніше, — у вікні.
export function manualBefore1dCutoff(now: Date): Date {
  return kyivMidnightUtc(now, 2);
}

/// Верхня межа вибірки «останній день» (строго менше): початок київської доби завтра.
export function manualOnExpiryCutoff(now: Date): Date {
  return kyivMidnightUtc(now, 1);
}

/// Які manual-листи «дозріли» на цей момент (без урахування прапорців).
export function dueManualReminders(expiresAt: Date, now: Date): ManualReminderKind[] {
  const t = expiresAt.getTime();
  const due: ManualReminderKind[] = [];
  if (t <= manualBefore3dWindowEnd(now).getTime()) due.push('before3d');
  if (t < manualBefore1dCutoff(now).getTime()) due.push('before1d');
  if (t < manualOnExpiryCutoff(now).getTime()) due.push('onExpiry');
  return due;
}

/// Гарантія «один студент — один manual-лист за прохід»: із листів, що дозріли одночасно
/// (нова підписка з близьким expiresAt, пропущені проходи cron-а), іде лише найпізніший
/// за змістом. Решта вважаються спожитими — cron ставить їм прапорці без відправки.
/// `null` — жоден лист ще не дозрів.
export function pickManualReminder(expiresAt: Date, now: Date): ManualReminderKind | null {
  const due = dueManualReminders(expiresAt, now);
  for (let i = MANUAL_ORDER.length - 1; i >= 0; i--) {
    if (due.includes(MANUAL_ORDER[i])) return MANUAL_ORDER[i];
  }
  return null;
}

/// Що робить крок `kind` із конкретною підпискою в цьому проході:
///   'send'       — це найпізніший дозрілий лист, шлемо;
///   'supersede'  — лист дозрів, але цим проходом піде пізніший: ставимо прапорець без листа;
///   'skip'       — лист ще не дозрів.
export function manualStepAction(
  kind: ManualReminderKind,
  expiresAt: Date,
  now: Date,
): 'send' | 'supersede' | 'skip' {
  const due = dueManualReminders(expiresAt, now);
  if (!due.includes(kind)) return 'skip';
  return pickManualReminder(expiresAt, now) === kind ? 'send' : 'supersede';
}

/// Мінімальна тривалість grace (у днях, зафіксована в підписці), за якої взагалі є сенс
/// у листі «пільговий період почався». При 1 дні підписка переходить у GRACE тим самим
/// ранковим проходом, що й лист «сьогодні останній день», а наступний ранковий прохід уже
/// закриває доступ і шле лист про закриття. «Доступ продовжено» між ними — лише плутанина.
export const GRACE_START_MIN_SPAN_DAYS = 2;

/// Нижче цієї тривалості grace-start шлеться одразу, без гейту «день +1»: mid/last
/// вимкнені, а закриття настає раніше за наступний прохід.
export const GRACE_START_DELAY_MIN_SPAN_DAYS = 3;

/// Гейт «день +1» (20 год, а не 24 — щоб лист гарантовано пішов наступним добовим проходом,
/// навіть якщо той трохи «плаває» в часі).
export const GRACE_START_MIN_AGE_MS = 20 * 60 * 60 * 1000;

/// Рішення кроку `grace_start` для однієї підписки:
///   'suppress' — разова оплата (manual) і grace коротший за 2 дні: лист не шлемо ніколи,
///                прапорець ставимо. Автоплатіж (cyclical) сюди не потрапляє: його лист
///                «списання не пройшло» — єдине попередження перед закриттям, і глушити
///                його не можна (автоплатіжний флоу цим правилом свідомо не змінюється);
///   'wait'     — ще не минула доба від переходу в GRACE;
///   'send'     — час слати.
export function graceStartDecision(
  spanDays: number,
  graceStartedAt: Date | null,
  now: Date,
  isManual: boolean,
): 'suppress' | 'wait' | 'send' {
  if (isManual && spanDays < GRACE_START_MIN_SPAN_DAYS) return 'suppress';
  if (
    spanDays >= GRACE_START_DELAY_MIN_SPAN_DAYS
    && graceStartedAt
    && graceStartedAt.getTime() > now.getTime() - GRACE_START_MIN_AGE_MS
  ) return 'wait';
  return 'send';
}

/// Чому автоплатник опинився в GRACE — від цього залежить перше речення його листа.
///   'charge_failed' — WFP повідомив про неуспішне списання (`failedChargeCount > 0`);
///   'no_rule'       — правила регулярки у WFP немає (`wfpRegularRef == null`): зняли,
///                     не створилось при токенізації, підписку переносили;
///   'not_charged'   — правило є і відмов не було, але оплата за графіком не надійшла
///                     (найчастіше графік у WFP зсунуто за кінець оплаченого модуля).
/// Порядок перевірок — від найконкретнішої причини: відмова банку важливіша за
/// відсутність правила (після відмови WFP міг правило й призупинити).
export type AutopayGraceReason = 'charge_failed' | 'no_rule' | 'not_charged';

export function autopayGraceReason(sub: {
  failedChargeCount: number | null;
  wfpRegularRef: string | null;
}): AutopayGraceReason {
  if ((sub.failedChargeCount ?? 0) > 0) return 'charge_failed';
  if (sub.wfpRegularRef === null) return 'no_rule';
  return 'not_charged';
}
