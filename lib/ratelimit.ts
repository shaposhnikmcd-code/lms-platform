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

/// Fail-open — свідомий компроміс заради dev-а, але в проді він означає, що
/// брутфорс логіну, спам платіжок і перебір промокодів нічим не обмежені.
/// Тому на кожному cold start у проді голосно кричимо в логи, якщо env немає.
if (!hasCredentials && process.env.NODE_ENV === 'production') {
  console.error(
    '🚨 RATE LIMITING DISABLED — не задані UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. ' +
    'Усі ліміти (login, register, payment, promo, contact, forgot-password, cert-verify) працюють у fail-open режимі. ' +
    'Додай змінні у Vercel → Settings → Environment Variables.'
  );
}

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
  /// Nova Poshta проксі (cities/streets/warehouses/buildings/delivery-cost, + EU) —
  /// захист NP API quota і ключа. Спільний бюджет 120 / 5 хв / IP: одна заповнена
  /// форма доставки з автокомплітом легко дає кілька десятків запитів.
  novaPoshta: makeLimiter(120, '5 m', 'nova-poshta'),
  /// Запит на скидання пароля. 5 / годину / email — обмежує спам-лістами і email enumeration.
  forgotPassword: makeLimiter(5, '1 h', 'forgot-password'),
  /// Підтвердження reset-токена (встановлення нового пароля). 10 / 10 хв / IP.
  resetPassword: makeLimiter(10, '10 m', 'reset-password'),
  /// Публічна верифікація сертифіката. 60 / 5 хв / IP — защищає від перебору токенів.
  certVerify: makeLimiter(60, '5 m', 'cert-verify'),
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
