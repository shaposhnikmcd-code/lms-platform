import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

/// POST — запустити welcome-розсилку для cohort-у.
/// Body:
///   { mode: 'now' }                  → шле всім негайно (sequential)
///   { mode: 'schedule', at: ISOdate } → ставить emailScheduledFor; cron обробить пізніше
///
/// Шле тільки тим, хто ще не отримав (subscription.events не містить
/// `launch_email_sent_<cohortId>`). Дублікати при ретраї виключені.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'now' | 'schedule';
    at?: string;
    /// Якщо передано — шлемо тільки цим підпискам (ignore dedup за замовчуванням, бо це
    /// явний вибір менеджера). Використовується для повторної відправки конкретній людині
    /// з RecipientsBlock у SendEmailsModal.
    subscriptionIds?: string[];
    /// Bulk override: шле ВСІМ, ігноруючи `launch_email_sent` event (повторна розсилка цілому
    /// cohort-у). Без цього прапорця dedup стандартно блокує тих, хто вже отримав.
    force?: boolean;
    /// З `mode: 'schedule'` — скасування поточного `emailScheduledFor` (без планування нової дати).
    cancel?: boolean;
  };

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  if (body.mode === 'schedule') {
    if (body.subscriptionIds || body.force) {
      return NextResponse.json({ error: 'Планування підтримує лише повну розсилку cohort-у' }, { status: 400 });
    }
    if (body.cancel) {
      await prisma.yearlyProgramCohort.update({
        where: { id },
        data: { emailScheduledFor: null },
      });
      return NextResponse.json({ ok: true, cancelled: true });
    }
    if (!body.at) {
      return NextResponse.json({ error: 'Дата планування обов\'язкова' }, { status: 400 });
    }
    const at = new Date(body.at);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: 'Невірний формат дати' }, { status: 400 });
    }
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { emailScheduledFor: at },
    });
    return NextResponse.json({ ok: true, scheduledFor: at.toISOString() });
  }

  // mode = now — відправляємо одразу.
  // Якщо передані subscriptionIds — це per-recipient resend, ignore dedup автоматично.
  const force = body.force === true || (Array.isArray(body.subscriptionIds) && body.subscriptionIds.length > 0);
  const targetIds = Array.isArray(body.subscriptionIds) && body.subscriptionIds.length > 0
    ? body.subscriptionIds
    : null;
  return sendNowImpl(id, cohort, actorLabel, { force, targetIds });
}

async function sendNowImpl(
  cohortId: string,
  cohort: {
    name: string;
    startDate: Date;
    endDate: Date;
    launchEmailSubject: string | null;
    launchEmailBody: string | null;
  },
  actorLabel: string,
  opts: { force: boolean; targetIds: string[] | null } = { force: false, targetIds: null },
) {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
      ...(opts.targetIds ? { id: { in: opts.targetIds } } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { id: true, metadata: true },
      },
    },
  });

  const subjectTpl = cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const bodyTpl = cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;

  type Result = { subscriptionId: string; email: string; sent: boolean; error?: string; skipped?: string };
  const results: Result[] = [];

  for (const s of subs) {
    if (!s.user?.email) {
      results.push({ subscriptionId: s.id, email: '', sent: false, skipped: 'no_email' });
      continue;
    }
    // Dedup: якщо для цього cohort-у вже надсилали — пропускаємо. Для force=true (per-recipient
    // resend або bulk override) dedup ігноруємо — менеджер свідомо хоче повторно надіслати.
    const alreadySent = s.events.some((ev) => {
      const m = ev.metadata as { cohortId?: string } | null;
      return m?.cohortId === cohortId;
    });
    if (alreadySent && !opts.force) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'already_sent' });
      continue;
    }

    const { subject, body } = renderLaunchEmailTemplate({
      subject: subjectTpl,
      body: bodyTpl,
      variables: {
        name: s.user.name,
        email: s.user.email,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        cohortName: cohort.name,
      },
    });

    try {
      const res = await sendEmail({ to: s.user.email, subject, html: body });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_sent',
          message: `Welcome email sent by ${actorLabel}`,
          metadata: { cohortId, messageId: res.messageId },
        },
      });
      results.push({ subscriptionId: s.id, email: s.user.email, sent: true });
    } catch (e) {
      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        sent: false,
        error: (e as Error).message.slice(0, 200),
      });
    }
  }

  // emailSentAt позначає момент повної bulk-розсилки cohort-у. Для per-recipient resend
  // (targetIds) не оновлюємо — інакше історія показувала б "вся розсилка свіжа" хоча
  // насправді надіслали тільки одній людині.
  if (!opts.targetIds) {
    await prisma.yearlyProgramCohort.update({
      where: { id: cohortId },
      data: { emailSentAt: new Date(), emailScheduledFor: null },
    });
  }

  return NextResponse.json({
    ok: true,
    summary: {
      total: results.length,
      sent: results.filter((r) => r.sent).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.sent && !r.skipped).length,
    },
    results,
  });
}
