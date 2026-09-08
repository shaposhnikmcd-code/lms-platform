import { NextRequest, NextResponse } from 'next/server';
import {
  RENEW_ANCHOR,
  RENEW_COOKIE_MAX_AGE_SECONDS,
  RENEW_COOKIE_NAME,
  RENEW_EXPIRED_FLAG,
  verifyRenewToken,
} from '@/lib/yearlyProgramRenew';

/// GET /yearly-program/renew/<token> — вхід із листа-нагадування («Оплатити наступний модуль»)
/// і з буфера менеджера.
///
/// Навіщо окремий handler замість `?renew=<token>` на самій сторінці: query-параметр їхав
/// у GA page_view разом із підписаним токеном і ставав частиною ключа ISR-кешу сторінки.
/// Тут токен живе рівно один редирект: перевіряємо підпис → кладемо у httpOnly-cookie →
/// відправляємо людину на ЧИСТИЙ `/yearly-program#renew`. Далі панель поновлення читає
/// стан через `/api/yearly-program/renew-state`, а `/api/wayforpay` бере токен із тієї ж
/// cookie. У браузерній історії, аналітиці й кеші лишається адреса без секрету.
///
/// Handler свідомо НЕ ходить у базу: підпис перевіряється локально, а чи можна цій людині
/// зараз продавати модуль — вирішує `resolveRenewState` уже на сторінці. Інакше ми б
/// двічі відповідали на одне питання і мали два місця, де ці відповіді розходяться.
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string; token: string }> },
) {
  const { locale, token } = await params;
  // Дефолтна локаль на сайті без префікса (`localePrefix: 'as-needed'`).
  const prefix = locale === 'uk' ? '' : `/${locale}`;
  const payload = verifyRenewToken(decodeURIComponent(token));

  if (!payload) {
    // Прострочене або зіпсоване посилання. Токена в редиректі немає — лише позначка,
    // за якою панель покаже мʼяке «Посилання застаріло» і відправить у картку «Місячна».
    const res = NextResponse.redirect(
      new URL(`${prefix}/yearly-program?renew=${RENEW_EXPIRED_FLAG}`, req.nextUrl.origin),
      302,
    );
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    // Мертвий токен не має лишати живу cookie від попереднього відкриття.
    res.cookies.delete(RENEW_COOKIE_NAME);
    return res;
  }

  const res = NextResponse.redirect(
    new URL(`${prefix}/yearly-program#${RENEW_ANCHOR}`, req.nextUrl.origin),
    302,
  );
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.cookies.set({
    name: RENEW_COOKIE_NAME,
    value: decodeURIComponent(token),
    httpOnly: true,
    sameSite: 'lax',
    // Localhost працює по http, і `secure: true` там означав би, що cookie не ставиться
    // взагалі — весь флоу неможливо перевірити локально. На pre/prod (https) прапорець є.
    secure: process.env.NODE_ENV === 'production',
    maxAge: RENEW_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return res;
}
