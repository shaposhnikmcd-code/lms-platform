/// Webhook для бота @connectorgame_bot.
/// Telegram POST-ить сюди кожен update (повідомлення в боті).
///
/// Що робимо:
///   - Перевіряємо секрет у заголовку `X-Telegram-Bot-Api-Secret-Token` (захист від фейкових POST).
///   - На команду `/start` (або будь-яке перше повідомлення в боті) відповідаємо менеджеру його chat_id,
///     щоб він міг скопіювати число й вставити в адмінку.
///   - На решту повідомлень відповідаємо коротким нагадуванням.
///
/// Endpoint URL (треба зареєструвати разово через scripts/setup-connector-telegram-webhook.mjs):
///   https://uimp.com.ua/api/telegram/connector-webhook
///
/// Telegram повторно надсилає update-и при 5xx — тому повертаємо 200 завжди (навіть на помилки),
/// а помилки логуємо.

import { NextRequest, NextResponse } from 'next/server';
import { sendConnectorMessage, escapeHtml } from '@/lib/telegramConnector';

interface TgUpdate {
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string };
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  // === 1. Верифікація секрета ===
  const expectedSecret = process.env.TELEGRAM_CONNECTOR_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[connector-webhook] TELEGRAM_CONNECTOR_WEBHOOK_SECRET не заданий');
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const got = req.headers.get('x-telegram-bot-api-secret-token');
  if (got !== expectedSecret) {
    console.warn('[connector-webhook] Невірний secret token');
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true }, { status: 200 });

  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const chatType = msg.chat.type;
  const chatTitle = msg.chat.title || msg.from?.first_name || 'не вказано';

  try {
    if (text.startsWith('/start') || text === '/id' || text === '/chatid') {
      const isPrivate = chatType === 'private';
      const reply = [
        `👋 Вітаю${msg.from?.first_name ? `, <b>${escapeHtml(msg.from.first_name)}</b>` : ''}!`,
        '',
        `Це бот UIMP для сповіщень про замовлення гри <b>«Конектор»</b>.`,
        '',
        `📌 <b>Ваш chat_id:</b>`,
        `<code>${chatId}</code>`,
        '',
        isPrivate
          ? '👉 Скопіюйте це число (просто торкніться його) та вставте в полі <b>Telegram chat_id</b> в адмінці UIMP → Конектор → Менеджери.'
          : `Це <b>${escapeHtml(chatType)}</b> (<i>${escapeHtml(chatTitle)}</i>). Якщо ви хочете отримувати сповіщення сюди — вставте це число в адмінку UIMP. Я маю бути учасником цього чату.`,
      ].join('\n');

      await sendConnectorMessage({ chatId: String(chatId), text: reply });
    } else {
      // Будь-яке інше повідомлення → коротка підказка.
      await sendConnectorMessage({
        chatId: String(chatId),
        text:
          'Я бот для службових сповіщень UIMP. Надішліть <b>/start</b>, щоб отримати свій chat_id для адмінки.',
      });
    }
  } catch (e) {
    console.error('[connector-webhook] помилка відповіді:', e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
