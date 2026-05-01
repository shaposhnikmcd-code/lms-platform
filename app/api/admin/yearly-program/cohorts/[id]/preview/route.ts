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

  return NextResponse.json(rendered);
}
