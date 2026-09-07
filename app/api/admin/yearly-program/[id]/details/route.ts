import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { cohortModuleCount, monthlySchedule } from '@/lib/yearlyProgramAccess';
import { assignPaymentModules, moduleMonthLabel, type ModuleRef } from '@/lib/yearlyProgramModules';

/// Деталі однієї підписки + повний лог подій + список платежів. Для expandable row в адмінці.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const { id } = await params;
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, adminNote: true, adminNoteUpdatedAt: true, adminNoteUpdatedBy: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderReference: true,
          amount: true,
          status: true,
          createdAt: true,
          paidAt: true,
          manualMethod: true,
          manualNote: true,
          excludedFromAccess: true,
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
      // Межі набору — щоб розкласти платежі по модулях ТІЄЮ Ж сіткою, якою рахується
      // доступ. Без цього панель «Платежі» рахувала б модулі власною арифметикою.
      cohort: { select: { startDate: true, endDate: true } },
    },
  });

  if (!sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Сітка модулів: тільки для місячної підписки з набором. Для річної питання «який
  // модуль оплачено» не існує (один платіж покриває все), для підписки без набору —
  // не існує самої сітки.
  const cohort = sub.cohort;
  const schedule = sub.plan === 'MONTHLY' && cohort
    ? monthlySchedule({ cohort, payments: sub.payments })
    : null;
  const modulesByPayment: Map<string, ModuleRef> = sub.plan === 'MONTHLY' && cohort
    ? assignPaymentModules({ cohort, payments: sub.payments })
    : new Map();

  return NextResponse.json({
    id: sub.id,
    user: sub.user,
    adminNote: sub.user?.adminNote ?? null,
    adminNoteUpdatedAt: sub.user?.adminNoteUpdatedAt?.toISOString() ?? null,
    adminNoteUpdatedBy: sub.user?.adminNoteUpdatedBy ?? null,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    status: sub.status,
    startDate: sub.startDate?.toISOString() ?? null,
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    cancelledBy: sub.cancelledBy,
    cancelledReason: sub.cancelledReason,
    lastPaymentAt: sub.lastPaymentAt?.toISOString() ?? null,
    lastChargeAttemptAt: sub.lastChargeAttemptAt?.toISOString() ?? null,
    lastChargeError: sub.lastChargeError,
    failedChargeCount: sub.failedChargeCount,
    sendpulseStudentId: sub.sendpulseStudentId,
    sendpulseAccessOpenedAt: sub.sendpulseAccessOpenedAt?.toISOString() ?? null,
    sendpulseAccessClosedAt: sub.sendpulseAccessClosedAt?.toISOString() ?? null,
    reminderSent3d: sub.reminderSent3d,
    reminderSentExpired: sub.reminderSentExpired,
    country: sub.country,
    telegramUsername: sub.telegramUsername,
    telegramInviteLink: sub.telegramInviteLink,
    telegramInvitedAt: sub.telegramInvitedAt?.toISOString() ?? null,
    telegramInviteError: sub.telegramInviteError,
    telegramJoinedAt: sub.telegramJoinedAt?.toISOString() ?? null,
    telegramLeftAt: sub.telegramLeftAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    schedule: schedule && cohort
      ? {
        firstSlot: schedule.firstSlot,
        totalSlots: schedule.totalSlots,
        paidCount: schedule.paidCount,
        isFullyPaid: schedule.isFullyPaid,
        moduleCount: cohortModuleCount(cohort),
        nextModuleNumber: schedule.nextSlotStart ? schedule.nextSlotIndex + 1 : null,
        nextModuleMonth: schedule.nextSlotStart ? moduleMonthLabel(schedule.nextSlotStart) : null,
      }
      : null,
    payments: sub.payments.map((p) => {
      const paymentModule = modulesByPayment.get(p.id);
      return {
        id: p.id,
        orderReference: p.orderReference,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        manualMethod: p.manualMethod,
        manualNote: p.manualNote,
        excludedFromAccess: p.excludedFromAccess,
        // null — платіж не зараховано в доступ (PENDING, відхилений, виключений) або
        // сітки для цієї підписки немає: номера модуля в такого платежу просто нема.
        module: paymentModule
          ? { number: paymentModule.number, total: paymentModule.total, monthLabel: paymentModule.monthLabel }
          : null,
      };
    }),
    events: sub.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
