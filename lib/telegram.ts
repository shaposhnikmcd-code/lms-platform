/// Тонка обгортка над Telegram Bot API через fetch (без node-telegram-bot-api / telegraf).
/// Використовується тільки серверно (route handlers, cron). Не імпортувати в клієнтський код.
///
/// Налаштування:
/// — TELEGRAM_BOT_TOKEN — токен бота, отриманий від @BotFather. Required.
///
/// Канал/група для додавання студентів — у БД (`YearlyProgramTelegramSetting.chatId`),
/// це user-editable налаштування.

const API_BASE = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !token.trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN не налаштований');
  }
  return token;
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
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
    throw new TelegramApiError(data.description ?? `Telegram API error (${method})`, data.error_code ?? null);
  }
  return data.result;
}

export class TelegramApiError extends Error {
  errorCode: number | null;
  constructor(message: string, errorCode: number | null) {
    super(message);
    this.name = 'TelegramApiError';
    this.errorCode = errorCode;
  }
}

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  description?: string;
}

/// Резолвить chat info за numeric id або @username. Бот має бути учасником/адміном.
/// Якщо @username некоректний або бота не додано — кидає TelegramApiError.
export async function getChat(chatId: string | number): Promise<TgChat> {
  return call<TgChat>('getChat', { chat_id: chatId });
}

export interface TgChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  can_invite_users?: boolean;
}

/// Перевіряє статус бота у вказаному чаті. Повертає TgChatMember,
/// з якого зчитуємо чи бот адмін і чи має право invite users.
export async function getMe(): Promise<{ id: number; username?: string; first_name: string }> {
  return call('getMe', {});
}

export async function getChatMember(chatId: string | number, userId: number): Promise<TgChatMember> {
  return call<TgChatMember>('getChatMember', { chat_id: chatId, user_id: userId });
}

export interface TgChatInviteLink {
  invite_link: string;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  creates_join_request?: boolean;
}

/// Створює одноразове invite-посилання у чат через бота (бот має бути адміном
/// з can_invite_users=true). За замовчуванням member_limit=1 і expire_date=+30 днів.
export async function createChatInviteLink(args: {
  chatId: string | number;
  name?: string;
  memberLimit?: number;
  expireSeconds?: number;
}): Promise<TgChatInviteLink> {
  const expire = Math.floor(Date.now() / 1000) + (args.expireSeconds ?? 30 * 24 * 60 * 60);
  return call<TgChatInviteLink>('createChatInviteLink', {
    chat_id: args.chatId,
    name: args.name?.slice(0, 32),
    member_limit: args.memberLimit ?? 1,
    expire_date: expire,
  });
}

/// Нормалізує введений з адмінки chatId. Допускає:
///   "@channel"   → "@channel"
///   "channel"    → "@channel"
///   "-100123..." → "-100123..." (numeric supergroup/channel id)
///   "https://t.me/channel" → "@channel"
/// Невалідне значення → null.
export function normalizeChatId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // numeric id (private supergroup/channel — починається з -100)
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  // t.me/<handle>
  const tme = /^https?:\/\/t\.me\/(?:joinchat\/)?(@?[A-Za-z0-9_]{4,})/i.exec(trimmed);
  if (tme) return tme[1].startsWith('@') ? tme[1] : `@${tme[1]}`;
  // @handle або handle
  const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  if (/^@[A-Za-z0-9_]{4,}$/.test(handle)) return handle;
  return null;
}
