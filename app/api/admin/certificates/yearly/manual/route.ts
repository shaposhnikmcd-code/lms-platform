/// POST /api/admin/certificates/yearly/manual — персональна (manual) видача Річного
/// сертифіката адміном за вільно вписаним email-ом і вибраною категорією
/// (LISTENER / PRACTICAL). Юзер шукається по email (case-insensitive); якщо нема —
/// створюється новий. Якщо для цього юзера вже є активний Yearly-сертифікат тієї ж
/// категорії — повертаємо 409; з `force: true` revoke-ить попередній і видає новий.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import {
  findConflictingYearlyCertificate,
  issueManualYearlyCertificate,
  revokeCertificate,
  yearlyCategoryLabel,
} from '@/lib/certificates/service';
import type { CertCategory, CertLanguages } from '@prisma/client';

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
    recipientNameEn,
    languages,
    category,
    sendEmail,
    force,
  } = (body ?? {}) as {
    recipientName?: string;
    recipientEmail?: string;
    recipientNameEn?: string;
    languages?: CertLanguages;
    category?: CertCategory;
    sendEmail?: boolean;
    force?: boolean;
  };

  const name = recipientName?.trim();
  const emailRaw = recipientEmail?.trim();
  if (!name) return NextResponse.json({ error: "Ім'я обов'язкове" }, { status: 400 });
  if (!emailRaw) return NextResponse.json({ error: 'Email обов\'язковий' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
  }
  if (category !== 'LISTENER' && category !== 'PRACTICAL' && category !== 'PARTICIPANT') {
    return NextResponse.json({ error: 'Невалідна категорія' }, { status: 400 });
  }
  /// Порожнє англ. ім'я — це не «вимкнено», а недозаповнена форма: краще 400,
  /// ніж мовчазний односторінковий PDF замість очікуваного двомовного.
  if (recipientNameEn !== undefined && !String(recipientNameEn).trim()) {
    return NextResponse.json({ error: 'Англійське ім\'я не може бути порожнім' }, { status: 400 });
  }
  /// Набір сторінок PDF — строгий allow-list: невідоме значення краще відхилити,
  /// ніж мовчки видати сертифікат не тією мовою.
  if (languages !== undefined && languages !== 'UK' && languages !== 'EN' && languages !== 'UK_EN') {
    return NextResponse.json({ error: 'languages має бути UK, EN або UK_EN' }, { status: 400 });
  }
  if ((languages === 'EN' || languages === 'UK_EN') && !String(recipientNameEn ?? '').trim()) {
    return NextResponse.json(
      { error: 'Для англійської версії вкажіть ім\'я латиницею' },
      { status: 400 },
    );
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

  /// Конфліктом вважаємо не тільки дубль тієї ж категорії, а й будь-який активний
  /// серт на підписці, до якої привʼязався б новий (див. findConflictingYearlyCertificate).
  /// Обидва випадки віддаємо однаково — 409 EXISTS, щоб UI показав звичний
  /// «перевипустити» замість тупикової помилки.
  if (user && !force) {
    const existing = await findConflictingYearlyCertificate(user.id, category);
    if (existing) {
      return NextResponse.json(
        {
          error: 'EXISTS',
          existing,
          /// Категорія КОНФЛІКТНОГО серта (може відрізнятись від обраної у формі) —
          /// щоб попап писав правду про те, що саме буде відкликано.
          categoryLabel: yearlyCategoryLabel(existing.category ?? category),
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

  /// Force відкликає рівно той серт, який щойно показали менеджеру як конфліктний
  /// (та сама функція пошуку) — інакше перевипуск упирався б у guard у сервісі.
  if (force) {
    const existing = await findConflictingYearlyCertificate(user.id, category);
    if (existing) {
      await revokeCertificate(existing.id, guard.actor, 'Перевипуск (manual yearly issue, force=true)');
    }
  }

  try {
    const result = await issueManualYearlyCertificate({
      userId: user.id,
      category,
      recipientName: name,
      recipientNameEn,
      languages,
      sendEmail: sendEmail !== false,
      actor: guard.actor,
    });
    return NextResponse.json({
      certificate: result.certificate,
      emailStatus: result.certificate.emailStatus,
      ...(result.email && !result.email.ok
        ? {
            warning: `Сертифікат ${result.certificate.certNumber} видано, але лист не пішов: ${result.email.error ?? 'невідома помилка'}. Дошліть його кнопкою «Надіслати листом».`,
          }
        : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
