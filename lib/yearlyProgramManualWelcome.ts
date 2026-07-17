/// Pre-launch side-effects для РУЧНОГО флоу (manual_payment / carryover), коли cohort ЩЕ
/// НЕ запущений і це ПЕРШИЙ PAID-платіж підписки. Дзеркалить гілку WFP-callback-а «не
/// launched» (app/api/wayforpay/callback/route.ts ~939-1030), щоб ручний студент отримав
/// той самий досвід, що реальний покупець:
///   1) TG-invite (autoAdd && chatId && telegramUsername) — best-effort, не валить флоу;
///   2) generic welcome-лист (sendYearlyProgramWelcomeEmail, БЕЗ кредів — креди на запуску)
///      з тими самими подіями-логами (включно з чесним «мейлер не налаштований»).
/// SendPulse-доступ НЕ відкривається (це робить масовий запуск / extra-launch).
///
/// ⚠️ Callback (еталон) НЕ модифікуємо — тільки віддзеркалюємо його поведінку тут.

import prisma from '@/lib/prisma';
import { getYearlyProgramTelegramSettings, generateInviteForSubscription } from '@/lib/yearlyProgramTelegram';
import { sendYearlyProgramWelcomeEmail } from '@/lib/yearlyProgramWelcomeEmail';

export interface ManualPreLaunchWelcomeResult {
  inviteGenerated: boolean;
  inviteLink: string | null;
  inviteError: string | null;
  welcomeSent: boolean;
  /// Мейлер не налаштований (немає RESEND_API_KEY) — лист реально НЕ пішов.
  welcomeSkipped: boolean;
  welcomeError: string | null;
}

export async function runManualPreLaunchWelcome(
  subscriptionId: string,
  actorLabel: string,
): Promise<ManualPreLaunchWelcomeResult> {
  const res: ManualPreLaunchWelcomeResult = {
    inviteGenerated: false, inviteLink: null, inviteError: null,
    welcomeSent: false, welcomeSkipped: false, welcomeError: null,
  };

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      plan: true,
      autoRenew: true,
      telegramUsername: true,
      telegramInviteLink: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!sub || !sub.user?.email) return res;

  // 1) TG-invite перед листом (щоб вкласти посилання). Помилка не блокує лист.
  let tgInviteLink: string | null = null;
  try {
    const tgSettings = await getYearlyProgramTelegramSettings();
    if (tgSettings.autoAdd && tgSettings.chatId && sub.telegramUsername) {
      const tgRes = await generateInviteForSubscription({
        subscriptionId: sub.id,
        triggeredBy: `${actorLabel}:pre-launch-welcome`,
        prefetched: {
          id: sub.id,
          telegramInviteLink: sub.telegramInviteLink ?? null,
          userEmail: sub.user.email,
          userName: sub.user.name,
        },
      });
      if (tgRes.ok) {
        tgInviteLink = tgRes.inviteLink;
        res.inviteGenerated = true;
        res.inviteLink = tgRes.inviteLink;
      } else {
        res.inviteError = tgRes.error ?? 'unknown';
      }
    }
  } catch (e) {
    res.inviteError = (e as Error).message;
  }

  // 2) Generic welcome-лист (без кредів — креди приходять окремим листом на запуску).
  try {
    const mail = await sendYearlyProgramWelcomeEmail({
      to: sub.user.email,
      name: sub.user.name ?? null,
      plan: sub.plan,
      autoRenew: sub.autoRenew,
      telegramInviteLink: tgInviteLink,
    });
    if (mail.skipped) {
      res.welcomeSkipped = true;
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: 'Welcome lett ПРОПУЩЕНО — мейлер не налаштований (RESEND_API_KEY відсутній на цьому середовищі)',
        },
      });
    } else if (mail.ok) {
      res.welcomeSent = true;
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `Welcome lett sent (no credentials — credentials follow on launch) · ${actorLabel}`,
        },
      });
    } else {
      res.welcomeError = mail.error ?? 'unknown';
    }
  } catch (e) {
    res.welcomeError = (e as Error).message;
  }

  return res;
}
