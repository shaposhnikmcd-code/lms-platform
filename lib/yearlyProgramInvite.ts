import crypto from 'crypto';

/// Invite-token для додавання студента вручну в Річну програму.
/// Менеджер генерує token у адмінці → отримує посилання
/// `${origin}/yearly-program?invite=${token}` → відправляє студенту.
/// Студент відкриває → форма prefilled (email/name/plan locked) → платить → у callback
/// підписка створюється з manuallyAddedAt + прив'язується до cohort з token-у.
///
/// Підпис: HMAC-SHA256(payload-base64url, NEXTAUTH_SECRET).
/// TTL: 7 днів. Після експірації verify повертає null.

export interface InvitePayload {
  /// email, на який створюється підписка (lock-иться у формі — студент не змінить)
  email: string;
  /// ім'я (опціонально, для prefill)
  name?: string;
  /// план оплати
  plan: 'YEARLY' | 'MONTHLY';
  /// для MONTHLY — true=автосписання, false=одна оплата 30 днів
  autoRenew: boolean;
  /// cohort, до якого прив'яжеться підписка (потрібно для post-launch invite)
  cohortId: string;
  /// email менеджера, що видав invite (для audit log)
  invitedBy: string;
  /// expiry timestamp (Unix sec)
  exp: number;
  /// nonce для унікальності
  nonce: string;
}

const TTL_DAYS = 7;
const HMAC_ALGO = 'sha256';

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set');
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function signInvite(input: Omit<InvitePayload, 'exp' | 'nonce'>): string {
  const payload: InvitePayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const json = JSON.stringify(payload);
  const data = b64urlEncode(Buffer.from(json, 'utf8'));
  const sig = b64urlEncode(crypto.createHmac(HMAC_ALGO, getSecret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyInvite(token: string): InvitePayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = b64urlEncode(crypto.createHmac(HMAC_ALGO, getSecret()).update(data).digest());
  if (!timingSafeEqual(sig, expected)) return null;
  let payload: InvitePayload;
  try {
    payload = JSON.parse(b64urlDecode(data).toString('utf8')) as InvitePayload;
  } catch {
    return null;
  }
  if (typeof payload?.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  if (!payload.email || !payload.cohortId || !payload.plan) return null;
  return payload;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
