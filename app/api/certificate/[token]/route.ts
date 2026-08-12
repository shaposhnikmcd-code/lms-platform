/// GET /api/certificate/[token] — публічна верифікація сертифіката (no auth).
/// Повертає публічний мінімум: recipient, дата, тип, категорія, номер, revoked-статус,
/// а також посилання на курс (якщо COURSE) або на Річну програму (якщо YEARLY).
/// Rate-limited щоб захистити від перебору токенів.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';
import { appBaseUrl } from '@/lib/mailer';
import { clientIpFrom, logCertificateView } from '@/lib/certificates/viewLog';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = await checkRateLimit(req, 'certVerify');
  if (!rl.ok) return rl.response!;

  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const cert = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    select: {
      id: true,
      certNumber: true,
      type: true,
      category: true,
      recipientName: true,
      courseName: true,
      courseId: true,
      course: { select: { slug: true, title: true } },
      issueYear: true,
      issuedAt: true,
      revoked: true,
      revokedAt: true,
      revokedReason: true,
    },
  });

  if (!cert) {
    return NextResponse.json({ error: 'Сертифікат не знайдено' }, { status: 404 });
  }

  /// VIEWED — fire-and-forget, не блокуємо відповідь. Дедуплікація 1/год на (cert, IP)
  /// живе всередині `logCertificateView`: сторінка верифікації сама смикає цей роут,
  /// тож без неї один перегляд писав би кілька подій.
  void logCertificateView(
    cert.id,
    clientIpFrom(req.headers.get('x-forwarded-for')),
    req.headers.get('user-agent'),
  );

  const linkUrl =
    cert.type === 'COURSE' && cert.course?.slug
      ? `${appBaseUrl()}/uk/courses/${cert.course.slug}`
      : cert.type === 'YEARLY_PROGRAM'
        ? `${appBaseUrl()}/uk/yearly-program`
        : null;

  return NextResponse.json({
    certNumber: cert.certNumber,
    type: cert.type,
    category: cert.category,
    recipientName: cert.recipientName,
    courseName: cert.courseName ?? cert.course?.title ?? null,
    issueYear: cert.issueYear,
    issuedAt: cert.issuedAt,
    revoked: cert.revoked,
    revokedAt: cert.revokedAt,
    revokedReason: cert.revokedReason,
    linkUrl,
  });
}
