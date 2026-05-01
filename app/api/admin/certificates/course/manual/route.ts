/// POST /api/admin/certificates/course/manual — персональна (manual) видача курсового
/// сертифіката адміном за вільно вписаним email-ом. Якщо юзера з таким email немає в БД —
/// створюємо нового (role=STUDENT). Якщо є — використовуємо його. Якщо для пари
/// (user, course) уже є активний сертифікат — повертаємо 409 з даними; повторний виклик
/// з `force: true` revoke-ить попередній і видає новий.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueCourseCertificate, revokeCertificate } from '@/lib/certificates/service';

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
    courseId,
    force,
  } = (body ?? {}) as {
    recipientName?: string;
    recipientEmail?: string;
    courseId?: string;
    force?: boolean;
  };

  const name = recipientName?.trim();
  const emailRaw = recipientEmail?.trim();
  if (!name) return NextResponse.json({ error: "Ім'я обов'язкове" }, { status: 400 });
  if (!emailRaw) return NextResponse.json({ error: 'Email обов\'язковий' }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: 'Виберіть курс' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
  }
  const email = emailRaw.toLowerCase();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ error: 'Курс не знайдено' }, { status: 404 });

  // Шукаємо юзера за email case-insensitive — щоб уникнути дублів через різний регістр.
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, deletedAt: true },
  });

  if (user?.deletedAt) {
    return NextResponse.json(
      { error: `Юзер з email ${user.email} в архіві. Відновіть в адмінці > Користувачі або вкажіть інший email.` },
      { status: 400 },
    );
  }

  // Якщо юзер уже є — перевіряємо, чи нема активного сертифіката для цього курсу.
  if (user && !force) {
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, type: 'COURSE', courseId, revoked: false },
      select: {
        id: true,
        certNumber: true,
        recipientName: true,
        recipientEmail: true,
        emailStatus: true,
        emailSentAt: true,
        issuedAt: true,
        issuedManually: true,
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'EXISTS',
          existing,
          courseTitle: course.title,
        },
        { status: 409 },
      );
    }
  }

  if (!user) {
    const created = await prisma.user.create({
      data: { email, name },
      select: { id: true, name: true, email: true, deletedAt: true },
    });
    user = created;
  }

  // force=true: revoke попередній активний (partial unique index не пускає 2 не-revoked).
  if (force) {
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, type: 'COURSE', courseId, revoked: false },
      select: { id: true },
    });
    if (existing) {
      await revokeCertificate(existing.id, guard.actor, 'Перевипуск (manual issue, force=true)');
    }
  }

  try {
    const cert = await issueCourseCertificate({
      userId: user.id,
      courseId,
      recipientName: name,
      actor: guard.actor,
      issuedManually: true,
    });
    return NextResponse.json({ certificate: cert });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
