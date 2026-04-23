import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validatePasswordFull } from '@/lib/passwordPolicy';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Зміна паролю недоступна для OAuth акаунтів' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Поточний пароль невірний' }, { status: 400 });
    }

    // Єдина політика пароля (min 8 + HIBP). Див. lib/passwordPolicy.ts.
    const policy = await validatePasswordFull(newPassword);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.message }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { email: session.user.email! },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Помилка зміни паролю:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}