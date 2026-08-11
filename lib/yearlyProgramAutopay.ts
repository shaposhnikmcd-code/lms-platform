import prisma from '@/lib/prisma';
import { removeRegularSchedule, getWayforpayCreds } from '@/lib/wayforpay';

export type AutopayCleanupResult = {
  /// Скільки регулярок дійсно знято на стороні WFP.
  removed: number;
  /// Скільки orderReference-ів пробували знімати (= кількість WFP-платежів підписки
  /// у статусах PAID/PENDING).
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
/// прив'язана до свого orderRef першого autopay-платежу. Тому ітеруємо ВСІ WFP-платежі
/// підписки, не break-имо після першого успіху.
///
/// Чому PAID **і** PENDING: правило регулярки створюється на стороні WFP у момент
/// Purchase, ще до того як наш callback переведе Payment у PAID. Якщо callback загубився
/// (мережа/500) або платіж завис у PENDING — правило у WFP усе одно живе, а старий
/// фільтр `status: 'PAID'` його не бачив і REMOVE тихо не чіпав. Ручні платежі
/// (`manualMethod != null`) у цикл не включаємо: у WFP таких orderRef не існує,
/// вони давали б лише шум із 4102.
///
/// `force: true` — обійти перевірку плану. Потрібно лише ретрай-кроку cron-а: після
/// переведення на Річну план уже YEARLY, а правило у WFP могло лишитись живим.
export async function removeSubscriptionAutopay(
  subscriptionId: string,
  opts?: { force?: boolean },
): Promise<AutopayCleanupResult> {
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    select: { plan: true },
  });
  if (!sub || (sub.plan !== 'MONTHLY' && !opts?.force)) {
    return { removed: 0, attempted: 0, error: null };
  }

  const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!merchantPassword) {
    return { removed: 0, attempted: 0, error: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано' };
  }
  const creds = getWayforpayCreds();

  const paidPayments = await prisma.payment.findMany({
    where: {
      yearlyProgramSubscriptionId: subscriptionId,
      status: { in: ['PAID', 'PENDING'] },
      manualMethod: null,
    },
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

/// Типи подій, якими фіксується результат зняття регулярки. Провал REMOVE раніше жив
/// лише всередині тексту чужої події (`· WFP REMOVE: 0/3 (errors: …)`) — детектор
/// «Помилок» його не бачив, і «зняли 0 з 3» виглядало як успіх. Тепер це окремі типи:
/// їх ловить `classifyEvent` у lib/yearlyProgramIssues.ts.
export const WFP_REMOVE_FAILED_EVENT = 'wfp_remove_failed';
export const WFP_REMOVE_SUCCEEDED_EVENT = 'wfp_remove_succeeded';

/// Скільки провалів REMOVE поспіль (після останнього успіху) вже зафіксовано.
async function countConsecutiveRemoveFailures(subscriptionId: string): Promise<number> {
  const lastSuccess = await prisma.yearlyProgramSubscriptionEvent.findFirst({
    where: { subscriptionId, type: WFP_REMOVE_SUCCEEDED_EVENT },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return prisma.yearlyProgramSubscriptionEvent.count({
    where: {
      subscriptionId,
      type: WFP_REMOVE_FAILED_EVENT,
      ...(lastSuccess ? { createdAt: { gt: lastSuccess.createdAt } } : {}),
    },
  });
}

/// Пише подію про результат `removeSubscriptionAutopay`. Викликати з КОЖНОГО місця, де
/// знімаємо регулярку (admin-дії, cron, конверсія) — інакше ретрай-крок cron-а і вкладка
/// «Помилки» не побачать, що правило у WFP лишилось живим.
///
/// — помилка → подія `wfp_remove_failed` з лічильником послідовних провалів у metadata;
/// — успіх → подія `wfp_remove_succeeded`, але ЛИШЕ якщо до цього були провали (щоб не
///   плодити шум на кожному штатному скасуванні). Вона ж резолвить issue.
///
/// `removed === 0 && error === null` — це НЕ провал: усі orderRef повернули 4102
/// («правила немає»), тобто знімати не було чого.
/// Best-effort: помилка запису події не має валити саму дію.
export async function recordAutopayRemoveOutcome(args: {
  subscriptionId: string;
  result: AutopayCleanupResult;
  source: string;
}): Promise<{ consecutiveFailures: number }> {
  const { subscriptionId, result, source } = args;
  try {
    if (result.error) {
      const consecutiveFailures = (await countConsecutiveRemoveFailures(subscriptionId)) + 1;
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId,
          type: WFP_REMOVE_FAILED_EVENT,
          message: `WFP REMOVE не виконано (${source}): знято ${result.removed}/${result.attempted}, спроб поспіль ${consecutiveFailures} · ${result.error.slice(0, 300)}`,
          metadata: {
            source,
            removed: result.removed,
            attempted: result.attempted,
            error: result.error.slice(0, 500),
            consecutiveFailures,
          },
        },
      });
      return { consecutiveFailures };
    }

    const prevFailures = await countConsecutiveRemoveFailures(subscriptionId);
    if (prevFailures > 0) {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId,
          type: WFP_REMOVE_SUCCEEDED_EVENT,
          message: `WFP REMOVE виконано (${source}): знято ${result.removed}/${result.attempted} після ${prevFailures} невдалих спроб`,
          metadata: { source, removed: result.removed, attempted: result.attempted, prevFailures },
        },
      });
    }
    return { consecutiveFailures: 0 };
  } catch (e) {
    console.error('⚠️ Не вдалося записати подію WFP REMOVE:', subscriptionId, e);
    return { consecutiveFailures: 0 };
  }
}
