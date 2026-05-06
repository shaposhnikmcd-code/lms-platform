import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import {
  REMINDER_TEMPLATES,
  wrapReminderInner,
  extractReminderInner,
  type ReminderTemplateKey,
} from '@/lib/emailTemplates/reminderTemplates';

const MAX_SUBJECT = 300;
const MAX_BODY = 50_000;
const DB_PREFIX = 'reminder.';

/// GET — повна інформація про один reminder-шаблон.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!(key in REMINDER_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }
  const meta = REMINDER_TEMPLATES[key as ReminderTemplateKey];
  const custom = await prisma.emailTemplate.findUnique({ where: { templateKey: `${DB_PREFIX}${key}` } });

  return NextResponse.json({
    key: meta.key,
    subject: custom?.subject ?? meta.defaultSubject,
    bodyHtml: custom?.bodyHtml ?? meta.defaultBodyHtml,
    bodyInnerHtml: extractReminderInner(custom?.bodyHtml ?? meta.defaultBodyHtml),
    defaultSubject: meta.defaultSubject,
    defaultBodyHtml: meta.defaultBodyHtml,
    defaultBodyInnerHtml: extractReminderInner(meta.defaultBodyHtml),
    isCustomized: !!custom,
    updatedAt: custom?.updatedAt?.toISOString() ?? null,
    updatedBy: custom?.updatedBy ?? null,
  });
}

/// PATCH — апсертить custom subject+bodyInnerHtml для reminder-template-а.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!(key in REMINDER_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; bodyHtml?: unknown; bodyInnerHtml?: unknown };
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  let bodyHtml: string;
  if (typeof body.bodyInnerHtml === 'string') {
    bodyHtml = wrapReminderInner(body.bodyInnerHtml);
  } else if (typeof body.bodyHtml === 'string') {
    bodyHtml = body.bodyHtml;
  } else {
    bodyHtml = '';
  }

  if (!subject || subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Тема має бути від 1 до ${MAX_SUBJECT} символів` }, { status: 400 });
  }
  if (!bodyHtml.trim() || bodyHtml.length > MAX_BODY) {
    return NextResponse.json({ error: `Тіло листа має бути від 1 до ${MAX_BODY} символів` }, { status: 400 });
  }

  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const dbKey = `${DB_PREFIX}${key}`;

  const row = await prisma.emailTemplate.upsert({
    where: { templateKey: dbKey },
    create: { templateKey: dbKey, subject, bodyHtml, updatedBy: actorLabel },
    update: { subject, bodyHtml, updatedBy: actorLabel },
  });

  return NextResponse.json({
    ok: true,
    isCustomized: true,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyInnerHtml: extractReminderInner(row.bodyHtml),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  });
}

/// DELETE — видаляє custom рядок → email-функція fallback-не на дефолт із коду.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!(key in REMINDER_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }

  await prisma.emailTemplate.deleteMany({ where: { templateKey: `${DB_PREFIX}${key}` } });

  const meta = REMINDER_TEMPLATES[key as ReminderTemplateKey];
  return NextResponse.json({
    ok: true,
    isCustomized: false,
    subject: meta.defaultSubject,
    bodyHtml: meta.defaultBodyHtml,
    bodyInnerHtml: extractReminderInner(meta.defaultBodyHtml),
  });
}
