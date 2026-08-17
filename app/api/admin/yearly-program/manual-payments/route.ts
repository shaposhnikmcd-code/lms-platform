import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';

/// Реєстр УСІХ ручних платежів Річної програми (manualMethod != null) по всіх підписках —
/// для вкладки «Ручні платежі» в адмінці. Сюди входять і оплати поза WayForPay
/// (готівка / переказ / ФОП), і перенесення з минулого набору (`carryover`, 0 ₴).
/// WFP-платежі (manualMethod = null) у реєстр не потрапляють — вони видні в «Платежах».
///
/// Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD&q=пошук` — фільтр по даті ВНЕСЕННЯ (createdAt)
/// і пошук по імені/email клієнта. Сортування — новіші зверху.
const MAX_ROWS = 1000;

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const fromRaw = sp.get('from');
  const toRaw = sp.get('to');

  const createdAt: Prisma.DateTimeFilter = {};
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата «з»' }, { status: 400 });
    }
    createdAt.gte = d;
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата «по»' }, { status: 400 });
    }
    // Дата без часу означає «включно з цим днем» — розширюємо до кінця доби.
    if (/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) d.setHours(23, 59, 59, 999);
    createdAt.lte = d;
  }

  const where: Prisma.PaymentWhereInput = {
    manualMethod: { not: null },
    yearlyProgramSubscriptionId: { not: null },
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(q
      ? {
        user: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
      }
      : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      // Другий ключ обов'язковий: частки одного внесення (авто-розбивка) створюються в
      // одній транзакції й мають ІДЕНТИЧНИЙ createdAt — без tie-breaker-а порядок рядків
      // між запитами плаває, і групи внесень «розсипаються» по сторінці по-різному.
      orderBy: [{ createdAt: 'desc' }, { orderReference: 'asc' }],
      take: MAX_ROWS,
      select: {
        id: true,
        orderReference: true,
        amount: true,
        status: true,
        createdAt: true,
        paidAt: true,
        manualMethod: true,
        manualNote: true,
        manualEnteredBy: true,
        excludedFromAccess: true,
        user: { select: { id: true, name: true, email: true } },
        yearlyProgramSubscription: {
          select: {
            id: true,
            plan: true,
            autoRenew: true,
            status: true,
            cohort: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({
    total,
    truncated: total > payments.length,
    rows: payments.map((p) => ({
      id: p.id,
      orderReference: p.orderReference,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
      method: p.manualMethod,
      note: p.manualNote,
      enteredBy: p.manualEnteredBy,
      excludedFromAccess: p.excludedFromAccess,
      subscriptionId: p.yearlyProgramSubscription?.id ?? null,
      plan: p.yearlyProgramSubscription?.plan ?? null,
      autoRenew: p.yearlyProgramSubscription?.autoRenew ?? null,
      subscriptionStatus: p.yearlyProgramSubscription?.status ?? null,
      cohortName: p.yearlyProgramSubscription?.cohort?.name ?? null,
      userName: p.user?.name ?? null,
      userEmail: p.user?.email ?? '',
    })),
  });
}
