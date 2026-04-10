import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, email, fullName, phone, city, postOffice, amount, gamePrice, shippingCost, callMe } = await req.json();

    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.role === 'ADMIN';
    const finalGamePrice = isAdmin ? 1 : (typeof gamePrice === 'number' ? gamePrice : 1099);
    const finalShippingCost = isAdmin ? 0 : (typeof shippingCost === 'number' ? shippingCost : 0);
    const finalAmount = finalGamePrice + finalShippingCost;

    const order = await prisma.connectorOrder.create({
      data: {
        orderReference,
        email,
        fullName,
        phone,
        city,
        postOffice,
        amount: finalAmount,
        gamePrice: finalGamePrice,
        shippingCost: finalShippingCost,
        callMe: callMe || false,
        paymentStatus: 'PENDING',
        orderStatus: 'NEW',
      },
    });

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('❌ Помилка створення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const orders = await prisma.connectorOrder.findMany({
      where: status ? { orderStatus: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('❌ Помилка отримання замовлень:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, orderStatus, trackingNumber, managerNote, actualShippingCost } = await req.json();

    const data: any = {
      ...(orderStatus && { orderStatus }),
      ...(managerNote !== undefined && { managerNote }),
      ...(actualShippingCost !== undefined && { actualShippingCost: actualShippingCost === null || actualShippingCost === '' ? null : Number(actualShippingCost) }),
    };

    // ТТН — записуємо/оновлюємо, фіксуємо хто і коли востаннє редагував + лог
    let logEntry: { value: string; actor: any } | null = null;
    if (trackingNumber !== undefined) {
      const value = (trackingNumber || '').trim();
      const session = await getServerSession(authOptions);
      const actor = session?.user as any;
      data.trackingNumber = value || null;
      data.trackingSetAt = value ? new Date() : null;
      data.trackingSetById = value ? (actor?.id ?? null) : null;
      data.trackingSetByName = value ? (actor?.name ?? null) : null;
      data.trackingSetByEmail = value ? (actor?.email ?? null) : null;
      data.trackingSetByRole = value ? (actor?.role ?? null) : null;
      if (value) logEntry = { value, actor };
    }

    const order = await prisma.connectorOrder.update({
      where: { id },
      data,
      include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
    });

    if (logEntry) {
      await prisma.connectorOrderTrackingLog.create({
        data: {
          orderId: id,
          value: logEntry.value,
          changedById: logEntry.actor?.id ?? null,
          changedByName: logEntry.actor?.name ?? null,
          changedByEmail: logEntry.actor?.email ?? null,
          changedByRole: logEntry.actor?.role ?? null,
        },
      });
      const refreshed = await prisma.connectorOrder.findUnique({
        where: { id },
        include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
      });
      return NextResponse.json({ success: true, order: refreshed });
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('❌ Помилка оновлення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}
