import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, wrapInnerHtml, extractInnerHtml, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

const MAX_SUBJECT = 300;
const MAX_BODY = 50_000;

function isYearlyTgKey(key: string): key is PaymentTemplateKey {
  return key in PAYMENT_TEMPLATES && PAYMENT_TEMPLATES[key as PaymentTemplateKey].group === 'yearly-telegram';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!isYearlyTgKey(key)) {
    return NextResponse.json({ error: 'Unknown yearly-telegram template key' }, { status: 404 });
  }
  const meta = PAYMENT_TEMPLATES[key];
  const custom = await prisma.emailTemplate.findUnique({ where: { templateKey: key } });

  return NextResponse.json({
    key: meta.key,
    subject: custom?.subject ?? meta.defaultSubject,
    bodyHtml: custom?.bodyHtml ?? meta.defaultBodyHtml,
    bodyInnerHtml: extractInnerHtml(custom?.bodyHtml ?? meta.defaultBodyHtml),
    defaultSubject: meta.defaultSubject,
    defaultBodyHtml: meta.defaultBodyHtml,
    defaultBodyInnerHtml: extractInnerHtml(meta.defaultBodyHtml),
    isCustomized: !!custom,
    updatedAt: custom?.updatedAt?.toISOString() ?? null,
    updatedBy: custom?.updatedBy ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!isYearlyTgKey(key)) {
    return NextResponse.json({ error: 'Unknown yearly-telegram template key' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; bodyHtml?: unknown; bodyInnerHtml?: unknown };
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  let bodyHtml: string;
  if (typeof body.bodyInnerHtml === 'string') {
    bodyHtml = wrapInnerHtml(body.bodyInnerHtml);
  } else if (typeof body.bodyHtml === 'string') {
    bodyHtml = body.bodyHtml;
  } else {
    bodyHtml = '';
  }

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
    create: { templateKey: key, subject, bodyHtml, updatedBy: actorLabel },
    update: { subject, bodyHtml, updatedBy: actorLabel },
  });

  return NextResponse.json({
    ok: true,
    isCustomized: true,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyInnerHtml: extractInnerHtml(row.bodyHtml),
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
  if (!isYearlyTgKey(key)) {
    return NextResponse.json({ error: 'Unknown yearly-telegram template key' }, { status: 404 });
  }

  await prisma.emailTemplate.deleteMany({ where: { templateKey: key } });

  const meta = PAYMENT_TEMPLATES[key];
  return NextResponse.json({
    ok: true,
    isCustomized: false,
    subject: meta.defaultSubject,
    bodyHtml: meta.defaultBodyHtml,
    bodyInnerHtml: extractInnerHtml(meta.defaultBodyHtml),
  });
}
