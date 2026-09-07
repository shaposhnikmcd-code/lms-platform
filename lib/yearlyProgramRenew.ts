import crypto from 'crypto';
import { signSignedToken, verifySignedToken } from './signedToken';

/// Персональне посилання «Оплатити наступний модуль» для студента Річної програми на
/// МІСЯЧНІЙ разовій оплаті: `${origin}/yearly-program?renew=${token}`.
///
/// Навіщо окремий токен, а не invite: invite — це повноваження менеджера завести людину
/// в програму (обходить `registrationOpen`, ставить `manuallyAddedAt`). Поновлення —
/// протилежне: студент УЖЕ в програмі, жодних обходів не потрібно, а `manuallyAddedAt`
/// на його підписці був би прямою брехнею у звітності. Тому окремий `purpose: 'renew'`,
/// і обидва verify відхиляють чужий тип (див. `verifyInvite`).
///
/// Токен нічого не дозволяє сам по собі: він лише КАЖЕ, чию підписку студент збирається
/// оплатити. Усі гварди `/api/wayforpay` (`monthly_autopay_active`, `monthly_fully_paid`,
/// `monthly_schedule_debt`, `no_current_cohort`) працюють як для звичайної покупки.
///
/// Підпис: HMAC-SHA256(payload-base64url, NEXTAUTH_SECRET) — механіка в `lib/signedToken.ts`.

/// 45 днів. Нижня межа — ланцюг нагадувань: перший лист іде за 3 дні до кінця модуля,
/// далі grace (до 90 днів за налаштуванням, у нормі 7) і лист про закриття. Посилання
/// має лишатись живим увесь цей час, інакше студент отримає «застаріло» у листі, який
/// система щойно надіслала. Верхня — здоровий глузд: модуль триває місяць, і посилання
/// не повинно переживати кілька модулів поспіль.
export const RENEW_TOKEN_TTL_DAYS = 45;

export interface RenewPayload {
  /// Розрізнювач типу токена. Присутній ЗАВЖДИ — на ньому тримається невзаємозамінність
  /// з invite (`verifyInvite` відхиляє будь-який payload з `purpose`).
  purpose: 'renew';
  /// Підписка, наступний модуль якої оплачується.
  subscriptionId: string;
  /// Email власника підписки (нормалізований). Звіряється з `clientEmail` у чекауті —
  /// підмінити адресу на боці браузера не можна.
  email: string;
  /// Набір, у якому підписка була на момент видачі посилання. Якщо підписку перенесли
  /// в інший набір, посилання втрачає силу — сітка модулів у новому наборі інша.
  cohortId: string;
  /// expiry timestamp (Unix sec)
  exp: number;
  /// nonce для унікальності
  nonce: string;
}

export function signRenewToken(input: {
  subscriptionId: string;
  email: string;
  cohortId: string;
}): string {
  const payload: RenewPayload = {
    purpose: 'renew',
    subscriptionId: input.subscriptionId,
    email: input.email.trim().toLowerCase(),
    cohortId: input.cohortId,
    exp: Math.floor(Date.now() / 1000) + RENEW_TOKEN_TTL_DAYS * 24 * 60 * 60,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  return signSignedToken(payload);
}

export function verifyRenewToken(token: string): RenewPayload | null {
  const payload = verifySignedToken<RenewPayload>(token);
  if (!payload) return null;
  // Дзеркало гарду в `verifyInvite`: invite-токен (без `purpose`) або будь-який майбутній
  // тип сюди не проходить.
  if (payload.purpose !== 'renew') return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  if (!payload.subscriptionId || !payload.email || !payload.cohortId) return null;
  return payload;
}

/// Якір блоку поновлення на сторінці. Без нього людина з листа падає на початок довгого
/// лендінга і має проскролити шість секцій до свого блоку — тому посилання веде одразу в нього.
export const RENEW_ANCHOR = 'renew';

/// Повне посилання для листа / буфера обміну менеджера. `origin` — без хвостового слеша.
export function buildRenewUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/yearly-program?renew=${encodeURIComponent(token)}#${RENEW_ANCHOR}`;
}

/// Токен + URL + дата протермінування одним викликом — усі три споживачі (cron-листи,
/// кнопка менеджера) потребують саме цю трійку.
export function issueRenewLink(input: {
  subscriptionId: string;
  email: string;
  cohortId: string;
  origin: string;
}): { token: string; url: string; expiresAt: Date } {
  const token = signRenewToken(input);
  return {
    token,
    url: buildRenewUrl(input.origin, token),
    expiresAt: new Date(Date.now() + RENEW_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}
