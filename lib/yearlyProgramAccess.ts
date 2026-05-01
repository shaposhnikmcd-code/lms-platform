/// Розрахунок доступу до Річної програми. Single source of truth — використовується
/// з WFP callback (при кожній оплаті), при запуску cohort, при перенесенні підписки
/// в інший cohort, при cron-у sync.
///
/// Правила (узгоджені 2026-05-01):
/// — YEARLY → expiresAt = cohort.endDate (фікс на весь період програми незалежно від часу оплати).
/// — MONTHLY до старту cohort → cohort.startDate + N×30 днів, де N = успішних PAID платежів.
/// — MONTHLY автоплатіж після старту cohort → перший платіж + N×30 днів. WFP-регулярка
///   обмежується останнім повним місяцем до cohort.endDate (залишок днів — менеджер вручну).
/// — MONTHLY разова після старту cohort → дата платежу + 30 днів.
/// — Без cohort (legacy) → стара поведінка: yearlyDurationDays/monthlyDurationDays від оплати.

import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CohortLike {
  startDate: Date;
  endDate: Date;
}

export interface PaymentLike {
  amount: number;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

export type Plan = 'YEARLY' | 'MONTHLY';

/// Підрахунок успішних PAID платежів з валідними paidAt. Платежі без paidAt
/// (race-у callback-у) використовують createdAt як fallback.
function paidPaymentDates(payments: PaymentLike[]): Date[] {
  return payments
    .filter((p) => p.status === 'PAID')
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

  // YEARLY завжди = endDate cohort.
  if (args.plan === 'YEARLY') {
    return args.cohort.endDate;
  }

  // MONTHLY: береться first paid → визначає anchor (cohort.startDate vs paidAt).
  const firstPaid = paymentDates[0]!;
  const cohortStart = args.cohort.startDate;
  const cohortEnd = args.cohort.endDate;
  const paidCount = paymentDates.length;

  // Якщо перша оплата ДО старту cohort — anchor = cohort.startDate (всі покупці чекають старту).
  // Якщо ПІСЛЯ — anchor = першої оплати (доступ від моменту платежу).
  const anchor = firstPaid < cohortStart ? cohortStart : firstPaid;
  const expires = new Date(anchor.getTime() + paidCount * 30 * MS_PER_DAY);

  // Hard cap: для autoRenew експайр не може перевалити cohort.endDate (запасний контроль —
  // основне обмеження на стороні WFP через dateEnd регулярки). Для разової — теж кеп.
  // Якщо обчислений expires виходить за endDate → клемпимо до endDate. Залишок — manual.
  if (expires > cohortEnd) {
    return cohortEnd;
  }
  return expires;
}

/// Дата останнього автосписання WFP-регулярки, щоб доступ не виходив за cohort.endDate.
/// Використовується для встановлення `dateEnd` у buildRegularPurchaseFlags.
///
/// Логіка: знаючи, що кожне списання дає +30 днів, останній платіж має бути таким, щоб
/// access (lastCharge + 30 днів) ≤ cohortEndDate. Тобто lastCharge ≤ cohortEndDate − 30 днів.
/// Регулярка списує помісячно з anchor-у — приймаємо anchor = firstPaymentDate і додаємо
/// рівно стільки місяців, щоб не вийти за межу.
export function lastAutopayChargeDate(args: {
  firstPaymentDate: Date;
  cohortEndDate: Date;
}): Date {
  const cap = new Date(args.cohortEndDate.getTime() - 30 * MS_PER_DAY);
  const candidate = new Date(args.firstPaymentDate);
  // Поки додавання ще одного місяця не виходить за cap — додаємо.
  // Стартуємо з 0 додаткових місяців (тобто перший платіж = останній, що небажано),
  // тому додаємо мінімум 1 і збільшуємо допоки можна.
  const result = new Date(args.firstPaymentDate);
  for (let i = 1; i <= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments - 1; i++) {
    const next = new Date(args.firstPaymentDate);
    next.setMonth(next.getMonth() + i);
    if (next > cap) break;
    result.setTime(next.getTime());
  }
  // Якщо firstPaymentDate сам уже після cap — взагалі не маємо що автосписувати; повертаємо
  // дату першого платежу (WFP regularApi прийме її як останню, регулярка не запуститься).
  void candidate;
  return result;
}

/// Скільки списань (включно з першим Purchase) може реально пройти, поки доступ не вийде
/// за cohort.endDate. Використовується для коректного `totalPayments` у WFP flags.
export function maxAutopayChargeCount(args: {
  firstPaymentDate: Date;
  cohortEndDate: Date;
}): number {
  // Перший платіж — це 1 (Purchase). Далі додаємо по 1 за кожен місяць, що влазить.
  let count = 1;
  for (let i = 1; i <= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments - 1; i++) {
    const next = new Date(args.firstPaymentDate);
    next.setMonth(next.getMonth() + i);
    // Платіж на дату X дає доступ до X+30. Якщо X+30 > cohortEndDate — цей платіж зайвий.
    const accessEnd = new Date(next.getTime() + 30 * MS_PER_DAY);
    if (accessEnd > args.cohortEndDate) break;
    count++;
  }
  return count;
}
