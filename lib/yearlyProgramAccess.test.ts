/// Юніт-тести сітки модулів Річної програми: доступ, кількість слотів, графік WFP.
/// Запуск: `npm run test:access` (або `npm test` разом з тестами видимості).
///
/// Навіщо: це гроші клієнтів. Сітка модулів визначає і дату доступу, і дату списання
/// у WayForPay — розбіжність на день означає або зайве списання, або дірку в доступі,
/// яку менеджер закриває вручну. Тести тримають доступ і WFP-графік на одній сітці.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarMonths,
  calculateAccessUntil,
  cohortModuleCount,
  cohortModuleStart,
  cohortSlotIndex,
  lastAutopayChargeDate,
  maxAutopayChargeCount,
  monthlySchedule,
  type CohortLike,
  type PaymentLike,
} from './yearlyProgramAccess';
import { buildRegularPurchaseFlags } from './wayforpay';

/// Реальний набір 2026/27: старт 01.09.2026, кінець 31.05.2027 (кінець доби, як його
/// нормалізує адмінка). Вересень = модуль 1 … травень = модуль 9.
const COHORT: CohortLike = {
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2027-05-31T23:59:59.999Z'),
};

const POST_ACCESS_MONTHS = 6;
/// 31.05.2027 + 6 місяців пост-доступу.
const FULL_ACCESS_END = '2027-11-30T23:59:59.999Z';

const pay = (iso: string, over: Partial<PaymentLike> = {}): PaymentLike => ({
  amount: 2200,
  status: 'PAID',
  paidAt: new Date(iso),
  createdAt: new Date(iso),
  ...over,
});

/// N платежів за сіткою: перший у вказану дату, решта — у перші дні наступних модулів.
const gridPayments = (firstIso: string, count: number): PaymentLike[] => {
  const first = new Date(firstIso);
  const startSlot = cohortSlotIndex(COHORT, first);
  const rows = [pay(firstIso)];
  for (let i = 1; i < count; i++) {
    rows.push(pay(cohortModuleStart(COHORT, startSlot + i).toISOString()));
  }
  return rows;
};

const access = (payments: PaymentLike[], cohort: CohortLike = COHORT) =>
  calculateAccessUntil({
    plan: 'MONTHLY',
    autoRenew: true,
    cohort,
    payments,
    postAccessMonths: POST_ACCESS_MONTHS,
  });

/// dateNext, який отримає WayForPay для покупки в момент `nowIso` (без уже сплачених
/// модулів). Саме цей шлях працює в /api/wayforpay.
const wfpFlags = (nowIso: string) => {
  const slot = cohortSlotIndex(COHORT, new Date(nowIso));
  const totalPayments = maxAutopayChargeCount({ cohort: COHORT, firstSlot: slot });
  return {
    slot,
    totalPayments,
    ...buildRegularPurchaseFlags({
      amount: 2200,
      anchor: cohortModuleStart(COHORT, slot),
      dateEnd: lastAutopayChargeDate({ cohort: COHORT, firstSlot: slot }),
      totalPayments,
    }),
  };
};

test('набір 01.09.2026–31.05.2027 — рівно 9 модулів', () => {
  assert.equal(cohortModuleCount(COHORT), 9);
  assert.equal(cohortModuleStart(COHORT, 0).toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(cohortModuleStart(COHORT, 8).toISOString(), '2027-05-01T00:00:00.000Z');
});

test('покупець ДО старту (20.08): 1 платіж → доступ до 01.10, 9 слотів, dateNext 01.10', () => {
  const one = [pay('2026-08-20T12:00:00.000Z')];
  const s = monthlySchedule({ cohort: COHORT, payments: one });
  assert.equal(s.firstSlot, 0);
  assert.equal(s.totalSlots, 9);
  assert.equal(s.currentModuleNumber, 1);
  assert.equal(s.isFullyPaid, false);
  assert.equal(access(one)!.toISOString(), '2026-10-01T00:00:00.000Z');

  const flags = wfpFlags('2026-08-20T12:00:00.000Z');
  assert.equal(flags.totalPayments, 9);
  assert.equal(flags.dateNext, '01.10.2026');
  assert.equal(flags.dateEnd, '11.05.2027');
});

test('покупець ДО старту: 9 платежів → повний доступ + пост-доступ', () => {
  const nine = gridPayments('2026-08-20T12:00:00.000Z', 9);
  const s = monthlySchedule({ cohort: COHORT, payments: nine });
  assert.equal(s.paidCount, 9);
  assert.equal(s.isFullyPaid, true);
  assert.equal(s.nextSlotStart, null);
  assert.equal(access(nine)!.toISOString(), FULL_ACCESS_END);
});

test('покупець 15.09 — модуль 1 (вересень), доступ до 01.10, 9 слотів, dateNext 01.10', () => {
  const one = [pay('2026-09-15T10:00:00.000Z')];
  const s = monthlySchedule({ cohort: COHORT, payments: one });
  assert.equal(s.firstSlot, 0);
  assert.equal(s.currentModuleNumber, 1);
  assert.equal(s.totalSlots, 9);
  assert.equal(access(one)!.toISOString(), '2026-10-01T00:00:00.000Z');

  const flags = wfpFlags('2026-09-15T10:00:00.000Z');
  assert.equal(flags.totalPayments, 9);
  assert.equal(flags.dateNext, '01.10.2026');
  assert.equal(flags.dateEnd, '11.05.2027');
});

test('покупець 06.10 — модуль 2, 8 слотів, dateNext 01.11', () => {
  const one = [pay('2026-10-06T08:00:00.000Z')];
  const s = monthlySchedule({ cohort: COHORT, payments: one });
  assert.equal(s.firstSlot, 1);
  assert.equal(s.currentModuleNumber, 2);
  assert.equal(s.totalSlots, 8);
  assert.equal(access(one)!.toISOString(), '2026-11-01T00:00:00.000Z');

  const flags = wfpFlags('2026-10-06T08:00:00.000Z');
  assert.equal(flags.slot, 1);
  assert.equal(flags.totalPayments, 8);
  assert.equal(flags.dateNext, '01.11.2026');
  assert.equal(flags.dateEnd, '11.05.2027');
});

test('покупець 06.10 після 8 платежів — повністю оплачено (не 9)', () => {
  const eight = gridPayments('2026-10-06T08:00:00.000Z', 8);
  const s = monthlySchedule({ cohort: COHORT, payments: eight });
  assert.equal(s.paidCount, 8);
  assert.equal(s.isFullyPaid, true);
  assert.equal(s.currentModuleNumber, 9);
  assert.equal(access(eight)!.toISOString(), FULL_ACCESS_END);

  const seven = gridPayments('2026-10-06T08:00:00.000Z', 7);
  assert.equal(monthlySchedule({ cohort: COHORT, payments: seven }).isFullyPaid, false);
});

test('правило краю: покупка 30.09 о 23:30 UTC — це вже модуль 2, dateNext 01.11', () => {
  const at = '2026-09-30T23:30:00.000Z';
  const one = [pay(at)];
  const s = monthlySchedule({ cohort: COHORT, payments: one });
  assert.equal(s.firstSlot, 1);
  assert.equal(s.currentModuleNumber, 2);
  assert.equal(s.totalSlots, 8);
  assert.equal(access(one)!.toISOString(), '2026-11-01T00:00:00.000Z');

  const flags = wfpFlags(at);
  assert.equal(flags.totalPayments, 8);
  assert.equal(flags.dateNext, '01.11.2026');
});

test('правило краю не спрацьовує зарано: 29.09 о 23:30 UTC — ще модуль 1', () => {
  const s = monthlySchedule({ cohort: COHORT, payments: [pay('2026-09-29T23:30:00.000Z')] });
  assert.equal(s.firstSlot, 0);
  assert.equal(s.nextSlotStart!.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('ручна розбивка: 3 частки з одним paidAt 10.11 → покриття до 01.02.2027', () => {
  const split = [
    pay('2026-11-10T09:00:00.000Z'),
    pay('2026-11-10T09:00:00.000Z'),
    pay('2026-11-10T09:00:00.000Z'),
  ];
  const s = monthlySchedule({ cohort: COHORT, payments: split });
  assert.equal(s.firstSlot, 2);
  assert.equal(s.paidCount, 3);
  assert.equal(s.totalSlots, 7);
  assert.equal(s.coveredUntil!.toISOString(), '2027-02-01T00:00:00.000Z');
  assert.equal(access(split)!.toISOString(), '2027-02-01T00:00:00.000Z');
});

test('борг: платіж 15.09, спроба 20.12 → пропущено 2 модулі (жовтень, листопад)', () => {
  const s = monthlySchedule({ cohort: COHORT, payments: [pay('2026-09-15T10:00:00.000Z')] });
  const missed = cohortSlotIndex(COHORT, new Date('2026-12-20T12:00:00.000Z')) - s.nextSlotIndex;
  assert.equal(s.nextSlotIndex, 1);
  assert.equal(missed, 2);
});

test('боргу немає, поки платіж робиться у своєму модулі', () => {
  const s = monthlySchedule({ cohort: COHORT, payments: [pay('2026-09-15T10:00:00.000Z')] });
  const missed = cohortSlotIndex(COHORT, new Date('2026-10-20T12:00:00.000Z')) - s.nextSlotIndex;
  assert.equal(missed, 0);
});

test('набір зі стартом 31.01 — клемп кінця місяця (28.02, 31.03)', () => {
  const shortMonthCohort: CohortLike = {
    startDate: new Date('2027-01-31T00:00:00.000Z'),
    endDate: new Date('2027-10-30T23:59:59.999Z'),
  };
  assert.equal(cohortModuleStart(shortMonthCohort, 1).toISOString(), '2027-02-28T00:00:00.000Z');
  assert.equal(cohortModuleStart(shortMonthCohort, 2).toISOString(), '2027-03-31T00:00:00.000Z');
  // 2028 — високосний: 31.01 + 1 міс = 29.02.
  assert.equal(addCalendarMonths(new Date('2028-01-31T00:00:00.000Z'), 1).toISOString(), '2028-02-29T00:00:00.000Z');

  // Модуль 1 триває 31.01–27.02, модуль 2 — 28.02–30.03: оплата 10.02 покриває модуль 1.
  const inFirst = monthlySchedule({ cohort: shortMonthCohort, payments: [pay('2027-02-10T12:00:00.000Z')] });
  assert.equal(inFirst.firstSlot, 0);
  assert.equal(inFirst.coveredUntil!.toISOString(), '2027-02-28T00:00:00.000Z');
  // Оплата 01.03 — уже модуль 2, покриття до 31.03.
  const inSecond = monthlySchedule({ cohort: shortMonthCohort, payments: [pay('2027-03-01T12:00:00.000Z')] });
  assert.equal(inSecond.firstSlot, 1);
  assert.equal(inSecond.coveredUntil!.toISOString(), '2027-03-31T00:00:00.000Z');
});

test('excludedFromAccess платежі не рахуються ні в слоти, ні в доступ', () => {
  const rows = [
    pay('2026-09-15T10:00:00.000Z'),
    pay('2026-10-01T04:00:00.000Z', { excludedFromAccess: true }),
  ];
  const s = monthlySchedule({ cohort: COHORT, payments: rows });
  assert.equal(s.paidCount, 1);
  assert.equal(access(rows)!.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('YEARLY — завжди кінець набору + пост-доступ, сітка не втручається', () => {
  const result = calculateAccessUntil({
    plan: 'YEARLY',
    autoRenew: false,
    cohort: COHORT,
    payments: [pay('2026-10-06T08:00:00.000Z')],
    postAccessMonths: POST_ACCESS_MONTHS,
  });
  assert.equal(result!.toISOString(), FULL_ACCESS_END);
});

test('без cohort (legacy) — стара поведінка «остання оплата + N днів»', () => {
  const result = calculateAccessUntil({
    plan: 'MONTHLY',
    autoRenew: false,
    cohort: null,
    payments: [pay('2026-10-06T08:00:00.000Z')],
    postAccessMonths: POST_ACCESS_MONTHS,
  });
  assert.equal(result!.toISOString(), '2026-11-05T08:00:00.000Z');
});

test('без платежів — доступу немає, сітка порожня', () => {
  assert.equal(access([]), null);
  const s = monthlySchedule({ cohort: COHORT, payments: [] });
  assert.equal(s.hasPayments, false);
  assert.equal(s.coveredUntil, null);
  assert.equal(s.currentModuleNumber, null);
  assert.equal(s.nextSlotIndex, 0);
});

test('endDate, збережений як 00:00Z, не з’їдає останній модуль', () => {
  const rawEnd: CohortLike = {
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2027-05-31T00:00:00.000Z'),
  };
  assert.equal(cohortModuleCount(rawEnd), 9);
});

test('cohortSlotIndex: до старту → 0, після кінця → останній модуль', () => {
  assert.equal(cohortSlotIndex(COHORT, new Date('2026-01-01T00:00:00.000Z')), 0);
  assert.equal(cohortSlotIndex(COHORT, new Date('2028-01-01T00:00:00.000Z')), 8);
});
