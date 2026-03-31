import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, email, fullName, phone, city, postOffice, amount, callMe } = await req.json();

    const order = await prisma.connectorOrder.create({
      data: {
        orderReference,
        email,
        fullName,
        phone,
        city,
        postOffice,
        amount,
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
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('❌ Помилка отримання замовлень:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, orderStatus, trackingNumber, managerNote } = await req.json();

    const order = await prisma.connectorOrder.update({
      where: { id },
      data: {
        ...(orderStatus && { orderStatus }),
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(managerNote !== undefined && { managerNote }),
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('❌ Помилка оновлення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}