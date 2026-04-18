import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const CONNECTOR_ORDER_STATUSES = ['NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === 'ADMIN' ? session : null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, city, postOffice, gamePrice, shippingCost, callMe } = await req.json();

    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';
    const finalGamePrice = isAdmin ? 1 : (typeof gamePrice === 'number' ? gamePrice : 1099);
    const finalShippingCost = isAdmin ? 0 : (typeof shippingCost === 'number' ? shippingCost : 0);
    const finalAmount = finalGamePrice + finalShippingCost;

    // orderReference генерується server-side щоб не довіряти клієнту
    const orderReference = `connector_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

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

    return NextResponse.json({ success: true, orderId: order.id, orderReference });
  } catch (error) {
    console.error('❌ Помилка створення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const statusFilter =
      status && (CONNECTOR_ORDER_STATUSES as readonly string[]).includes(status)
        ? { orderStatus: status as (typeof CONNECTOR_ORDER_STATUSES)[number] }
        : undefined;

    const orders = await prisma.connectorOrder.findMany({
      where: statusFilter,
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
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, orderStatus, trackingNumber, managerNote, actualShippingCost } = await req.json();

    if (orderStatus && !(CONNECTOR_ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid orderStatus' }, { status: 400 });
    }

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
      const actor = session?.user;
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
