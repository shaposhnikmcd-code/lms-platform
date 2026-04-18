/// Timing-safe Bearer та HMAC порівняння. Важливо для CRON_SECRET та WFP merchantSignature —
/// `===` на рядках пропускає таймінг-атаки, тому використовуємо crypto.timingSafeEqual.

import crypto from 'crypto';

/// Константно-часове порівняння двох рядків. Різна довжина — одразу false,
/// однакова — реальне constant-time через timingSafeEqual.
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/// Перевірка `Authorization: Bearer <secret>` заголовка константно за часом.
export function verifyBearer(authHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false;
  if (!authHeader) return false;
  const expected = `Bearer ${expectedSecret}`;
  return timingSafeEqualStr(authHeader, expected);
}
