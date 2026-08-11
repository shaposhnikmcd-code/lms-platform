/// Скільки реально сплачено по підписці Річної програми — одне правило для сервера
/// (квитанція, переведення на Річну) і для UI (блок «Сплачено / залишок» у картці).
/// Модуль навмисно без залежностей (ні prisma, ні next) — імпортується і з route-ів,
/// і з клієнтських компонентів.

/// Символічні тест-оплати ADMIN/MANAGER (1 ₴ курс/пакет, 2 ₴ Річна) не є доходом —
/// той самий поріг, що й у KPI «Дохід» на сторінці Річної (`REVENUE_MIN_AMOUNT`).
export const REAL_PAYMENT_MIN_AMOUNT = 3;

export interface PaidTotalPayment {
  amount: number;
  status: string;
}

/// Сума реальних оплат: тільки PAID (REFUNDED/PENDING/FAILED не рахуються) і тільки
/// суми ≥ порогу. Перенесення з минулого набору (0 ₴) теж відсіюється порогом — воно
/// не приносить грошей, і в «залишку до повної вартості» його враховувати не можна.
export function sumRealPaid(payments: PaidTotalPayment[]): number {
  return payments.reduce(
    (sum, p) => (p.status === 'PAID' && p.amount >= REAL_PAYMENT_MIN_AMOUNT ? sum + p.amount : sum),
    0,
  );
}
