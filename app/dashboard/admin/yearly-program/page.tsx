import prisma from '@/lib/prisma';
import { getYearlyGraceDays, getYearlyPostAccessMonths } from '@/lib/yearlyProgramConfig';
import {
  getYearlyProgramSettings,
  YEARLY_PROGRAM_DEFAULTS,
} from '@/lib/yearlyProgramSettings';
import { getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';
import { buildYearlyProgramAdminPrewarm } from '@/lib/yearlyProgramAdminPrefetch';
import { isSuperAdmin } from '@/lib/superAdmin';
import { collectAllIssues, buildSubscriptionSeverityMap } from '@/lib/yearlyProgramIssues';
import {
  buildLiveIdentityIndex,
  isVisibleYearlySubscription,
} from '@/lib/yearlyProgramVisibility';
import YearlyProgramView, { type SummaryData } from './_components/YearlyProgramView';
import type { Row, CohortListItem } from './_components/types';

const MAX_ROWS = 500;

/// Точна причина для PENDING-підписки на основі останньої спроби оплати (WFP reasonCode).
/// Повертає коротку мітку + тон (neutral — лід/незавершено, reject — відмова банку/3DS).
function derivePendingLabel(
  attempt: { transactionStatus: string | null; reasonCode: string | null } | null,
  manuallyAdded: boolean,
): { label: string; tone: 'neutral' | 'reject' } | null {
  if (!attempt) {
    return manuallyAdded
      ? { label: 'Очікує оплату', tone: 'neutral' }
      : { label: 'Не платив', tone: 'neutral' };
  }
  const code = attempt.reasonCode;
  const st = attempt.transactionStatus;
  if (code === '1124' || st === 'Expired') return { label: 'Не завершив', tone: 'neutral' };
  if (code === '1101') return { label: 'Банк відхилив', tone: 'reject' };
  if (code === '1108') return { label: '3DS не пройдено', tone: 'reject' };
  if (code === '1106') return { label: 'Ліміт картки', tone: 'reject' };
  if (st === 'Declined') return { label: 'Відхилено', tone: 'reject' };
  return null; // невідомо → лишаємо дефолтне «Очікує»
}

export default async function AdminYearlyProgramPage() {
  const [subs, cohorts, allSubsLite] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      include: {
        user: { select: { id: true, name: true, email: true } },
        payments: { select: { id: true, amount: true, status: true, createdAt: true, paidAt: true, paymentMethod: true, manualMethod: true, orderReference: true } },
        cohort: { select: { id: true, name: true, startDate: true, launchedAt: true } },
      },
    }),
    prisma.yearlyProgramCohort.findMany({
      orderBy: { startDate: 'desc' },
    }),
    // Легка вибірка ПО ВСІЙ БД (без take) — саме на ній рахуються KPI і будується індекс
    // «живих» ідентичностей. Тягнемо лише поля, потрібні предикату видимості.
    prisma.yearlyProgramSubscription.findMany({
      select: {
        id: true,
        userId: true,
        status: true,
        plan: true,
        autoRenew: true,
        phone: true,
        telegramUsername: true,
        manuallyAddedAt: true,
        payments: { where: { status: 'PAID' }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  // Рахуємо тільки підписки, які eligible для launch: PENDING/ACTIVE/GRACE + є хоч один PAID-платіж.
  // Логіка має 1-в-1 збігатись з executeLaunchLoop у lib/yearlyProgramLaunch.ts (інакше counter
  // у LaunchProgramModal буде брехати).
  const eligibleSubs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
      payments: { some: { status: 'PAID' } },
    },
    select: { cohortId: true },
  });
  const countByCohort = new Map<string | null, number>();
  for (const s of eligibleSubs) {
    countByCohort.set(s.cohortId, (countByCohort.get(s.cohortId) ?? 0) + 1);
  }

  const cohortList: CohortListItem[] = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    launchedAt: c.launchedAt?.toISOString() ?? null,
    launchScheduledFor: c.launchScheduledFor?.toISOString() ?? null,
    emailScheduledFor: c.emailScheduledFor?.toISOString() ?? null,
    emailSentAt: c.emailSentAt?.toISOString() ?? null,
    launchEmailSubject: c.launchEmailSubject,
    launchEmailBody: c.launchEmailBody,
    isCurrent: c.isCurrent,
    subscriptionsCount: countByCohort.get(c.id) ?? 0,
  }));

  const now = Date.now();

  // Ховаємо «осиротілі» PENDING-підписки: якщо та сама людина вже має живу
  // (ACTIVE/GRACE) підписку, то її незавершена спроба «Очікує» — це покинутий
  // чекаут, який лише дублює рядок. Предикат і нормалізація телефону/Telegram —
  // у спільному модулі lib/yearlyProgramVisibility.ts (той самий код працює в
  // авто-архіві дублів у WFP-callback), деталі правил — там у коментарях.
  //
  // Індекс живих ідентичностей будуємо з ПОВНОГО набору (`allSubsLite`), а не з
  // обрізаних MAX_ROWS рядків — інакше дубль не зматчився б з ACTIVE-підпискою,
  // що не потрапила у вибірку, і KPI розійшлись би з таблицею.
  const liveIndex = buildLiveIdentityIndex(
    allSubsLite.map((s) => ({
      userId: s.userId,
      status: s.status,
      phone: s.phone,
      telegramUsername: s.telegramUsername,
      manuallyAddedAt: s.manuallyAddedAt,
      hasPaidPayment: s.payments.length > 0,
    })),
  );
  const visibleSubs = subs.filter((s) =>
    isVisibleYearlySubscription(
      {
        userId: s.userId,
        status: s.status,
        phone: s.phone,
        telegramUsername: s.telegramUsername,
        manuallyAddedAt: s.manuallyAddedAt,
        hasPaidPayment: s.payments.some((p) => p.status === 'PAID'),
      },
      liveIndex,
    ),
  );

  // Для PENDING-підписок тягнемо останню спробу оплати з PaymentCallbackLog (одним запитом),
  // щоб показати реальну причину замість загального «Очікує».
  const pendingOrderRefs = visibleSubs
    .filter((s) => s.status === 'PENDING')
    .flatMap((s) => s.payments.map((p) => p.orderReference));
  const pendingLogs = pendingOrderRefs.length > 0
    ? await prisma.paymentCallbackLog.findMany({
        where: { source: 'wayforpay', orderReference: { in: pendingOrderRefs } },
        select: { orderReference: true, transactionStatus: true, rawPayload: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  // orderReference → найсвіжіша спроба (logs відсортовані desc → перша зустрінута і є остання).
  const latestAttemptByRef = new Map<string, { transactionStatus: string | null; reasonCode: string | null; createdAt: Date }>();
  for (const l of pendingLogs) {
    if (!l.orderReference || latestAttemptByRef.has(l.orderReference)) continue;
    const rc = (l.rawPayload as Record<string, unknown> | null)?.reasonCode;
    latestAttemptByRef.set(l.orderReference, {
      transactionStatus: l.transactionStatus,
      reasonCode: rc != null ? String(rc) : null,
      createdAt: l.createdAt,
    });
  }

  const rows: Row[] = visibleSubs.map((s) => {
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    // Перенесення з минулого набору: PAID-платіж 0₴ з manualMethod='carryover'.
    const isCarryover = paidPayments.some((p) => p.manualMethod === 'carryover');
    const msLeft = s.expiresAt ? s.expiresAt.getTime() - now : null;
    const daysLeft = msLeft !== null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;

    const firstPaid = paidPayments
      .map((p) => p.paidAt ?? p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    // Метод оплати — беремо з найсвіжішого PAID-платежу (paidAt desc).
    const latestPaid = [...paidPayments].sort(
      (a, b) => (b.paidAt ?? b.createdAt).getTime() - (a.paidAt ?? a.createdAt).getTime(),
    )[0];

    // Для PENDING — реальна причина з останньої спроби оплати серед усіх платежів підписки.
    let pendingLabel: string | null = null;
    let pendingTone: 'neutral' | 'reject' | null = null;
    if (s.status === 'PENDING') {
      if (isCarryover || paidPayments.length > 0) {
        // Людина вже заплатила (звичайна ручна оплата чи перенесення) — вона нічого не винна,
        // чекає лише загального запуску програми, а не оплати. Пріоритет над derivePendingLabel.
        pendingLabel = 'Чекає запуску';
        pendingTone = 'neutral';
      } else {
        let best: { transactionStatus: string | null; reasonCode: string | null; createdAt: Date } | null = null;
        for (const p of s.payments) {
          const a = latestAttemptByRef.get(p.orderReference);
          if (a && (!best || a.createdAt > best.createdAt)) best = a;
        }
        const info = derivePendingLabel(best, s.manuallyAddedAt != null);
        pendingLabel = info?.label ?? null;
        pendingTone = info?.tone ?? null;
      }
    }

    return {
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      userName: s.user?.name ?? null,
      userEmail: s.user?.email ?? '',
      plan: s.plan,
      autoRenew: s.autoRenew,
      status: s.status,
      startDate: s.startDate?.toISOString() ?? null,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      daysLeft,
      firstPaymentAt: firstPaid?.toISOString() ?? null,
      cohortStartDate: s.cohort?.startDate.toISOString() ?? null,
      cohortName: s.cohort?.name ?? null,
      cohortId: s.cohort?.id ?? null,
      cohortLaunched: s.cohort?.launchedAt != null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      cancelledBy: s.cancelledBy,
      lastPaymentAt: s.lastPaymentAt?.toISOString() ?? null,
      failedChargeCount: s.failedChargeCount,
      lastChargeError: s.lastChargeError,
      sendpulseStudentId: s.sendpulseStudentId,
      sendpulseAccessOpenedAt: s.sendpulseAccessOpenedAt?.toISOString() ?? null,
      sendpulseAccessClosedAt: s.sendpulseAccessClosedAt?.toISOString() ?? null,
      paymentsCount: paidPayments.length,
      totalPaid,
      isCarryover,
      wfpNextChargeAt: s.wfpNextChargeAt?.toISOString() ?? null,
      wfpScheduleCheckedAt: s.wfpScheduleCheckedAt?.toISOString() ?? null,
      paymentMethod: latestPaid?.paymentMethod ?? null,
      pendingLabel,
      pendingTone,
      manuallyAddedAt: s.manuallyAddedAt?.toISOString() ?? null,
      manuallyAddedBy: s.manuallyAddedBy ?? null,
      country: s.country,
      phone: s.phone,
      telegramUsername: s.telegramUsername,
      telegramInviteLink: s.telegramInviteLink,
      telegramInvitedAt: s.telegramInvitedAt?.toISOString() ?? null,
      telegramJoinedAt: s.telegramJoinedAt?.toISOString() ?? null,
      telegramLeftAt: s.telegramLeftAt?.toISOString() ?? null,
    };
  });

  // Prewarm-payload для модалок (templates lists + recipients launched cohort-ів). Тягнемо тут
  // у спільному Promise.all з агрегаціями, щоб не додавати додатковий sequential roundtrip.
  // Клієнт записує ці дані в module-level кеш модалок при mount → відкриття без skeleton.
  const launchedCohortIds = cohortList.filter((c) => c.launchedAt !== null).map((c) => c.id);

  const [statusCounts, revenueAggr, graceDays, postAccessMonths, programSettings, tgSettings, prewarm, superAdmin, issuesPayload] = await Promise.all([
    prisma.yearlyProgramSubscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', yearlyProgramSubscriptionId: { not: null } },
      _sum: { amount: true },
    }),
    getYearlyGraceDays(prisma),
    getYearlyPostAccessMonths(prisma),
    getYearlyProgramSettings(prisma),
    getYearlyProgramTelegramSettings(),
    buildYearlyProgramAdminPrewarm(launchedCohortIds),
    isSuperAdmin(),
    collectAllIssues(),
  ]);
  const countByStatus = (st: string) =>
    statusCounts.find((s) => s.status === st)?._count._all ?? 0;

  // «Всього» і «В очікуванні» рахуються за тими самими правилами, що й рядки таблиці:
  // повний набір підписок → фільтр видимості (осиротілі PENDING-дублі не рахуються) →
  // «Всього» без архіву (у дефолтному вигляді таблиці ARCHIVED теж прихований).
  // active/grace/expired/cancelled/revenue фільтр не зачіпає — їхня семантика без змін.
  const visibleAll = allSubsLite.filter((s) =>
    isVisibleYearlySubscription(
      {
        userId: s.userId,
        status: s.status,
        phone: s.phone,
        telegramUsername: s.telegramUsername,
        manuallyAddedAt: s.manuallyAddedAt,
        hasPaidPayment: s.payments.length > 0,
      },
      liveIndex,
    ),
  );

  // Розбивка живих студентів (ACTIVE + GRACE) по видах підписки — неймінг збігається з
  // «Тип/Вид» адмінки Платежів: «Річна підписка» / «Місячна Автоплатіж» / «Місячна на 1 міс.».
  // Фільтр видимості на ACTIVE/GRACE не впливає (він ховає лише осиротілі PENDING), тож
  // інваріанта «сума трьох = Активних + Grace» виконується за побудовою.
  const liveSubs = allSubsLite.filter((s) => s.status === 'ACTIVE' || s.status === 'GRACE');

  const summary: SummaryData = {
    total: visibleAll.filter((s) => s.status !== 'ARCHIVED').length,
    pending: visibleAll.filter((s) => s.status === 'PENDING').length,
    active: countByStatus('ACTIVE'),
    grace: countByStatus('GRACE'),
    expired: countByStatus('EXPIRED'),
    cancelled: countByStatus('CANCELLED'),
    revenueTotal: revenueAggr._sum.amount ?? 0,
    planYearly: liveSubs.filter((s) => s.plan === 'YEARLY').length,
    planMonthlyAuto: liveSubs.filter((s) => s.plan === 'MONTHLY' && s.autoRenew).length,
    planMonthlyOnce: liveSubs.filter((s) => s.plan === 'MONTHLY' && !s.autoRenew).length,
  };

  return (
    <YearlyProgramView
      rows={rows}
      summary={summary}
      cohorts={cohortList}
      graceDays={graceDays}
      postAccessMonths={postAccessMonths}
      programSettings={programSettings}
      programDefaults={YEARLY_PROGRAM_DEFAULTS}
      telegramSettings={{
        chatId: tgSettings.chatId,
        chatTitle: tgSettings.chatTitle,
        chatType: tgSettings.chatType,
        autoAdd: tgSettings.autoAdd,
        joinRequestMode: tgSettings.joinRequestMode,
        updatedAt: tgSettings.updatedAt?.toISOString() ?? null,
        updatedBy: tgSettings.updatedBy,
      }}
      prewarm={prewarm}
      isSuperAdmin={superAdmin}
      initialIssuesTotal={issuesPayload.activeTotal}
      issueSeverityBySub={buildSubscriptionSeverityMap(issuesPayload)}
    />
  );
}
