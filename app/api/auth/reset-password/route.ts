/// GET  /api/auth/reset-password?token=…  — валідувати токен (для показу форми або помилки)
/// POST /api/auth/reset-password            — встановити новий пароль {token, password}
///
/// Токен single-use: consume відбувається в транзакції з оновленням User.password.
/// Валідація пароля — через єдиний passwordPolicy (min 8 + HIBP).

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import {
  verifyPasswordResetToken,
  consumePasswordResetToken,
} from '@/lib/passwordResetToken';
import { validatePasswordFull } from '@/lib/passwordPolicy';
import { checkRateLimit } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing_token' }, { status: 400 });
  }

  const verified = await verifyPasswordResetToken(token);
  if (!verified) {
    return NextResponse.json({ valid: false, reason: 'invalid_or_expired' });
  }

  // Для UI корисно знати purpose — змінюємо хедер сторінки (invite vs reset).
  return NextResponse.json({ valid: true, purpose: verified.purpose });
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'resetPassword');
    if (!rl.ok) return rl.response!;

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    const password = body.password;

    if (!token) {
      return NextResponse.json({ error: 'Токен обовʼязковий' }, { status: 400 });
    }

    const verified = await verifyPasswordResetToken(token);
    if (!verified) {
      return NextResponse.json(
        { error: 'Посилання недійсне або протерміноване. Спробуйте запросити скидання ще раз.' },
        { status: 400 },
      );
    }

    const policy = await validatePasswordFull(password);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.message }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password as string, 12);

    // Критична секція: спершу consume (атомарно), потім оновлюємо password.
    // Якщо consume провалився (race з іншим запитом) — 400, юзер запросить новий лінк.
    const consumed = await consumePasswordResetToken(verified.id);
    if (!consumed) {
      return NextResponse.json(
        { error: 'Посилання вже використано або протерміновано.' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: verified.userId },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ /api/auth/reset-password:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
