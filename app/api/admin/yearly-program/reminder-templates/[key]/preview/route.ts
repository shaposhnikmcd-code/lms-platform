import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import { renderTemplate } from '@/lib/emailTemplates/paymentTemplates';
import {
  REMINDER_TEMPLATES,
  getReminderTemplate,
  wrapReminderInner,
  daysWordVar,
  type ReminderTemplateKey,
} from '@/lib/emailTemplates/reminderTemplates';

/// GET — рендерить ПОТОЧНИЙ збережений шаблон (custom з БД або default з коду) з sample-data.
/// POST — рендерить ПЕРЕДАНИЙ draft (subject + bodyInnerHtml).

/// Sample-data перекриває {graceDays}/{graceDaysWord}/{daysLeft}/{daysWord} актуальними значеннями
/// з налаштувань — щоб прев'ю в адмінці точно відображало те, що побачить реальний студент.
/// daysLeft рахується по-різному залежно від типу шаблона:
///   *-grace-mid → floor(graceDays/2) (середина періоду)
///   *-grace-last → 1 (фінальний день)
///   інші — лишається з дефолтного sampleData (deterministic, для попередніх версій листів).
async function buildSampleData(key: ReminderTemplateKey): Promise<Record<string, string>> {
  const meta = REMINDER_TEMPLATES[key];
  const graceDays = await getYearlyGraceDays(prisma);

  let daysLeft: number | null = null;
  if (key === 'manual-grace-mid' || key === 'cyclical-grace-mid') {
    daysLeft = Math.max(1, Math.floor(graceDays / 2));
  } else if (key === 'manual-grace-last' || key === 'cyclical-grace-last') {
    daysLeft = 1;
  }

  return {
    ...meta.sampleData,
    graceDays: String(graceDays),
    graceDaysWord: daysWordVar(graceDays),
    ...(daysLeft !== null
      ? { daysLeft: String(daysLeft), daysWord: daysWordVar(daysLeft) }
      : {}),
  };
}

async function renderHtml(key: string, subject: string, bodyHtml: string): Promise<string> {
  const sample = await buildSampleData(key as ReminderTemplateKey);
  const renderedSubject = renderTemplate(subject, sample);
  const renderedBody = renderTemplate(bodyHtml, sample);
  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${renderedSubject.replace(/[<>"']/g, '')}</title>
<style>body{margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;}.subj{padding:8px 16px;background:#fff;border-bottom:1px solid #e5e5e5;font-size:13px;color:#555;}</style>
</head>
<body>
<div class="subj"><b>Тема:</b> ${renderedSubject}</div>
${renderedBody}
</body>
</html>`;
}

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
  const tpl = await getReminderTemplate(key as ReminderTemplateKey);
  const html = await renderHtml(key, tpl.subject, tpl.bodyHtml);
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST(
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
  const body = (await req.json().catch(() => ({}))) as { subject?: string; bodyHtml?: string; bodyInnerHtml?: string };
  const subject = typeof body.subject === 'string' ? body.subject : '';
  const bodyHtml = typeof body.bodyInnerHtml === 'string'
    ? wrapReminderInner(body.bodyInnerHtml)
    : (typeof body.bodyHtml === 'string' ? body.bodyHtml : '');
  const html = await renderHtml(key, subject, bodyHtml);
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
