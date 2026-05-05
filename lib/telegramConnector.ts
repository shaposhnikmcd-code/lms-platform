/// Окремий Telegram-бот @connectorgame_bot для сповіщень менеджерам гри «Конектор».
/// Не плутати з основним lib/telegram.ts (бот Річної програми, токен TELEGRAM_BOT_TOKEN).
///
/// Налаштування:
///   TELEGRAM_CONNECTOR_BOT_TOKEN — токен бота, отриманий від @BotFather.
///   TELEGRAM_CONNECTOR_WEBHOOK_SECRET — секрет для верифікації webhook-запитів.

const API_BASE = 'https://api.telegram.org';

export class ConnectorTelegramError extends Error {
  errorCode: number | null;
  constructor(message: string, errorCode: number | null) {
    super(message);
    this.name = 'ConnectorTelegramError';
    this.errorCode = errorCode;
  }
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_CONNECTOR_BOT_TOKEN;
  if (!token || !token.trim()) {
    throw new ConnectorTelegramError('TELEGRAM_CONNECTOR_BOT_TOKEN не налаштований', null);
  }
  return token;
}

export function isConnectorBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_CONNECTOR_BOT_TOKEN?.trim());
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok || data.result === undefined) {
    throw new ConnectorTelegramError(
      data.description ?? `Telegram API error (${method})`,
      data.error_code ?? null,
    );
  }
  return data.result;
}

/// Надсилає текстове повідомлення у chat_id (особистий або груповий).
/// `parseMode = 'HTML'` дозволяє <b>, <i>, <a href>. Telegram-MarkdownV2
/// надто капризний — використовуємо HTML.
export async function sendConnectorMessage(args: {
  chatId: string;
  text: string;
  disableNotification?: boolean;
}): Promise<{ message_id: number }> {
  return call<{ message_id: number }>('sendMessage', {
    chat_id: args.chatId,
    text: args.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    disable_notification: args.disableNotification ?? false,
  });
}

/// Встановлює webhook для бота. Викликається разово зі скрипта `scripts/setup-connector-telegram-webhook.mjs`.
export async function setConnectorWebhook(args: {
  url: string;
  secretToken: string;
}): Promise<true> {
  return call<true>('setWebhook', {
    url: args.url,
    secret_token: args.secretToken,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
}

export async function getConnectorBotInfo(): Promise<{ id: number; username?: string; first_name: string }> {
  return call('getMe', {});
}

/// Безпечне HTML-екранування для тексту, який вставляється в Telegram-повідомлення з parse_mode=HTML.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
