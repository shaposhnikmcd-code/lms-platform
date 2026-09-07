import crypto from 'crypto';

/// Спільна механіка підписаних безстанних токенів Річної програми:
/// `base64url(JSON payload)` + `.` + `base64url(HMAC-SHA256(payload, NEXTAUTH_SECRET))`.
///
/// Винесено з `yearlyProgramInvite.ts` після появи ДРУГОГО токена (`yearlyProgramRenew`):
/// два незалежні копії криптографії розходяться при першій же правці, а тут кожен рядок
/// має значення (порівняння підпису — тільки `timingSafeEqual`, декодування — тільки
/// після перевірки підпису). Формат байт-у-байт той самий, що був у invite, тож уже
/// видані посилання лишаються валідними.
///
/// Сам модуль НІЧОГО не знає про зміст payload-у: перевірку полів, `exp` і `purpose`
/// робить конкретний токен-модуль.

const HMAC_ALGO = 'sha256';

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set');
  return s;
}

export function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/// Підписує довільний JSON-payload. `exp`/`nonce` додає викликач — вони частина payload-у,
/// а не транспорту.
export function signSignedToken(payload: unknown): string {
  const data = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64urlEncode(crypto.createHmac(HMAC_ALGO, getSecret()).update(data).digest());
  return `${data}.${sig}`;
}

/// Перевіряє підпис і повертає розпарсений payload. Термін дії, призначення й обовʼязкові
/// поля НЕ перевіряються — це робота конкретного токен-модуля.
export function verifySignedToken<T>(token: string): T | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = b64urlEncode(crypto.createHmac(HMAC_ALGO, getSecret()).update(data).digest());
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(b64urlDecode(data).toString('utf8')) as T;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
