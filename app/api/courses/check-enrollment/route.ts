import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';

/// Pre-submit enrollment check для CoursePurchaseDialog. Викликається коли користувач
/// заповнив email — щоб одразу показати банер "вже придбано" замість того, щоб давати
/// ввести промокод і впертися в 409 від /api/wayforpay. Hard-stop = серверна перевірка
/// на /api/wayforpay; цей endpoint лише UX-сигнал.
///
/// Скоуп — тільки звичайні курси. Пакети (bundle_*) і Річна (yearly-program*) мають
/// власні політики (можна докуповувати окремі курси після пакета; yearly cross-plan
/// блоки робляться окремою логікою), тому тут пропускаємо.
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'promo');
    if (!rl.ok) return rl.response!;

    const { email, courseId } = await req.json();

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ enrolled: false });
    }
    if (typeof courseId !== 'string' || !courseId) {
      return NextResponse.json({ enrolled: false });
    }

    // Скіпаємо для пакетів/Річної/конектора — у них своя логіка ownership-перевірки.
    if (
      courseId.startsWith('bundle_') ||
      courseId === 'yearly-program' ||
      courseId === 'yearly-program-monthly' ||
      courseId === 'connector' ||
      courseId.startsWith('connector_')
    ) {
      return NextResponse.json({ enrolled: false });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: trimmedEmail, deletedAt: null },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ enrolled: false });

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });

    return NextResponse.json({ enrolled: !!enrollment });
  } catch (error) {
    console.error('check-enrollment error:', error);
    return NextResponse.json({ enrolled: false }, { status: 500 });
  }
}
