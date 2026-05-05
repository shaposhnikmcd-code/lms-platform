/// Валідація + нормалізація Telegram username.
/// Формат TG: латинські літери, цифри й underscore; 5-32 символи; не починається з цифри.
/// Допускаємо ввід з або без `@` префіксу — нормалізуємо ЗАВЖДИ з префіксом для консистентності.

const RAW_RE = /^@?([a-zA-Z][a-zA-Z0-9_]{4,31})$/;

export interface TelegramUsernameParseResult {
  ok: boolean;
  /// Нормалізоване значення з `@` префіксом ("@ihor"). null якщо невалідно.
  normalized: string | null;
  /// Лише handle без `@` ("ihor"). Зручно для t.me/ilink-генерації.
  handle: string | null;
  /// Помилка для UI (українською).
  error: string | null;
}

export function parseTelegramUsername(input: unknown): TelegramUsernameParseResult {
  if (typeof input !== 'string') {
    return { ok: false, normalized: null, handle: null, error: 'Вкажіть Telegram username' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, normalized: null, handle: null, error: 'Вкажіть Telegram username' };
  }
  const match = RAW_RE.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      normalized: null,
      handle: null,
      error: 'Невалідний username. Формат: 5–32 символи, латиниця/цифри/_, починається з літери.',
    };
  }
  const handle = match[1];
  return { ok: true, normalized: `@${handle}`, handle, error: null };
}

/// t.me/{handle} — публічне посилання на профіль (рідко використовується, але корисно
/// для відображення в адмінці).
export function telegramProfileUrl(normalizedOrHandle: string | null | undefined): string | null {
  if (!normalizedOrHandle) return null;
  const handle = normalizedOrHandle.replace(/^@/, '');
  if (!handle) return null;
  return `https://t.me/${handle}`;
}
