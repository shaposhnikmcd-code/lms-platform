import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { signInvite } from '@/lib/yearlyProgramInvite';
import { sendYearlyProgramManualAddInviteEmail } from '@/lib/yearlyProgramManualAddInviteEmail';

/// POST /api/admin/yearly-program/cohorts/[id]/invite
/// Body: { email, name?, sendEmail? }
/// Повертає: { url, token, expiresAt, payload, emailSent?, emailError? }
///
/// Менеджер генерує invite-link для студента, який не встиг купити Річну програму
/// до запуску. Студент відкриває посилання → стандартна форма Річної програми з
/// prefilled email (locked) і вибором плану (YEARLY / MONTHLY autopay / MONTHLY one-time).
/// Після оплати у callback підписка створюється з `manuallyAddedAt = now()` і
/// прив'язується до cohort-у з invite.
///
/// За замовчуванням (`sendEmail !== false`) система одразу шле студенту лист з посиланням
/// (шаблон `manual-add-invite` редагується в адмінці). Якщо `sendEmail: false` — повертаємо
/// тільки url для ручної відправки (legacy fallback).
///
/// Token валідний 7 днів. Підпис HMAC-SHA256 + NEXTAUTH_SECRET.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    sendEmail?: boolean;
  };

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email обов\'язковий і має бути валідним' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;

  const cohort = await prisma.yearlyProgramCohort.findUnique({
    where: { id },
    select: { id: true, name: true, endDate: true },
  });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }
  if (cohort.endDate.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Cohort вже завершився — invite не має сенсу' }, { status: 400 });
  }

  const invitedBy = actor?.email ?? 'admin';

  const token = signInvite({
    email,
    name,
    cohortId: cohort.id,
    invitedBy,
  });

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  const url = `${origin}/yearly-program?invite=${encodeURIComponent(token)}`;

  let emailSent = false;
  let emailError: string | null = null;
  if (body.sendEmail !== false) {
    try {
      const result = await sendYearlyProgramManualAddInviteEmail({
        to: email,
        name: name ?? null,
        inviteUrl: url,
        cohortName: cohort.name,
      });
      if (result.ok) {
        emailSent = true;
      } else {
        emailError = result.error ?? 'unknown error';
      }
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  return NextResponse.json({
    ok: true,
    url,
    token,
    payload: { email, name: name ?? null, cohortId: cohort.id, cohortName: cohort.name },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    emailSent,
    emailError,
  });
}
