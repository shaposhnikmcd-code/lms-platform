/// Webhook бота Річної програми (TELEGRAM_BOT_TOKEN).
/// Призначення — авто-обробляти `chat_join_request` update-и в режимі
/// `joinRequestMode=ON`:
///   • Якщо invite_link збігається з telegramInviteLink якоїсь підписки →
///     `approveChatJoinRequest` + `telegramJoinedAt = now` + лог події.
///   • Інакше (рандомна людина не з Річної) → `declineChatJoinRequest`,
///     бо канал тільки для клієнтів Річної.
///
/// Endpoint URL (зареєструвати разово через scripts/setup-yearly-program-telegram-webhook.mjs):
///   https://uimp.com.ua/api/telegram/yearly-program-webhook
///
/// Telegram повторно надсилає update-и при 5xx — повертаємо 200 завжди (помилки логуємо).
///
/// ⚠️ Не плутати з `/api/telegram/connector-webhook` — то інший бот (@connectorgame_bot).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  approveChatJoinRequest,
  declineChatJoinRequest,
  TelegramApiError,
} from '@/lib/telegram';
import { getYearlyProgramTelegramSettings } from '@/lib/yearlyProgramTelegram';

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TgChatJoinRequest {
  chat: { id: number; type: 'group' | 'supergroup' | 'channel'; title?: string };
  from: TgUser;
  date: number;
  invite_link?: { invite_link: string; name?: string; creates_join_request?: boolean };
}

interface TgUpdate {
  update_id?: number;
  chat_join_request?: TgChatJoinRequest;
}

export async function POST(req: NextRequest) {
  // === 1. Верифікація секрета ===
  const expectedSecret = process.env.TELEGRAM_YEARLY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[yearly-tg-webhook] TELEGRAM_YEARLY_WEBHOOK_SECRET не заданий');
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const got = req.headers.get('x-telegram-bot-api-secret-token');
  if (got !== expectedSecret) {
    console.warn('[yearly-tg-webhook] Невірний secret token');
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const joinReq = update.chat_join_request;
  if (!joinReq) {
    // Інші типи update-ів зараз не обробляємо.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const chatId = joinReq.chat.id;
  const userId = joinReq.from.id;
  const inviteUrl = joinReq.invite_link?.invite_link ?? null;
  const username = joinReq.from.username ? `@${joinReq.from.username}` : null;
  const fullName = [joinReq.from.first_name, joinReq.from.last_name].filter(Boolean).join(' ') || null;

  // Перевіряємо що update прийшов саме для нашого зафіксованого каналу.
  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) {
    console.warn('[yearly-tg-webhook] Канал не налаштовано, ігнор join-request');
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // chatId з settings може бути numeric ("-100...") або "@username".
  // Update присилає numeric chat.id → порівнюємо обидва формати.
  const settingsNumericMatch = /^-?\d+$/.test(settings.chatId) && settings.chatId === String(chatId);
  // Якщо в settings @username — порівняти неможливо без додаткового запиту,
  // тому сприймаємо update як свій (Telegram не присилає update-и для каналів,
  // в яких бот не адмін).
  const settingsHandleMatch = settings.chatId.startsWith('@');
  if (!settingsNumericMatch && !settingsHandleMatch) {
    console.warn(`[yearly-tg-webhook] chat_id mismatch: settings=${settings.chatId}, update=${chatId}`);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Знайти підписку за збігом invite_link.
  const sub = inviteUrl
    ? await prisma.yearlyProgramSubscription.findFirst({
        where: { telegramInviteLink: inviteUrl },
        select: { id: true, userId: true, telegramJoinedAt: true },
      })
    : null;

  if (sub) {
    // === Свій клієнт → APPROVE ===
    try {
      await approveChatJoinRequest(chatId, userId);
      // Idempotent: якщо вже стояв timestamp (повторний join після leave) — не перезаписуємо.
      if (!sub.telegramJoinedAt) {
        await prisma.yearlyProgramSubscription.update({
          where: { id: sub.id },
          data: { telegramJoinedAt: new Date() },
        });
      }
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `Telegram: клієнт приєднався в канал (auto-approved)`,
          metadata: {
            tgUserId: userId,
            tgUsername: username,
            tgFullName: fullName,
            inviteLink: inviteUrl,
            chatId: String(chatId),
          },
        },
      });
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      console.error(`[yearly-tg-webhook] approve failed sub=${sub.id} user=${userId}: ${msg}`);
    }
  } else {
    // === Стороння людина → DECLINE ===
    // Канал тільки для Річної програми, тому або (а) рандом, (б) спам, (в) клієнт
    // з expire-нутим/перегенерованим invite — у всіх трьох випадках decline безпечний.
    // Якщо це справді клієнт із втраченим invite — менеджер видасть нове запрошення
    // через адмінку (кнопка "Переслати TG-запрошення").
    try {
      await declineChatJoinRequest(chatId, userId);
      console.log(`[yearly-tg-webhook] declined non-yearly user=${userId} (${username ?? fullName ?? 'no name'}) invite=${inviteUrl ?? 'none'}`);
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      console.error(`[yearly-tg-webhook] decline failed user=${userId}: ${msg}`);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
