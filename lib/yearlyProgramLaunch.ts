import prisma from '@/lib/prisma';
import { openAccessViaEvent, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';

/// Спільна логіка "запустити cohort": викликається з адмінки (POST .../launch) і з cron-у
/// (для cohort-ів зі `launchScheduledFor` у минулому). Приймає cohort, який ВЖЕ має
/// `launchedAt` (тобто claim або cron вже виставили цю дату). Виконує SendPulse +
/// перерахунок expiresAt + лог events.
///
/// Idempotent: для підписок, у яких `sendpulseAccessOpenedAt` вже виставлений, пропускає
/// SendPulse-виклик (тільки оновлює статус та expiresAt).
export interface LaunchResult {
  subscriptionId: string;
  email: string;
  accessOpened: boolean;
  expiresAt: string | null;
  error?: string;
}

export interface LaunchSummary {
  total: number;
  opened: number;
  failed: number;
  results: LaunchResult[];
}

export async function executeLaunchLoop(
  cohort: { id: string; startDate: Date; endDate: Date },
  actorLabel: string,
): Promise<LaunchSummary> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { id: true, email: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });

  const results: LaunchResult[] = [];

  for (const s of subs) {
    if (!s.user?.email) continue;
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    if (paidPayments.length === 0) {
      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        accessOpened: false,
        expiresAt: null,
        error: 'no_paid_payments',
      });
      continue;
    }

    let openedNow = false;
    let openErr: string | null = null;
    if (!s.sendpulseAccessOpenedAt) {
      try {
        await openAccessViaEvent(
          s.user.email,
          YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
          paidPayments[0]!.amount,
        );
        openedNow = true;
        if (!s.sendpulseStudentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
          try {
            const studentId = await lookupStudentIdByEmail(
              YEARLY_PROGRAM_CONFIG.sendpulseCourseId,
              s.user.email,
            );
            if (studentId) {
              await prisma.yearlyProgramSubscription.update({
                where: { id: s.id },
                data: { sendpulseStudentId: studentId },
              });
            }
          } catch {
            // ignore lookup err — буде підтянуто пізніше cron-ом
          }
        }
      } catch (e) {
        openErr = (e as Error).message;
      }
    } else {
      openedNow = true;
    }

    const newExpiresAt = calculateAccessUntil({
      plan: s.plan,
      autoRenew: s.autoRenew,
      cohort: { startDate: cohort.startDate, endDate: cohort.endDate },
      payments: s.payments,
    });

    await prisma.yearlyProgramSubscription.update({
      where: { id: s.id },
      data: {
        status: 'ACTIVE',
        startDate: s.startDate ?? cohort.startDate,
        expiresAt: newExpiresAt,
        ...(openedNow && !s.sendpulseAccessOpenedAt
          ? { sendpulseAccessOpenedAt: new Date(), sendpulseAccessClosedAt: null }
          : {}),
      },
    });

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: s.id,
        type: openedNow && !s.sendpulseAccessOpenedAt ? 'access_opened' : 'admin_action',
        message: openErr
          ? `Cohort launch · access open FAILED: ${openErr.slice(0, 200)}`
          : `Cohort launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
        metadata: { cohortId: cohort.id, openedNow, openErr },
      },
    });

    results.push({
      subscriptionId: s.id,
      email: s.user.email,
      accessOpened: openedNow && !openErr,
      expiresAt: newExpiresAt?.toISOString() ?? null,
      error: openErr ?? undefined,
    });
  }

  const opened = results.filter((r) => r.accessOpened).length;
  const failed = results.filter((r) => !r.accessOpened).length;
  return { total: results.length, opened, failed, results };
}
