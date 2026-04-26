/// Legacy endpoint /api/certificate?courseId=X — раніше рендерив HTML-сертифікат
/// on-the-fly. Тепер сертифікати — повноцінний PDF зі zelenimy полями+QR, зберігаються
/// у моделі `Certificate`. Цей роут став тонким редиректом на новий публічний PDF endpoint
/// (за verificationToken).

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get('courseId');
  if (!courseId) {
    return NextResponse.json({ error: 'courseId обовязковий' }, { status: 400 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const cert = await prisma.certificate.findFirst({
    where: { userId, courseId, type: 'COURSE', revoked: false },
    select: { verificationToken: true },
  });

  if (!cert) {
    return NextResponse.json({ error: 'Сертифікат не знайдено' }, { status: 404 });
  }

  return NextResponse.redirect(new URL(`/api/certificate/${cert.verificationToken}/pdf`, req.url));
}
