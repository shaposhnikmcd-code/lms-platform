/// Спільна логіка «перерахунок підписки по її платежах» — використовується і при ручному
/// підтвердженні оплати (handleManualPayment у [id]/route.ts), і при перенесенні студента
/// з минулого набору (carryover у manual-add/route.ts), і при корекціях платежу
/// (edit_payment / set_payment_access / delete_payment).
///
/// ДВА РЕЖИМИ (`context`), бо це два різні за змістом сценарії:
///
///   • `payment` (default) — «прийшла оплата». Тягне свіжий стан підписки (cohort + усі
///     payments, включно з щойно створеним), перераховує expiresAt через calculateAccessUntil
///     (single source of truth) і оновлює статус за еталоном WFP-callback-а:
///       — prevStatus ∈ PENDING/ACTIVE/GRACE → ACTIVE завжди (незалежно від запуску cohort-а);
///       — prevStatus ∈ EXPIRED/CANCELLED/ARCHIVED → `allowRevive:true` піднімає в ACTIVE,
///         `allowRevive:false` — статус не чіпає;
///     при РЕАЛЬНОМУ оживленні (див. `revived`) додатково повторює те, що робить callback:
///     прибирає сліди скасування і скидає SendPulse-маркери, якщо доступ закривали, та пише
///     подію `revived_with_debt`, коли оплачених місяців не вистачає навіть до сьогодні.
///
///   • `correction` — «менеджер виправляє платіж» (виключив з доступу / видалив / відредагував).
///     Тут НІЧОГО не «оплачено», тож мертві статуси (EXPIRED/CANCELLED/ARCHIVED) не воскресають,
///     заборонені `revived` / очищення `cancelledAt` / скидання SendPulse-маркерів (інакше
///     «прибрати платіж» відкривало б студенту доступ нічним heal-ом) і подія
///     `revived_with_debt` (фальшивий critical «Оплата зарахована… Підписку оживлено»).
///     ЄДИНИЙ дозволений апгрейд — `backToLife` (та сама семантика, що в cohorts/settings
///     routes): перерахований expiresAt у МАЙБУТНЬОМУ ⇒ живий PENDING/GRACE стає ACTIVE, а
///     при підйомі з GRACE скидаються grace-поля і спожиті прапори нагадувань. Без цього
///     «Повернути в доступ» після помилкового виключення лишало оплаченого студента в PENDING
///     назавжди, а виправлений платіж у GRACE не рятував від нічного `expireGraceSubscriptions`
///     (він дивиться лише на `gracePeriodEndsAt`, не на expiresAt) — доступ закривався оплаченому.
///     Якщо ж перерахована дата в минулому, статус лишається як був: боржник у GRACE після
///     виключення платежу лишається GRACE — це і була мета. ACTIVE із простроченою датою
///     штатно підбере нічний cron (ACTIVE→GRACE); прапорець `debt` віддаємо викликачу для
///     нейтральної нотатки в події.
///
/// Спільне для обох режимів: зарахованих платежів не лишилось узагалі (єдиний виключили з
/// доступу або видалили) і підписка жива → PENDING з expiresAt=null («ще не оплачено»),
/// див. `revertedToPending`. startDate виставляється в lastPaymentAt, якщо ще не заданий
/// (як `sub.startDate ?? now` у callback-у).

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, RESET_REMINDER_AND_GRACE_FIELDS, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';

export interface PaymentActivationResult {
  newStatus: string;
  newExpiresAt: Date | null;
  cohortLaunched: boolean;
  hasCohort: boolean;
  /// true — оплата підняла мертву/скасовану підписку назад у ACTIVE.
  revived: boolean;
  /// true — SendPulse-маркери скинуто, щоб наступний extra-launch реально відкрив доступ.
  spMarkersReset: boolean;
  /// true — підписка активна, але розрахований expiresAt уже в минулому. У режимі
  /// `payment` при цьому записано подію `revived_with_debt` (у «Помилках» з'явиться
  /// critical-issue); у режимі `correction` події немає — прапорець лише інформативний.
  debt: boolean;
  /// true — після перерахунку в підписці не лишилось жодного зарахованого платежу,
  /// тож жива підписка повернулась у PENDING («ще не оплачено»).
  revertedToPending: boolean;
  /// true — режим `correction` підняв живу підписку (PENDING/GRACE) назад в ACTIVE, бо
  /// перерахований доступ знову чинний. Для тексту події менеджера.
  liftedByCorrection: boolean;
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
  /// manual_payment / carryover → true (реальна оплата відновлює доступ). Default false.
  /// У режимі `correction` ігнорується — там статус не апгрейдиться взагалі.
  allowRevive?: boolean;
  /// `payment` (default) — зарахування оплати; `correction` — виправлення платежу
  /// (set_payment_access / delete_payment / edit_payment). Різниця — у шапці файлу.
  context?: 'payment' | 'correction';
}): Promise<PaymentActivationResult> {
  const isCorrection = args.context === 'correction';
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
  // У режимі `correction` апгрейд лише «за фактом дати» (`backToLife`, нижче): корекція
  // нічого не оплачує, але й тримати оплаченого студента в PENDING/GRACE, коли перерахований
  // доступ чинний, не можна. Заборона лишається там, де вона й задумувалась: expiresAt у
  // минулому ⇒ статус не рухаємо (боржник у GRACE після виключення платежу лишається в GRACE,
  // і нічний cron не дарує йому ПОВНИЙ новий grace-період).
  //
  // Виняток, спільний для обох режимів — зарахованих платежів не лишилось (менеджер
  // виключив з доступу або видалив єдиний платіж): жива підписка повертається у PENDING,
  // тобто «ще не оплачено», з expiresAt=null. Це легальний стан — рівно те, з чого
  // підписка починається. Мертві статуси не чіпаємо: EXPIRED/CANCELLED — окреме рішення
  // менеджера, і «оживляти» їх у PENDING через правку платежу неправильно.
  const revertedToPending = countedPaid === 0 && REVIVABLE_STATUSES.has(args.prevStatus);
  // «Доступ знову чинний» — той самий критерій, що в cohorts/[id] і settings routes.
  const backToLife = !!newExpiresAt && newExpiresAt.getTime() > Date.now();
  const liftedByCorrection = isCorrection
    && !revertedToPending
    && backToLife
    && (args.prevStatus === 'PENDING' || args.prevStatus === 'GRACE');
  const newStatus = revertedToPending
    ? 'PENDING'
    : isCorrection
      ? (liftedByCorrection ? 'ACTIVE' : args.prevStatus)
      : REVIVABLE_STATUSES.has(args.prevStatus)
        ? 'ACTIVE'
        : (args.allowRevive ? 'ACTIVE' : args.prevStatus);

  // Реальне оживлення = підписку підняли в ACTIVE з мертвого статусу АБО вона несла
  // слід скасування. Друга умова важлива, бо статус могли вже поправити вручну в
  // адмінці — тоді revive за статусом не видно, а `cancelledAt` лишається.
  // У режимі `correction` оживлення неможливе за визначенням.
  const wasDead = !REVIVABLE_STATUSES.has(args.prevStatus);
  const revived = !isCorrection && newStatus === 'ACTIVE' && (wasDead || !!fresh?.cancelledAt);

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
      // Підйом із GRACE після корекції = «звинувачення у простроченні знято»: без скидання
      // grace-полів нічний `expireGraceSubscriptions` усе одно закрив би доступ по старому
      // `gracePeriodEndsAt` (він expiresAt не дивиться), а спожиті прапори нагадувань
      // лишили б новий цикл попереджень німим.
      ...(liftedByCorrection && args.prevStatus === 'GRACE' ? RESET_REMINDER_AND_GRACE_FIELDS : {}),
    },
  });

  // Борг: підписку активували, але оплачених місяців не вистачає навіть до сьогодні.
  // Дзеркало WFP-callback-а — без цього ручна оплата боржника («Внести оплату» за один
  // із трьох пропущених місяців) проходила тихо: у нас ACTIVE, а доступ уже закінчився.
  // Пишемо лише коли підписка реально стала ACTIVE: edit_payment по закритій підписці
  // (allowRevive:false) не має піднімати critical-issue на рівному місці.
  //
  // І тільки в режимі `payment`: у корекції ніхто нічого не зараховував, тож текст
  // «Оплата зарахована… Підписку оживлено» був би брехнею — а issue з нього ще й
  // ніколи не знімається у вкладці «Помилки». Прострочений ACTIVE після корекції
  // штатно підбирає нічний cron (ACTIVE→GRACE).
  const paidCount = (fresh?.payments ?? []).filter((p) => p.status === 'PAID').length;
  const debt = newStatus === 'ACTIVE' && !backToLife && !!newExpiresAt;
  if (debt && !isCorrection) {
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

  return { newStatus, newExpiresAt, cohortLaunched, hasCohort, revived, spMarkersReset, debt, revertedToPending, liftedByCorrection };
}
