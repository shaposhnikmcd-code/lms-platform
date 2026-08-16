/// Спільна логіка «активація підписки після зарахування платежу» — використовується
/// і при ручному підтвердженні оплати (handleManualPayment у [id]/route.ts), і при
/// перенесенні студента з минулого набору (carryover у manual-add/route.ts), і при
/// редагуванні ручного платежу (edit_payment).
///
/// Тягне свіжий стан підписки (cohort + усі payments, включно з щойно створеним),
/// перераховує expiresAt через calculateAccessUntil (single source of truth) і оновлює
/// статус за еталоном WFP-callback-а (уніфікація ручного флоу зі стандартною покупкою):
///   — prevStatus ∈ PENDING/ACTIVE/GRACE → ACTIVE завжди (незалежно від запуску cohort-а);
///   — prevStatus ∈ EXPIRED/CANCELLED/ARCHIVED → `allowRevive:true` піднімає в ACTIVE,
///     `allowRevive:false` (edit_payment) — статус не чіпає;
///   — зарахованих платежів не лишилось узагалі (єдиний виключили з доступу або видалили)
///     і підписка жива → PENDING з expiresAt=null («ще не оплачено»), див. `revertedToPending`.
/// startDate виставляється в lastPaymentAt, якщо ще не заданий (як `sub.startDate ?? now`
/// у callback-у).
///
/// При РЕАЛЬНОМУ оживленні (див. `revived` нижче) додатково повторює те, що робить
/// callback: прибирає сліди скасування і скидає SendPulse-маркери, якщо доступ закривали.

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';

export interface PaymentActivationResult {
  newStatus: string;
  newExpiresAt: Date | null;
  cohortLaunched: boolean;
  hasCohort: boolean;
  /// true — оплата підняла мертву/скасовану підписку назад у ACTIVE.
  revived: boolean;
  /// true — SendPulse-маркери скинуто, щоб наступний extra-launch реально відкрив доступ.
  spMarkersReset: boolean;
  /// true — підписка активна, але розрахований expiresAt уже в минулому (записано
  /// подію `revived_with_debt`, у «Помилках» з'явиться critical-issue).
  debt: boolean;
  /// true — після перерахунку в підписці не лишилось жодного зарахованого платежу,
  /// тож жива підписка повернулась у PENDING («ще не оплачено»).
  revertedToPending: boolean;
}

/// Статуси «живої» підписки, які завжди активуються після оплати.
const REVIVABLE_STATUSES = new Set(['PENDING', 'ACTIVE', 'GRACE']);

export async function applyPaymentActivation(args: {
  subscriptionId: string;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
  /// Поточний статус підписки ДО активації.
  prevStatus: string;
  /// lastPaymentAt для оновлення підписки (у ручній оплаті = paidAt, у carryover = now).
  lastPaymentAt: Date;
  /// Дозволити «оживити» мертву підписку (EXPIRED/CANCELLED/ARCHIVED) у ACTIVE.
  /// manual_payment / carryover → true (реальна оплата відновлює доступ);
  /// edit_payment → false (правка платежу не має воскрешати закриту підписку). Default false.
  allowRevive?: boolean;
}): Promise<PaymentActivationResult> {
  const fresh = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: args.subscriptionId },
    include: {
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
    },
  });

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const newExpiresAt = calculateAccessUntil({
    plan: args.plan,
    autoRenew: args.autoRenew,
    cohort: fresh?.cohort ? { startDate: fresh.cohort.startDate, endDate: fresh.cohort.endDate } : null,
    payments: fresh?.payments ?? [],
    postAccessMonths,
  });

  const cohortLaunched = !!fresh?.cohort?.launchedAt;
  const hasCohort = !!fresh?.cohort;

  // Скільки платежів реально йде в доступ. Саме ця лічилка (а не «всі PAID») визначає,
  // чи є за що тримати підписку активною: excludedFromAccess-рядки відсіює і
  // calculateAccessUntil, тож ACTIVE без жодного зарахованого платежу означав би
  // «активна підписка з expiresAt=null» — стан, якого в системі не існує.
  const countedPaid = (fresh?.payments ?? []).filter(
    (p) => p.status === 'PAID' && !p.excludedFromAccess,
  ).length;

  // Уніфіковано з callback-ом: жива підписка (PENDING/ACTIVE/GRACE) після оплати завжди
  // стає ACTIVE — незалежно від того, запущений cohort чи ні (доступ до платформи=креди
  // все одно відкриваються централізовано на запуску, але сама підписка вже активна).
  // Мертву (EXPIRED/CANCELLED/ARCHIVED) піднімаємо тільки якщо allowRevive.
  //
  // Виняток — зарахованих платежів не лишилось (менеджер виключив з доступу або видалив
  // єдиний платіж): жива підписка повертається у PENDING, тобто «ще не оплачено», з
  // expiresAt=null. Це легальний стан — рівно те, з чого підписка починається. Мертві
  // статуси не чіпаємо: EXPIRED/CANCELLED — окреме рішення менеджера, і «оживляти» їх
  // у PENDING через правку платежу неправильно.
  const revertedToPending = countedPaid === 0 && REVIVABLE_STATUSES.has(args.prevStatus);
  const newStatus = revertedToPending
    ? 'PENDING'
    : REVIVABLE_STATUSES.has(args.prevStatus)
      ? 'ACTIVE'
      : (args.allowRevive ? 'ACTIVE' : args.prevStatus);

  // Реальне оживлення = підписку підняли в ACTIVE з мертвого статусу АБО вона несла
  // слід скасування. Друга умова важлива, бо статус могли вже поправити вручну в
  // адмінці — тоді revive за статусом не видно, а `cancelledAt` лишається.
  const wasDead = !REVIVABLE_STATUSES.has(args.prevStatus);
  const revived = newStatus === 'ACTIVE' && (wasDead || !!fresh?.cancelledAt);

  // Дзеркало WFP-callback-а (`handleYearlyProgramCallback`): при оживленні прибираємо
  // сліди скасування і, якщо доступ у SendPulse РЕАЛЬНО закривали, скидаємо обидва
  // маркери. Без цього `runExtraLaunchForSubscription` виходить по `already_opened`,
  // і після «Внести оплату» студент лишається ACTIVE у нас, але видаленим у SendPulse.
  // Живих підписок без скасування це не торкається — маркери лишаються як були.
  const clearCancelTrace = revived && !!fresh?.cancelledAt;
  const spMarkersReset = revived && !!fresh?.sendpulseAccessClosedAt;

  await prisma.yearlyProgramSubscription.update({
    where: { id: args.subscriptionId },
    data: {
      status: newStatus as Prisma.YearlyProgramSubscriptionUpdateInput['status'],
      expiresAt: newExpiresAt,
      lastPaymentAt: args.lastPaymentAt,
      // startDate — «початок доступу»: якщо ще не заданий, ставимо дату платежу
      // (дзеркало `startDate: sub.startDate ?? now` у callback-у).
      ...(fresh?.startDate ? {} : { startDate: args.lastPaymentAt }),
      ...(clearCancelTrace ? { cancelledAt: null, cancelledBy: null, cancelledReason: null } : {}),
      ...(spMarkersReset ? { sendpulseAccessOpenedAt: null, sendpulseAccessClosedAt: null } : {}),
    },
  });

  // Борг: підписку активували, але оплачених місяців не вистачає навіть до сьогодні.
  // Дзеркало WFP-callback-а — без цього ручна оплата боржника («Внести оплату» за один
  // із трьох пропущених місяців) проходила тихо: у нас ACTIVE, а доступ уже закінчився.
  // Пишемо лише коли підписка реально стала ACTIVE: edit_payment по закритій підписці
  // (allowRevive:false) не має піднімати critical-issue на рівному місці.
  const paidCount = (fresh?.payments ?? []).filter((p) => p.status === 'PAID').length;
  const debt = newStatus === 'ACTIVE' && !!newExpiresAt && newExpiresAt.getTime() <= Date.now();
  if (debt) {
    const totalSlots = args.plan === 'MONTHLY' ? YEARLY_PROGRAM_CONFIG.totalMonthlyPayments : 1;
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: args.subscriptionId,
        type: 'revived_with_debt',
        message: `⚠️ Оплата зарахована, але доступ уже прострочений: сплачено ${paidCount} з ${totalSlots} — розрахована дата завершення ${newExpiresAt!.toISOString().slice(0, 10)} вже в минулому.${revived ? ' Підписку оживлено.' : ''} Потрібне рішення менеджера: допродати місяці або скоригувати дати.`,
        metadata: {
          source: 'manual_activation',
          expiresAt: newExpiresAt!.toISOString(),
          paidPayments: paidCount,
          totalSlots,
          revived,
        },
      },
    });
  }

  return { newStatus, newExpiresAt, cohortLaunched, hasCohort, revived, spMarkersReset, debt, revertedToPending };
}
