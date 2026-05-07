import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

/// POST — preview welcome-листа. Body: { subject?, body? }.
/// Якщо subject/body передані — рендериться з ними (для незбережених змін у редакторі).
/// Інакше — з cohort-у.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string };

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  const subjectTpl = (body.subject ?? cohort.launchEmailSubject) || DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const bodyTpl = (body.body ?? cohort.launchEmailBody) || DEFAULT_LAUNCH_EMAIL_BODY;

  const rendered = renderLaunchEmailTemplate({
    subject: subjectTpl,
    body: bodyTpl,
    variables: {
      name: 'Тетяна',
      email: 'student@example.com',
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      cohortName: cohort.name,
    },
  });

  // Iframe srcdoc: загортаємо launch-email body у стандартний UIMP email-layout (Arial,
  // max-width 600px, padding 24px) — щоб прев'ю виглядало 1-в-1 як решта прев'ю
  // (TemplateEditor). Body padding 12px (CSS) + layout padding 24px = 36px content offset,
  // парний з editor outer py-3 + inner py-6 = 36px. Реальні sent launch-листи поки не
  // мають цього wrapper-а — окремий тех-борг за межами поточного фіксу.
  const wrapped = `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">${rendered.body}</div>`;
  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;padding:12px 0 0;background:#fff;font-family:Arial,Helvetica,sans-serif;}</style>
</head>
<body>${wrapped}</body>
</html>`;

  return NextResponse.json({ subject: rendered.subject, body: html });
}
