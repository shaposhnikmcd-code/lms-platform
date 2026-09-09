/// Узгодженість сторінки і платіжки: якщо панель поновлення показала КНОПКУ, оплата
/// мусить пройти. Запуск: `npm run test:salesgate` (або `npm test` разом з рештою).
///
/// Звідки взявся тест. Панель (`resolveRenewState`) і `/api/wayforpay` відповідають на
/// одне питання — «чи можна зараз продати цій людині наступний модуль» — і колись
/// відповідали по-різному: у manual-add підписки в режимі «чекаємо перший платіж» (PENDING
/// без жодного PAID) сторінка малювала «Оплатити модуль», а роут при закритій реєстрації
/// віддавав 409 `registration_closed`. Для людини це кнопка, яка веде у відмову платіжки,
/// — найгірший з можливих станів у розмові про гроші.
///
/// Тут перевіряється сама імплікація, а не окремі гілки: для набору станів
/// `renewState.kind === 'payable'` ⇒ рубильник продажів пропускає (роут відповість 200).
/// Рівень роуту цілком — `scripts/e2e-yearly-registration-closed.mts`.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXTAUTH_SECRET ??= 'test-secret-for-sales-consistency-tests';

import { signRenewToken } from './yearlyProgramRenew';
import { isBlockedByClosedRegistration } from './yearlyProgramSalesGate';
import { resolveRenewState } from './yearlyProgramRenewState';

type Client = Parameters<typeof resolveRenewState>[0]['client'];

const EMAIL = 'student@example.com';
const NOW = new Date('2026-11-10T09:00:00Z');
const COHORT = {
  id: 'cohort_2026',
  startDate: new Date('2026-09-01T00:00:00Z'),
  endDate: new Date('2027-05-31T23:59:59.999Z'),
};

function paidPayment(createdAt: string) {
  return {
    amount: 2200,
    status: 'PAID',
    paidAt: new Date(createdAt),
    createdAt: new Date(createdAt),
    excludedFromAccess: false,
    manualMethod: null,
  };
}

const SEP_OCT = [paidPayment('2026-09-14T10:00:00Z'), paidPayment('2026-10-01T08:00:00Z')];

/// Три стани, які реально трапляються у менеджера на одному й тому ж наборі.
const STATES = [
  {
    label: 'ACTIVE з двома оплатами — чинний студент',
    status: 'ACTIVE',
    payments: SEP_OCT,
    expectPayable: true,
  },
  {
    label: 'PENDING без жодної оплати — manual-add «чекаємо перший платіж»',
    status: 'PENDING',
    payments: [],
    expectPayable: false,
  },
  {
    label: 'EXPIRED з оплатами — доступ згорів, підписка оживає новою оплатою',
    status: 'EXPIRED',
    payments: SEP_OCT,
    expectPayable: true,
  },
];

function makeClient(payments: ReturnType<typeof paidPayment>[], status: string): Client {
  return {
    yearlyProgramSubscription: {
      findUnique: async () => ({
        id: 'sub_1',
        userId: 'user_1',
        plan: 'MONTHLY',
        status,
        autoRenew: false,
        cohortId: COHORT.id,
        phone: null,
        country: null,
        telegramUsername: null,
        user: { name: 'Оксана', email: EMAIL },
        cohort: COHORT,
        payments,
      }),
      // Активної Річної підписки в цієї людини немає.
      findFirst: async () => null,
    },
  } as unknown as Client;
}

for (const state of STATES) {
  test(`панель і платіжка сходяться: ${state.label}`, async () => {
    const renew = await resolveRenewState({
      client: makeClient(state.payments, state.status),
      token: signRenewToken({ subscriptionId: 'sub_1', email: EMAIL, cohortId: COHORT.id }),
      monthlyPrice: 2200,
      now: NOW,
    });

    assert.equal(renew.kind === 'payable', state.expectPayable, `стан панелі: ${renew.kind}`);

    // Той самий стан очима роуту в найсуворіших умовах: продажі закриті, invite немає,
    // покупець — звичайна людина. Ознака «чинний студент» береться з тих самих платежів.
    const blocked = isBlockedByClosedRegistration({
      registrationOpen: false,
      hasInvite: false,
      isStaff: false,
      hasPaidHistory: state.payments.length > 0,
    });

    // Головна імплікація: кнопка на сторінці ⇒ оплата проходить.
    if (renew.kind === 'payable') {
      assert.equal(blocked, false, 'панель показала кнопку, а роут відхилив би оплату');
    }
    // Зворотний бік для стану без оплат: обидві сторони відмовляють, і панель називає
    // причину, а не мовчить.
    if (!state.expectPayable) {
      assert.equal(blocked, true);
      assert.equal(renew.kind === 'blocked' && renew.reason, 'no_payment');
    }
  });
}

test('відкрита реєстрація нікого не блокує — навіть без історії оплат', () => {
  assert.equal(isBlockedByClosedRegistration({
    registrationOpen: true, hasInvite: false, isStaff: false, hasPaidHistory: false,
  }), false);
});

test('invite менеджера і роль ADMIN/MANAGER обходять закриті продажі', () => {
  const closedNewcomer = { registrationOpen: false, hasPaidHistory: false };
  assert.equal(isBlockedByClosedRegistration({ ...closedNewcomer, hasInvite: true, isStaff: false }), false);
  assert.equal(isBlockedByClosedRegistration({ ...closedNewcomer, hasInvite: false, isStaff: true }), false);
  // Контроль: без жодного з обходів — новий продаж при закритих продажах відхиляється.
  assert.equal(isBlockedByClosedRegistration({ ...closedNewcomer, hasInvite: false, isStaff: false }), true);
});
