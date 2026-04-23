/// POST /api/auth/forgot-password — запит на скидання пароля.
///
/// Anti-enumeration: завжди повертаємо 200 з однаковим текстом, незалежно від того,
/// існує юзер чи ні, має він password чи OAuth-only. Клієнт не може відрізнити
/// валідний email від невалідного.
///
/// Rate-limit: per-email, 5/год — захист від email-спаму та бомбардування чужої скриньки.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createPasswordResetToken } from '@/lib/passwordResetToken';
import { sendEmail, appBaseUrl } from '@/lib/mailer';
import { resetEmailHtml } from '@/lib/emailTemplates/passwordReset';
import { checkRateLimit } from '@/lib/ratelimit';

const GENERIC_RESPONSE = {
  success: true,
  message: 'Якщо акаунт з такою поштою існує — ми надіслали лист з інструкціями.',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Невірний email' }, { status: 400 });
    }

    // Rate-limit per-email. IP-limit додатково не ставимо, бо атакер міг би
    // блокувати юзера від легітимного скидання.
    const rl = await checkRateLimit(req, 'forgotPassword', `email:${email}`);
    if (!rl.ok) return rl.response!;

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, name: true },
    });

    // Anti-enumeration: не розкриваємо чи юзер існує. Відповідь та сама.
    if (!user) return NextResponse.json(GENERIC_RESPONSE);

    const { rawToken, expiresAt } = await createPasswordResetToken({
      userId: user.id,
      purpose: 'RESET',
    });

    const resetUrl = `${appBaseUrl()}/uk/reset-password?token=${encodeURIComponent(rawToken)}`;

    await sendEmail({
      to: user.email,
      subject: 'UIMP — скидання пароля',
      html: resetEmailHtml({
        userName: user.name,
        userEmail: user.email,
        resetUrl,
        expiresAt,
      }),
      devPreviewHint: resetUrl,
    });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('❌ /api/auth/forgot-password:', error);
    // Навіть при серверній помилці даємо generic-відповідь, щоб не розкривати стан системи.
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
