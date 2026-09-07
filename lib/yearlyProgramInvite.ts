import crypto from 'crypto';
import { signSignedToken, verifySignedToken } from './signedToken';

/// Invite-token для додавання студента вручну в Річну програму.
/// Менеджер генерує token у адмінці → отримує посилання
/// `${origin}/yearly-program?invite=${token}` → відправляє студенту.
/// Студент відкриває → форма prefilled (email/name/plan locked) → платить → у callback
/// підписка створюється з manuallyAddedAt + прив'язується до cohort з token-у.
///
/// Підпис: HMAC-SHA256(payload-base64url, NEXTAUTH_SECRET) — механіка в `lib/signedToken.ts`.
/// TTL: 7 днів. Після експірації verify повертає null.

export interface InvitePayload {
  /// email, на який створюється підписка (lock-иться у формі — студент не змінить)
  email: string;
  /// ім'я (опціонально, для prefill)
  name?: string;
  /// план оплати — опціонально. Якщо null/undefined, студент сам обирає план у формі.
  /// Коли заданий — `/api/wayforpay` звіряє його з префіксом orderReference і відхиляє
  /// невідповідність (форма lock-ає вибір, але body клієнта можна підмінити).
  plan?: 'YEARLY' | 'MONTHLY' | null;
  /// для MONTHLY — true=автосписання, false=одна оплата 30 днів. Опціонально.
  /// Коли заданий (не null) — звіряється з `recurring` з body там же.
  autoRenew?: boolean | null;
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

export function signInvite(input: Omit<InvitePayload, 'exp' | 'nonce'>): string {
  const payload: InvitePayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  return signSignedToken(payload);
}

export function verifyInvite(token: string): InvitePayload | null {
  const payload = verifySignedToken<InvitePayload>(token);
  if (!payload) return null;
  // Токени ІНШОГО призначення підписані тим самим секретом і мають ті самі поля
  // `email` + `cohortId` — renew-посилання на оплату модуля пройшло б цю перевірку
  // наскрізь. А invite — це інші повноваження: він обходить `registrationOpen` і
  // ставить підписці `manuallyAddedAt`. Тому все, що явно назвало своє призначення
  // і це призначення не «invite», сюди не пускаємо. Історичні invite-токени поля
  // `purpose` не мають — для них перевірка прозора.
  if ((payload as { purpose?: unknown }).purpose !== undefined) return null;
  if (typeof payload?.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  if (!payload.email || !payload.cohortId) return null;
  return payload;
}
