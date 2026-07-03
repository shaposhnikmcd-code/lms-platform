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
///   01.10 → 01.11 → 01.12... від дати старту. Оплата РАНІШЕ чи ПІЗНІШЕ дедлайну графік
///   НЕ зсуває — платіж «займає» свій слот (сплатив 20.09 = начебто сплатив 01.10).
/// — MONTHLY після повної сплати всіх totalMonthlyPayments → cohort.endDate + postAccessMonths
///   (та сама логіка що й YEARLY — повноцінний доступ + пост-доступ).
/// — Без cohort (legacy) → стара поведінка: yearlyDurationDays/monthlyDurationDays від оплати.

import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/// Додає `months` календарних місяців до дати, клемпуючи день до останнього дня
/// цільового місяця (31.05 + 6 міс = 30.11, а не 1.12). Час доби зберігається.
function addCalendarMonths(date: Date, months: number): Date {
  if (!months) return new Date(date);
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTarget));
  return result;
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
