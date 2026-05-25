import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

/// POST /api/admin/yearly-program/cleanup-abandoned
///
/// Архівує покинуті чекаути — PENDING-підписки, створені >48 год тому без жодного PAID-платежу.
/// На відміну від cron-чистки (поріг 30 днів) ручна дія використовує 48 год, бо ініціюється
/// менеджером усвідомлено — він бачить «🛒 Покинули чекаут» мітку і вирішує почистити.
///
/// Side-effects ARCHIVE не виконуємо (SP/TG/WFP): для abandoned їх просто немає, ніколи нічого
/// не відкривалось. Запис у YearlyProgramSubscriptionEvent зберігається для аудиту.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const candidates = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: threshold },
      payments: { none: { status: 'PAID' } },
    },
    select: { id: true, createdAt: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ archived: 0 });
  }

  const now = new Date();
  let archived = 0;
  const errors: string[] = [];

  for (const c of candidates) {
    try {
      await prisma.yearlyProgramSubscription.update({
        where: { id: c.id },
        data: {
          status: 'ARCHIVED',
          cancelledAt: now,
          cancelledBy: 'system_abandoned',
          cancelledReason: 'Manual cleanup: PENDING без оплати >48 год',
        },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: c.id,
          type: 'admin_action',
          message: 'Manually archived: abandoned checkout (PENDING without payment >48h)',
          metadata: {
            auto: false,
            reason: 'abandoned_checkout_manual',
            ageDays: Math.floor((now.getTime() - c.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          },
        },
      });
      archived += 1;
    } catch (e) {
      errors.push(`${c.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ archived, errors });
}
