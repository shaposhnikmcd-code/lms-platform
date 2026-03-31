import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Ім\'я занадто коротке' }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: session.user.email! },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Помилка оновлення профілю:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}