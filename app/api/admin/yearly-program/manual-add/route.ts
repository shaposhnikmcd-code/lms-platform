import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { parseTelegramUsername } from '@/lib/telegramUsername';
import { createPasswordResetToken } from '@/lib/passwordResetToken';
import { sendEmail, appBaseUrl, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';
import { applyPaymentActivation } from '@/lib/yearlyProgramActivation';
import { runExtraLaunchForSubscription } from '@/lib/yearlyProgramLaunch';
import { generateInviteForSubscription, getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';

/// POST /api/admin/yearly-program/manual-add
/// Body: { email, name?, plan, cohortId, telegramUsername?, sendPasswordEmail?, mode?, note? }
///
/// Менеджер заводить студента у Річну програму ВРУЧНУ. Два режими (`mode`):
///
/// • `pending` (дефолт, зворотна сумісність) — створює запис у статусі PENDING (очікує
///   підтвердження оплати), БЕЗ доступу й без впливу на дохід. Активується окремо: менеджер
///   тисне 💵 «Підтвердити оплату вручну» → Payment(PAID), ACTIVE, SendPulse + welcome-лист.
///
/// • `carryover` — «🔄 Перенесення з минулого року»: студент оплатив минулорічний набір,
///   але не навчався. Заводимо в новий cohort БЕЗ оплати, але з повним доступом як після
///   реальної оплати. Створюється Payment(amount=0, manualMethod='carryover'), доступ
///   відкривається одразу (якщо cohort запущений) або на загальному запуску (якщо ще ні).
///   План завжди YEARLY, дохід/KPI не змінюються (сума 0).
///
/// Кроки (pending):
/// 1. Знайти User за email; якщо нема — створити (рандомний пароль). За прапорцем
///    sendPasswordEmail — надіслати лист для встановлення пароля (INVITE-токен, 7 днів).
/// 2. Створити YearlyProgramSubscription у вибраному cohort зі статусом PENDING
///    (expiresAt=null, доступу ще нема), manuallyAddedAt=now, manuallyAddedBy=email менеджера.
///    Платіж НЕ створюється.
/// 3. Лог події admin_action «Додано вручну, очікує підтвердження оплати by <manager>».
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
    sendPasswordEmail?: boolean;
    mode?: string;
    note?: string;
  };

  const mode: 'pending' | 'carryover' = body.mode === 'carryover' ? 'carryover' : 'pending';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email обовʼязковий і має бути валідним' }, { status: 400 });
  }

  // Перенесення завжди YEARLY (повний доступ до кінця програми). У pending-режимі план
  // обирає менеджер.
  let plan: 'YEARLY' | 'MONTHLY';
  if (mode === 'carryover') {
    plan = 'YEARLY';
  } else {
    const p = body.plan === 'YEARLY' || body.plan === 'MONTHLY' ? body.plan : null;
    if (!p) {
      return NextResponse.json({ error: 'План має бути YEARLY або MONTHLY' }, { status: 400 });
    }
    plan = p;
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
    select: { id: true, name: true },
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
        error: `У студента вже є підписка (${existing.plan}, ${existing.status}). Другу не створюю.`,
        code: 'subscription_exists',
        subscriptionId: existing.id,
      },
      { status: 409 },
    );
  }

  // 2) Створюємо PENDING-підписку без доступу. expiresAt/startDate лишаємо null —
  //    їх проставить активація (натискання 💵 «Підтвердити оплату вручну»).
  const now = new Date();
  const sub = await prisma.yearlyProgramSubscription.create({
    data: {
      userId: user.id,
      plan,
      autoRenew: false,
      status: 'PENDING',
      cohortId: cohort.id,
      manuallyAddedAt: now,
      manuallyAddedBy: managerLabel,
      ...(telegramUsername ? { telegramUsername } : {}),
    },
    select: { id: true },
  });

  // ── Гілка ПЕРЕНЕСЕННЯ (carryover) ────────────────────────────────────────────────
  // Створюємо Payment(0₴, PAID, manualMethod='carryover') → активуємо доступ через спільний
  // helper (той самий, що й ручна оплата). Сума 0 → дохід/KPI не змінюються.
  if (mode === 'carryover') {
    const orderReference = `carryover_${Date.now()}_${sub.id.slice(-6)}`;
    await prisma.payment.create({
      data: {
        userId: user.id,
        orderReference,
        amount: 0,
        currency: 'UAH',
        status: 'PAID',
        paidAt: now,
        yearlyProgramSubscriptionId: sub.id,
        manualMethod: 'carryover',
        manualNote: note,
      },
    });

    const activation = await applyPaymentActivation({
      subscriptionId: sub.id,
      plan: 'YEARLY',
      autoRenew: false,
      prevStatus: 'PENDING',
      lastPaymentAt: now,
    });

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `Перенесено з минулого набору by ${managerLabel}${note ? ` — ${note}` : ''} · expiresAt=${activation.newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
        metadata: {
          carryover: true,
          note,
          orderReference,
          actor: managerLabel,
          cohortId: cohort.id,
          userCreated: createdUser,
        },
      },
    });

    // Якщо cohort уже запущений — відкриваємо доступ одразу (SendPulse + welcome-лист).
    // Спершу генеруємо Telegram-invite (як у WFP callback), щоб вкласти його в лист.
    // Помилки цих кроків не валять запит — повертаємо їх у відповіді.
    let extraLaunch: Awaited<ReturnType<typeof runExtraLaunchForSubscription>> | null = null;
    if (activation.cohortLaunched) {
      let tgInviteLink: string | null = null;
      try {
        const tgSettings = await getYearlyProgramTelegramSettings();
        if (tgSettings.autoAdd && tgSettings.chatId && telegramUsername) {
          const tgRes = await generateInviteForSubscription({
            subscriptionId: sub.id,
            triggeredBy: `${managerLabel}:carryover`,
          });
          if (tgRes.ok) tgInviteLink = tgRes.inviteLink;
        }
      } catch {
        // помилка invite не блокує carryover — доступ важливіший за link у листі
      }
      extraLaunch = await runExtraLaunchForSubscription(
        sub.id,
        `${managerLabel} · carryover`,
        { telegramInviteLink: tgInviteLink },
      ).catch((e) => ({
        ok: false,
        reason: (e as Error).message,
        expiresAt: null,
        sendpulseAccessOpened: false,
        studentId: null,
        email: { sent: false },
      }));
    }

    let passwordEmail: { sent: boolean; error?: string } | null = null;
    if (createdUser && body.sendPasswordEmail) {
      passwordEmail = await sendPasswordSetupEmail(user.id, user.email, user.name);
    }

    return NextResponse.json({
      ok: true,
      subscriptionId: sub.id,
      userCreated: createdUser,
      mode: 'carryover',
      newStatus: activation.newStatus,
      cohortLaunched: activation.cohortLaunched,
      extraLaunch,
      passwordEmail,
    });
  }

  // 3) Лог події (pending).
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Додано вручну, очікує підтвердження оплати by ${managerLabel}`,
      metadata: {
        manualAddPendingPayment: true,
        actor: managerLabel,
        plan,
        cohortId: cohort.id,
        userCreated: createdUser,
      },
    },
  });

  // Опційний лист для встановлення пароля (тільки для щойно створеного акаунта).
  let passwordEmail: { sent: boolean; error?: string } | null = null;
  if (createdUser && body.sendPasswordEmail) {
    passwordEmail = await sendPasswordSetupEmail(user.id, user.email, user.name);
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    userCreated: createdUser,
    mode: 'pending',
    status: 'PENDING',
    passwordEmail,
  });
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
