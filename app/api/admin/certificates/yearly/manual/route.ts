/// POST /api/admin/certificates/yearly/manual — персональна (manual) видача Річного
/// сертифіката адміном за вільно вписаним email-ом і вибраною категорією
/// (LISTENER / PRACTICAL). Юзер шукається по email (case-insensitive); якщо нема —
/// створюється новий. Якщо для цього юзера вже є активний Yearly-сертифікат тієї ж
/// категорії — повертаємо 409; з `force: true` revoke-ить попередній і видає новий.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueManualYearlyCertificate, revokeCertificate } from '@/lib/certificates/service';
import type { CertCategory } from '@prisma/client';

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
    category,
    force,
  } = (body ?? {}) as {
    recipientName?: string;
    recipientEmail?: string;
    category?: CertCategory;
    force?: boolean;
  };

  const name = recipientName?.trim();
  const emailRaw = recipientEmail?.trim();
  if (!name) return NextResponse.json({ error: "Ім'я обов'язкове" }, { status: 400 });
  if (!emailRaw) return NextResponse.json({ error: 'Email обов\'язковий' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
  }
  if (category !== 'LISTENER' && category !== 'PRACTICAL') {
    return NextResponse.json({ error: 'Невалідна категорія' }, { status: 400 });
  }
  const email = emailRaw.toLowerCase();

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

  if (user && !force) {
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, type: 'YEARLY_PROGRAM', category, revoked: false },
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
          categoryLabel: category === 'LISTENER' ? 'Слухач' : 'Практична участь',
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

  if (force) {
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, type: 'YEARLY_PROGRAM', category, revoked: false },
      select: { id: true },
    });
    if (existing) {
      await revokeCertificate(existing.id, guard.actor, 'Перевипуск (manual yearly issue, force=true)');
    }
  }

  try {
    const cert = await issueManualYearlyCertificate({
      userId: user.id,
      category,
      recipientName: name,
      actor: guard.actor,
    });
    return NextResponse.json({ certificate: cert });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
