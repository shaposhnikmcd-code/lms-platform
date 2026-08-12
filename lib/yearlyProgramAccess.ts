/// Розрахунок доступу до Річної програми. Single source of truth — використовується
/// з WFP callback (при кожній оплаті), при запуску cohort, при перенесенні підписки
/// в інший cohort, при cron-у sync.
///
/// Правила (узгоджені 2026-05-01, оновлені 2026-06-03 — пост-доступ; 2026-07-03 — календарний графік):
/// — Дата завершення доступу базується на cohort.endDate + `postAccessMonths` місяців
///   доступу до платформи ПІСЛЯ завершення програми (напр. 31.05.2027 + 6 міс = 30.11.2027).
/// — YEARLY → expiresAt = cohort.endDate + postAccessMonths (фікс на весь період + пост-доступ).
/// — MONTHLY до повної сплати → anchor + N КАЛЕНДАРНИХ місяців (N = успішних PAID), кеп
///   cohort.endDate. Графік платежів жорсткий і однаковий для разових та автоплатежу:
///   для набору зі стартом 01.09 це 01.09 → 01.10 → 01.11... Оплата РАНІШЕ чи ПІЗНІШЕ
///   дедлайну графік НЕ зсуває — платіж «займає» свій слот (сплатив 20.08, до старту, —
///   начебто сплатив 01.09).
/// — MONTHLY після повної сплати всіх totalMonthlyPayments → cohort.endDate + postAccessMonths
///   (та сама логіка що й YEARLY — повноцінний доступ + пост-доступ).
/// — Без cohort (legacy) → стара поведінка: yearlyDurationDays/monthlyDurationDays від оплати.

import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/// Додає `months` календарних місяців до дати, клемпуючи день до останнього дня
/// цільового місяця (31.05 + 6 міс = 30.11, а не 1.12; 31.10 + 1 міс = 30.11).
/// Час доби зберігається.
///
/// SINGLE SOURCE OF TRUTH для «плюс N місяців» у всій Річній програмі: доступ,
/// графік WFP-регулярки, звірка графіка, валідація дат набору. Не дублювати formulu —
/// імпортувати звідси (винятки, які фізично не можуть імпортувати TS, перелічені
/// в коментарях біля своїх копій).
///
/// UTC-геттери свідомо: дати набору зберігаються як UTC-інстанти (00:00:00Z старт,
/// 23:59:59.999Z кінець доби). З локальними геттерами на машині у UTC+3 дата
/// «31.05.2027 23:59:59.999Z» читалась би як 1 червня — і клемп місяця з'їжджав би
/// на добу. На Vercel (UTC) різниці немає, тож поведінка проду не змінюється.
export function addCalendarMonths(date: Date, months: number): Date {
  if (!months) return new Date(date);
  const day = date.getUTCDate();
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTarget = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTarget));
  return result;
}

/// Кінець доби (23:59:59.999 UTC) — межа набору включає останній день цілком.
/// Застосовується і до вже збережених рядків, у яких endDate лежить як 00:00Z:
/// без цього останній місячний слот «не влазив» і графік коротшав на списання.
export function endOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export interface CohortLike {
  startDate: Date;
  endDate: Date;
}

export interface PaymentLike {
  amount: number;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  /// true — платіж зафіксовано як факт списання, але в доступ він НЕ йде
  /// (orphan-списання по закритій підписці, понад ліміт місяців, розбіжність суми).
  /// Поле опційне: синтетичні платежі в guard-ах і старі виклики його не передають,
  /// `undefined` читається як «звичайний платіж».
  excludedFromAccess?: boolean | null;
}

export type Plan = 'YEARLY' | 'MONTHLY';

/// Підрахунок успішних PAID платежів з валідними paidAt. Платежі без paidAt
/// (race-у callback-у) використовують createdAt як fallback.
///
/// `excludedFromAccess` відсіюється тут — у ЄДИНОМУ місці, де PAID-платежі
/// перетворюються на місяці доступу. Інакше orphan-списання (записане саме тому, що
/// система відмовилась продовжувати доступ) при найближчому перерахунку тихо
/// додавало б людині місяць — і відмова скасовувала б сама себе.
function paidPaymentDates(payments: PaymentLike[]): Date[] {
  return payments
    .filter((p) => p.status === 'PAID' && !p.excludedFromAccess)
    .map((p) => p.paidAt ?? p.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
}

/// Розрахунок expiresAt для підписки з огляду на cohort. Без cohort — fallback на legacy.
export function calculateAccessUntil(args: {
  plan: Plan;
  autoRenew: boolean;
  cohort: CohortLike | null;
  payments: PaymentLike[];
  /// Дата нового платежу, який ще НЕ записаний у `payments` (для in-tx розрахунків
  /// у WFP callback). Якщо null — рахуємо тільки з payments.
  newPaymentAt?: Date | null;
  /// Місяців доступу до платформи після cohort.endDate. Default 0 (без пост-доступу).
  /// Передається з runtime-налаштування (getYearlyPostAccessMonths).
  postAccessMonths?: number;
}): Date | null {
  const paymentDates = paidPaymentDates(args.payments);
  if (args.newPaymentAt) {
    paymentDates.push(args.newPaymentAt);
    paymentDates.sort((a, b) => a.getTime() - b.getTime());
  }

  if (paymentDates.length === 0) return null;

  // Без cohort — стара логіка (legacy/без-cohort підписка).
  if (!args.cohort) {
    const last = paymentDates[paymentDates.length - 1]!;
    const days = args.plan === 'YEARLY'
      ? YEARLY_PROGRAM_CONFIG.yearlyDurationDays
      : YEARLY_PROGRAM_CONFIG.monthlyDurationDays;
    return new Date(last.getTime() + days * MS_PER_DAY);
  }

  // Дата завершення доступу = cohort.endDate + N місяців пост-доступу до платформи.
  const months = args.postAccessMonths ?? 0;
  const accessEnd = addCalendarMonths(args.cohort.endDate, months);

  // YEARLY завжди = endDate cohort + пост-доступ.
  if (args.plan === 'YEARLY') {
    return accessEnd;
  }

  // MONTHLY: береться first paid → визначає anchor (cohort.startDate vs paidAt).
  const firstPaid = paymentDates[0]!;
  const cohortStart = args.cohort.startDate;
  const cohortEnd = args.cohort.endDate;
  const paidCount = paymentDates.length;

  // Повна сплата всіх місячних платежів → той самий повний доступ що й YEARLY (з пост-доступом).
  if (paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
    return accessEnd;
  }

  // Якщо перша оплата ДО старту cohort — anchor = cohort.startDate (всі покупці чекають старту).
  // Якщо ПІСЛЯ — anchor = першої оплати (доступ від моменту платежу).
  // Слоти — КАЛЕНДАРНІ місяці від anchor (01.10 → 01.11 → ...), день клемпується
  // (31.10 + 1 міс = 30.11). Момент фактичної оплати на графік не впливає.
  const anchor = firstPaid < cohortStart ? cohortStart : firstPaid;
  const expires = addCalendarMonths(anchor, paidCount);

  // Часткова сплата: hard cap на cohort.endDate (пост-доступ ще не нараховуємо — він
  // вмикається лише після повної оплати, рядок вище). Залишок до повного — manual.
  if (expires > cohortEnd) {
    return cohortEnd;
  }
  return expires;
}

/// Скільки списань (включно з першим Purchase) вміщується між першим платежем і кінцем
/// набору. Слоти — КАЛЕНДАРНІ місяці (та сама сітка, що й у calculateAccessUntil), а не
/// «по 30 днів»: 30-денне наближення дрейфує (9 × 30 = 270 днів проти 273 у 9 місяців)
/// і з'їдало останні слоти на довгих наборах.
///
/// Слот `i` (0-based) списується `anchor + i місяців` і покриває доступ до
/// `anchor + (i+1) місяців − 1 день`. Слот рахується, лише якщо весь його місяць влазить
/// у набір: `покриття ≤ кінець доби endDate`.
///
/// Приклади (anchor 01.09.2026): endDate 31.05.2027 → 9; endDate 30.05.2027 → 8;
/// anchor 15.09.2026 + endDate 31.05.2027 → 8 (списання по 15-х числах).
export function maxAutopayChargeCount(args: {
  firstPaymentDate: Date;
  cohortEndDate: Date;
}): number {
  const fits = countMonthlySlots(
    args.firstPaymentDate,
    args.cohortEndDate,
    YEARLY_PROGRAM_CONFIG.totalMonthlyPayments,
  );
  // Перший платіж (Purchase) відбувається завжди, навіть якщо його місяць вилазить за
  // межу набору — інакше повернули б 0 списань на реальну оплату.
  return Math.max(1, fits);
}

/// Скільки повних календарних місячних слотів від `anchor` вміщується до `until`
/// (включно з останнім днем: межа — кінець доби). Слот `i` покриває доступ до
/// `anchor + (i+1) місяців − 1 день`.
/// Базова лічилка сітки — на ній стоять і графік списань, і валідація дат набору.
export function countMonthlySlots(anchor: Date, until: Date, maxSlots = 240): number {
  const limit = endOfUtcDay(until);
  let n = 0;
  while (n < maxSlots) {
    const coveredUntil = new Date(addCalendarMonths(anchor, n + 1).getTime() - MS_PER_DAY);
    if (coveredUntil > limit) break;
    n++;
  }
  return n;
}

/// Дата останнього автосписання WFP-регулярки, щоб графік не виходив за cohort.endDate.
/// Використовується для `dateEnd` у buildRegularPurchaseFlags. Та сама календарна сітка,
/// що й `maxAutopayChargeCount`: останнє списання = anchor + (кількість слотів − 1) місяців.
export function lastAutopayChargeDate(args: {
  firstPaymentDate: Date;
  cohortEndDate: Date;
}): Date {
  const count = maxAutopayChargeCount(args);
  return addCalendarMonths(args.firstPaymentDate, count - 1);
}
