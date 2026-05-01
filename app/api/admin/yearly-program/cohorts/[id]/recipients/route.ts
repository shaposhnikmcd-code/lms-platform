import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { MAILER_FROM_EMAIL, isMailerConfigured } from '@/lib/mailer';

/// GET — список одержувачів welcome-розсилки + From-адреса.
/// Повертає кого саме охопить кнопка "Надіслати зараз" / "Запланувати":
///   recipients[].alreadySent — чи вже отримував welcome-лист (буде пропущено).
/// Використовується в SendEmailsModal для прозорості перед запуском.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { name: true, email: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { metadata: true },
      },
      payments: {
        where: { status: 'PAID' },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const recipients = subs
    .filter((s) => s.user?.email)
    .map((s) => {
      const alreadySent = s.events.some((ev) => {
        const m = ev.metadata as { cohortId?: string } | null;
        return m?.cohortId === id;
      });
      return {
        subscriptionId: s.id,
        name: s.user?.name ?? null,
        email: s.user!.email,
        alreadySent,
        hasPaidPayment: s.payments.length > 0,
        plan: s.plan,
        autoRenew: s.autoRenew,
      };
    });

  return NextResponse.json({
    fromEmail: MAILER_FROM_EMAIL,
    resendConfigured: isMailerConfigured(),
    recipients,
    summary: {
      total: recipients.length,
      pending: recipients.filter((r) => !r.alreadySent).length,
      alreadySent: recipients.filter((r) => r.alreadySent).length,
    },
  });
}
