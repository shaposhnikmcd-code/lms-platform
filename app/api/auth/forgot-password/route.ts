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
import { sendEmail, appBaseUrl, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';
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
    const displayName = user.name?.trim() || user.email;
    const expiresHuman = expiresAt.toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const resetButton = `<p style="margin: 24px 0;"><a href="${resetUrl}" style="display: inline-block; background: #D4A017; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">Створити новий пароль</a></p>`;

    const tpl = await getPaymentTemplate('password-reset');
    const vars = {
      greeting: `Здрастуйте, ${esc(displayName)}!`,
      resetButton,
      resetUrl,
      expiresHuman: esc(expiresHuman),
    };

    await sendEmail({
      to: user.email,
      subject: renderTemplate(tpl.subject, vars),
      html: renderTemplate(tpl.bodyHtml, vars),
      devPreviewHint: resetUrl,
    });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('❌ /api/auth/forgot-password:', error);
    // Навіть при серверній помилці даємо generic-відповідь, щоб не розкривати стан системи.
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
