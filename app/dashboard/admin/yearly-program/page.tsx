import prisma from '@/lib/prisma';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import {
  getYearlyProgramSettings,
  YEARLY_PROGRAM_DEFAULTS,
} from '@/lib/yearlyProgramSettings';
import { getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';
import { buildYearlyProgramAdminPrewarm } from '@/lib/yearlyProgramAdminPrefetch';
import { isSuperAdmin } from '@/lib/superAdmin';
import { collectAllIssues, buildSubscriptionSeverityMap } from '@/lib/yearlyProgramIssues';
import YearlyProgramView, { type SummaryData } from './_components/YearlyProgramView';
import type { Row, CohortListItem } from './_components/types';

const MAX_ROWS = 500;

export default async function AdminYearlyProgramPage() {
  const [subs, cohorts] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      include: {
        user: { select: { id: true, name: true, email: true } },
        payments: { select: { id: true, amount: true, status: true, createdAt: true, paidAt: true } },
        cohort: { select: { id: true, name: true, startDate: true, launchedAt: true } },
      },
    }),
    prisma.yearlyProgramCohort.findMany({
      orderBy: { startDate: 'desc' },
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

  const rows: Row[] = subs.map((s) => {
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const msLeft = s.expiresAt ? s.expiresAt.getTime() - now : null;
    const daysLeft = msLeft !== null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;

    const firstPaid = paidPayments
      .map((p) => p.paidAt ?? p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

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
      manuallyAddedAt: s.manuallyAddedAt?.toISOString() ?? null,
      manuallyAddedBy: s.manuallyAddedBy ?? null,
      country: s.country,
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

  /// "Покинули чекаут": PENDING + старіше 48 год + жодного PAID-платежу.
  /// 48 год — компроміс між «дав час оплатити» і «не плутати свіжі спроби».
  const abandonedThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [statusCounts, totalAggr, paidCount, pendingAbandoned, revenueAggr, graceDays, programSettings, tgSettings, prewarm, superAdmin, issuesPayload] = await Promise.all([
    prisma.yearlyProgramSubscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.yearlyProgramSubscription.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.yearlyProgramSubscription.count({
      where: {
        status: { not: 'ARCHIVED' },
        payments: { some: { status: 'PAID' } },
      },
    }),
    prisma.yearlyProgramSubscription.count({
      where: {
        status: 'PENDING',
        createdAt: { lt: abandonedThreshold },
        payments: { none: { status: 'PAID' } },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', yearlyProgramSubscriptionId: { not: null } },
      _sum: { amount: true },
    }),
    getYearlyGraceDays(prisma),
    getYearlyProgramSettings(prisma),
    getYearlyProgramTelegramSettings(),
    buildYearlyProgramAdminPrewarm(launchedCohortIds),
    isSuperAdmin(),
    collectAllIssues(),
  ]);
  const countByStatus = (st: string) =>
    statusCounts.find((s) => s.status === st)?._count._all ?? 0;

  const summary: SummaryData = {
    total: totalAggr,
    active: countByStatus('ACTIVE'),
    grace: countByStatus('GRACE'),
    expired: countByStatus('EXPIRED'),
    cancelled: countByStatus('CANCELLED'),
    revenueTotal: revenueAggr._sum.amount ?? 0,
    pendingTotal: countByStatus('PENDING'),
    pendingAbandoned,
    paidCount,
  };

  return (
    <YearlyProgramView
      rows={rows}
      summary={summary}
      cohorts={cohortList}
      graceDays={graceDays}
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
