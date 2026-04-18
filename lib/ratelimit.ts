/// Rate limiter на основі Upstash Redis (serverless-friendly, працює з Vercel).
/// Якщо env змінні UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN не задані —
/// всі ліміти стають no-op (fail-open), щоб dev/локальна розробка не падали.
///
/// Ліміт прив'язуємо до IP адреси; для автентифікованих юзерів ми ДОДАТКОВО
/// можемо передавати userId — тоді ключ = `${kind}:${userId}` замість `${kind}:${ip}`.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const hasCredentials = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

/// Upstash client створюємо лазливо, тільки якщо є credentials.
const redis = hasCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/// Різні ліміти для різних типів запитів. Стратегія — sliding window.
/// Ключі — людсько-читабельні, бачимо у Upstash dashboard.
function makeLimiter(requests: number, window: `${number} ${'s' | 'm' | 'h'}`, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:${prefix}`,
    analytics: true,
  });
}

/// Ендпоінти й їх ліміти. Налаштовані консервативно — спершу подивимось аналітику.
export const limiters = {
  /// Логін (credentials). 5 спроб / 10 хв / IP — для брутфорса малувато.
  login: makeLimiter(5, '10 m', 'login'),
  /// Реєстрація. 3 нові акаунти / година / IP.
  register: makeLimiter(3, '1 h', 'register'),
  /// Перевірка промокоду — легко перебирати коди. 10 / 5 хв / IP.
  promo: makeLimiter(10, '5 m', 'promo'),
  /// Ініціація платежу. 10 / 5 хв / IP — покриває звичайну навігацію, блокує спам.
  payment: makeLimiter(10, '5 m', 'payment'),
  /// Контактна форма. 5 / годину / IP — запобігає email spam через Resend.
  contact: makeLimiter(5, '1 h', 'contact'),
  /// Nova Poshta delivery cost — захист NP API quota. 30 / 5 хв / IP.
  novaPoshta: makeLimiter(30, '5 m', 'nova-poshta'),
};

/// Отримати реальний IP з заголовків. Vercel/Cloudflare/Nginx — x-forwarded-for.
function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || '127.0.0.1';
}

export interface RateLimitResult {
  ok: boolean;
  /// Якщо ok=false, NextResponse з 429 і Retry-After заголовком. Якщо ok=true — null.
  response: NextResponse | null;
}

/// Основний helper: виклик з API route. Повертає { ok, response }.
/// Якщо ліміт не сконфігуровано (dev) — завжди { ok: true }.
/// `identifier` override — для логів/логіну по email замість IP.
export async function checkRateLimit(
  req: NextRequest,
  kind: keyof typeof limiters,
  identifier?: string,
): Promise<RateLimitResult> {
  const limiter = limiters[kind];
  if (!limiter) return { ok: true, response: null };

  const id = identifier ?? getIp(req);
  const { success, limit, remaining, reset } = await limiter.limit(id);

  if (success) return { ok: true, response: null };

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Забагато запитів. Спробуйте пізніше.', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    ),
  };
}

/// Для не-NextRequest контекстів (наприклад NextAuth authorize callback, що отримує
/// тільки credentials без req). Ідентифікуємо по email. Повертає true=allowed.
export async function checkRateLimitRaw(
  kind: keyof typeof limiters,
  identifier: string,
): Promise<{ success: boolean; retryAfter: number }> {
  const limiter = limiters[kind];
  if (!limiter) return { success: true, retryAfter: 0 };
  const { success, reset } = await limiter.limit(identifier);
  return {
    success,
    retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}
