import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

/// POST — надіслати тестовий welcome-лист на вказану адресу.
/// Body: { to: string, subject?: string, body?: string }
/// subject/body — опціонально перебивають збережені в cohort-і (для preview незбережених змін).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!body.to || typeof body.to !== 'string' || !body.to.includes('@')) {
    return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
  }

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  const subjectTpl = (body.subject ?? cohort.launchEmailSubject) || DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const bodyTpl = (body.body ?? cohort.launchEmailBody) || DEFAULT_LAUNCH_EMAIL_BODY;

  const { subject, body: html } = renderLaunchEmailTemplate({
    subject: subjectTpl,
    body: bodyTpl,
    variables: {
      name: 'Тест Тестенко',
      email: body.to,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      cohortName: cohort.name,
    },
  });

  const res = await sendEmail({
    to: body.to,
    subject: `[ТЕСТ] ${subject}`,
    html,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, messageId: res.messageId });
}
