import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

const MAX_SUBJECT = 300;
const MAX_BODY = 50_000;

/// PATCH — апсертить custom subject+bodyHtml для template-а. Body: { subject, bodyHtml }.
/// Обидва поля валідуються по довжині. Update мутує існуючий рядок або створює новий.
/// DELETE — видаляє custom рядок → email-функція fallback-не на дефолт із коду.
/// Використовується кнопкою "Скинути до дефолту" в UI.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!(key in PAYMENT_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; bodyHtml?: unknown };
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml : '';

  if (!subject || subject.length > MAX_SUBJECT) {
    return NextResponse.json(
      { error: `Тема має бути від 1 до ${MAX_SUBJECT} символів` },
      { status: 400 },
    );
  }
  if (!bodyHtml.trim() || bodyHtml.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Тіло листа має бути від 1 до ${MAX_BODY} символів` },
      { status: 400 },
    );
  }

  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';

  const row = await prisma.emailTemplate.upsert({
    where: { templateKey: key },
    create: {
      templateKey: key,
      subject,
      bodyHtml,
      updatedBy: actorLabel,
    },
    update: {
      subject,
      bodyHtml,
      updatedBy: actorLabel,
    },
  });

  return NextResponse.json({
    ok: true,
    isCustomized: true,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!(key in PAYMENT_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }

  await prisma.emailTemplate.deleteMany({ where: { templateKey: key } });

  const meta = PAYMENT_TEMPLATES[key as PaymentTemplateKey];
  return NextResponse.json({
    ok: true,
    isCustomized: false,
    subject: meta.defaultSubject,
    bodyHtml: meta.defaultBodyHtml,
  });
}
