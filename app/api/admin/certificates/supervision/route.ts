/// API сертифікатів Супервізії:
///   GET  — список усіх SUPERVISION-сертифікатів (для таблиці у адмінці).
///   POST — видача нового персонального сертифіката (як у course/manual, але без курсу).
///
/// На відміну від COURSE/YEARLY_PROGRAM, тут немає "кандидатів" — менеджер заповнює
/// форму вручну (ім'я + email + тема + опційна дата). Якщо юзера з таким email
/// немає — створюємо мінімальний User-запис (через issueSupervisionCertificate).
///
/// Помилки/невдалі відправки SUPERVISION НЕ потрапляють у вкладку "Помилки" — фільтр
/// лежить на стороні `app/api/admin/certificates/issues/route.ts`.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueSupervisionCertificate } from '@/lib/certificates/service';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const certs = await prisma.certificate.findMany({
    where: { type: 'SUPERVISION' },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      certNumber: true,
      recipientName: true,
      recipientEmail: true,
      courseName: true,
      supervisionDate: true,
      issueYear: true,
      issuedAt: true,
      issuedByName: true,
      issuedByEmail: true,
      emailStatus: true,
      emailSentAt: true,
      emailFromAddress: true,
      revoked: true,
    },
  });

  return NextResponse.json({ certificates: certs });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    recipientName,
    recipientEmail,
    topic,
    supervisionDate,
  } = (body ?? {}) as {
    recipientName?: string;
    recipientEmail?: string;
    topic?: string;
    /// ISO-дата (yyyy-mm-dd або повний ISO). null/undefined/'' → без дати.
    supervisionDate?: string | null;
  };

  const name = recipientName?.trim();
  const emailRaw = recipientEmail?.trim();
  const topicTrim = topic?.trim();

  if (!name) return NextResponse.json({ error: "Ім'я обов'язкове" }, { status: 400 });
  if (!emailRaw) return NextResponse.json({ error: 'Email обовʼязковий' }, { status: 400 });
  if (!topicTrim) return NextResponse.json({ error: 'Тема супервізії обовʼязкова' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
  }

  let parsedDate: Date | null = null;
  if (supervisionDate) {
    const d = new Date(supervisionDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата супервізії' }, { status: 400 });
    }
    parsedDate = d;
  }

  try {
    const cert = await issueSupervisionCertificate({
      recipientName: name,
      recipientEmail: emailRaw,
      topic: topicTrim,
      supervisionDate: parsedDate,
      actor: guard.actor,
    });
    return NextResponse.json({ certificate: cert });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
