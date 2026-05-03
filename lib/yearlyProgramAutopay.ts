import prisma from '@/lib/prisma';
import { removeRegularSchedule, getWayforpayCreds } from '@/lib/wayforpay';

export type AutopayCleanupResult = {
  /// Скільки регулярок дійсно знято на стороні WFP.
  removed: number;
  /// Скільки orderReference-ів пробували знімати (= кількість PAID-платежів підписки).
  attempted: number;
  /// Текст помилки. 4102 'Rule is not found' НЕ вважається помилкою (це означає що
  /// для цього orderRef регулярки не було — РАЗОВА оплата або cyclical-Payment без token-а),
  /// тож сюди не потрапляє.
  error: string | null;
};

/// Знімає ВСІ активні WFP-регулярки підписки. Викликати при будь-якому переході
/// MONTHLY-підписки в стан, де автосписання має зупинитись:
/// — admin Cancel (status → CANCELLED)
/// — admin Archive (status → ARCHIVED)
/// — admin Close access (status → EXPIRED)
/// — cron GRACE → EXPIRED
/// — wayforpay route downgrade (autoRenew=true → false при новій оплаті)
///
/// Безпечно для YEARLY-плану — повертає no-op (там WFP-регулярок немає).
/// Безпечно для MONTHLY з autoRenew=false — теж no-op (regular для разової не створювалась,
/// removeRegularSchedule поверне 4102 і ми це проігноруємо).
///
/// У клієнта може бути одночасно >1 активна регулярка (картка + Apple Pay), кожна
/// прив'язана до свого orderRef першого autopay-платежу. Тому ітеруємо ВСІ PAID-платежі
/// підписки, не break-имо після першого успіху.
export async function removeSubscriptionAutopay(subscriptionId: string): Promise<AutopayCleanupResult> {
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    select: { plan: true },
  });
  if (!sub || sub.plan !== 'MONTHLY') {
    return { removed: 0, attempted: 0, error: null };
  }

  const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!merchantPassword) {
    return { removed: 0, attempted: 0, error: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано' };
  }
  const creds = getWayforpayCreds();

  const paidPayments = await prisma.payment.findMany({
    where: { yearlyProgramSubscriptionId: subscriptionId, status: 'PAID' },
    select: { orderReference: true },
  });

  let removed = 0;
  const attempted = paidPayments.length;
  const errors: string[] = [];

  for (const p of paidPayments) {
    try {
      const result = await removeRegularSchedule({
        merchantAccount: creds.merchantAccount,
        merchantPassword,
        orderReference: p.orderReference,
      });
      if (result.ok) {
        removed++;
      } else if (result.raw.reasonCode !== 4102) {
        errors.push(`${p.orderReference}: code=${result.raw.reasonCode} reason=${String(result.raw.reason ?? '').slice(0, 80)}`);
      }
    } catch (e) {
      errors.push(`${p.orderReference}: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  return {
    removed,
    attempted,
    error: errors.length > 0 ? errors.join(' | ').slice(0, 600) : null,
  };
}
