import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths } from '@/lib/yearlyProgramConfig';
import { runExtraLaunchForSubscription } from '@/lib/yearlyProgramLaunch';
import { parseTelegramUsername } from '@/lib/telegramUsername';
import { createPasswordResetToken } from '@/lib/passwordResetToken';
import { sendEmail, appBaseUrl, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';

/// POST /api/admin/yearly-program/manual-add
/// Body: { email, name?, plan, cohortId, telegramUsername?, openAccessNow, sendPasswordEmail? }
///
/// Менеджер додає студента у Річну програму ВРУЧНУ, БЕЗ нової оплати (напр. перенесення
/// з минулорічного набору — людина вже навчалась/оплачувала раніше). Платіж НЕ створюється —
/// дохід не чіпаємо.
///
/// Кроки:
/// 1. Знайти User за email; якщо нема — створити (рандомний пароль). За прапорцем
///    sendPasswordEmail — надіслати лист для встановлення пароля (INVITE-токен, 7 днів).
/// 2. Створити YearlyProgramSubscription у вибраному cohort зі статусом ACTIVE,
///    manuallyAddedAt=now, manuallyAddedBy=email менеджера, expiresAt через
///    calculateAccessUntil. Без платежів calculateAccessUntil поверне null → для cohort-у
///    ставимо cohort.endDate + postAccessMonths напряму.
/// 3. Якщо openAccessNow=true і cohort launched — відкрити SendPulse + welcome-лист через
///    runExtraLaunchForSubscription.
/// 4. Лог події admin_action «Додано вручну без оплати by <manager>».
///
/// Захист від дублів: якщо в юзера вже є жива (PENDING/ACTIVE/GRACE) підписка — 409.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const managerLabel = actor?.email ?? 'admin';

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    plan?: string;
    cohortId?: string;
    telegramUsername?: string;
    openAccessNow?: boolean;
    sendPasswordEmail?: boolean;
  };

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email обовʼязковий і має бути валідним' }, { status: 400 });
  }

  const plan = body.plan === 'YEARLY' || body.plan === 'MONTHLY' ? body.plan : null;
  if (!plan) {
    return NextResponse.json({ error: 'План має бути YEARLY або MONTHLY' }, { status: 400 });
  }

  const cohortId = typeof body.cohortId === 'string' ? body.cohortId.trim() : '';
  if (!cohortId) {
    return NextResponse.json({ error: 'Оберіть cohort (запуск)' }, { status: 400 });
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

  // Telegram username — опційний; якщо вказано, валідуємо/нормалізуємо.
  let telegramUsername: string | null = null;
  if (typeof body.telegramUsername === 'string' && body.telegramUsername.trim()) {
    const parsed = parseTelegramUsername(body.telegramUsername);
    if (!parsed.ok) {
      return NextResponse.json({ error: `Telegram: ${parsed.error}` }, { status: 400 });
    }
    telegramUsername = parsed.normalized;
  }

  const cohort = await prisma.yearlyProgramCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, startDate: true, endDate: true, launchedAt: true },
  });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort не знайдено' }, { status: 404 });
  }

  // 1) Знайти / створити User.
  let user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });
  let createdUser = false;
  if (!user) {
    // Якщо існує "zombie" видалений юзер з тим же email — звільняємо email (як у WFP-флоу).
    const zombie = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
    if (zombie && zombie.deletedAt) {
      await prisma.user.update({
        where: { id: zombie.id },
        data: { email: `deleted_${Date.now()}_${email}` },
      });
    }
    // Рандомний пароль: акаунт не входиться по паролю поки студент не встановить свій через лист.
    const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 12);
    user = await prisma.user.create({
      data: { email, name, password: randomPassword },
      select: { id: true, name: true, email: true },
    });
    createdUser = true;
  } else if (name && name !== user.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name },
      select: { id: true, name: true, email: true },
    });
  }

  // Захист від дублів: жива підписка вже існує.
  const existing = await prisma.yearlyProgramSubscription.findFirst({
    where: { userId: user.id, status: { in: ['PENDING', 'ACTIVE', 'GRACE'] } },
    select: { id: true, status: true, plan: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `У студента вже є активна підписка (${existing.plan}, ${existing.status}). Другу не створюю.`,
        code: 'subscription_exists',
        subscriptionId: existing.id,
      },
      { status: 409 },
    );
  }

  // 2) Розрахунок expiresAt. Без платежів calculateAccessUntil → null, тому для cohort-у
  //    ставимо cohort.endDate + postAccessMonths напряму (та сама логіка, що для YEARLY).
  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  let expiresAt = calculateAccessUntil({
    plan,
    autoRenew: false,
    cohort: { startDate: cohort.startDate, endDate: cohort.endDate },
    payments: [],
    postAccessMonths,
  });
  if (!expiresAt) {
    expiresAt = addCalendarMonths(cohort.endDate, postAccessMonths);
  }

  const now = new Date();
  const sub = await prisma.yearlyProgramSubscription.create({
    data: {
      userId: user.id,
      plan,
      autoRenew: false,
      status: 'ACTIVE',
      startDate: cohort.startDate,
      expiresAt,
      cohortId: cohort.id,
      manuallyAddedAt: now,
      manuallyAddedBy: managerLabel,
      ...(telegramUsername ? { telegramUsername } : {}),
    },
    select: { id: true },
  });

  // 4) Лог події (створюємо одразу — щоб подія була навіть якщо extra-launch впаде).
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Додано вручну без оплати by ${managerLabel}`,
      metadata: {
        manualAddNoPayment: true,
        actor: managerLabel,
        plan,
        cohortId: cohort.id,
        userCreated: createdUser,
        openAccessNow: !!body.openAccessNow,
      },
    },
  });

  // Опційний лист для встановлення пароля (тільки для щойно створеного акаунта).
  let passwordEmail: { sent: boolean; error?: string } | null = null;
  if (createdUser && body.sendPasswordEmail) {
    passwordEmail = await sendPasswordSetupEmail(user.id, user.email, user.name);
  }

  // 3) Відкриття доступу + welcome-лист, якщо попросили і cohort launched.
  let extraLaunch: Awaited<ReturnType<typeof runExtraLaunchForSubscription>> | null = null;
  if (body.openAccessNow) {
    if (!cohort.launchedAt) {
      // Cohort ще не запущено — доступ відкриється на загальному запуску. Не помилка.
      extraLaunch = null;
    } else {
      extraLaunch = await runExtraLaunchForSubscription(sub.id, managerLabel);
    }
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    userCreated: createdUser,
    cohortLaunched: !!cohort.launchedAt,
    expiresAt: expiresAt?.toISOString() ?? null,
    extraLaunch,
    passwordEmail,
  });
}

/// Локальна копія addCalendarMonths з yearlyProgramAccess (там не експортується).
/// Додає `months` календарних місяців, клемпуючи день до останнього дня цільового місяця.
function addCalendarMonths(date: Date, months: number): Date {
  if (!months) return new Date(date);
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTarget));
  return result;
}

/// Лист "встановіть пароль" для щойно створеного акаунта. Використовує INVITE-токен
/// (7 днів) + шаблон password-reset (та сама кнопка «Створити новий пароль»).
async function sendPasswordSetupEmail(
  userId: string,
  userEmail: string,
  userName: string | null,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const { rawToken, expiresAt } = await createPasswordResetToken({ userId, purpose: 'INVITE' });
    const resetUrl = `${appBaseUrl()}/uk/reset-password?token=${encodeURIComponent(rawToken)}`;
    const displayName = userName?.trim() || userEmail;
    const expiresHuman = expiresAt.toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const resetButton = `<p style="margin: 24px 0;"><a href="${resetUrl}" style="display: inline-block; background: #D4A017; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">Створити пароль</a></p>`;
    const tpl = await getPaymentTemplate('password-reset');
    const vars = {
      greeting: `Здрастуйте, ${esc(displayName)}!`,
      resetButton,
      resetUrl,
      expiresHuman: esc(expiresHuman),
    };
    const res = await sendEmail({
      to: userEmail,
      subject: renderTemplate(tpl.subject, vars),
      html: renderTemplate(tpl.bodyHtml, vars),
      devPreviewHint: resetUrl,
    });
    if (!res.ok) return { sent: false, error: res.error ?? 'send failed' };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}
