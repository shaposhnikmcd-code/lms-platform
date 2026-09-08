import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { resolveSellableCohort } from '@/lib/yearlyProgramCohort';
import { RENEW_COOKIE_NAME } from '@/lib/yearlyProgramRenew';
import { resolveRenewState } from '@/lib/yearlyProgramRenewState';

/// GET /api/yearly-program/renew-state — стан блоку «Оплата наступного модуля» для того,
/// хто щойно прийшов за персональним посиланням.
///
/// Токен береться ВИКЛЮЧНО з httpOnly-cookie, яку поставив `/yearly-program/renew/<token>`.
/// Ні query, ні body тут не читаються: інакше сенс виносу токена з URL зникав би — його
/// знову можна було б підставити ззовні й засвітити в логах.
///
/// 204 — показувати нічого (cookie немає, протермінувалась, або токен більше не сходиться
/// з підпискою). Клієнт на 204 просто не рендерить панель, як і до появи фічі.
///
/// Кеш вимкнений жорстко: відповідь персональна, і потрапити в CDN вона не має права.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(RENEW_COOKIE_NAME)?.value;
  if (!token) return new NextResponse(null, { status: 204 });

  const [settings, currentCohort] = await Promise.all([
    getYearlyProgramSettings(prisma),
    resolveSellableCohort(prisma),
  ]);

  const state = await resolveRenewState({
    client: prisma,
    token,
    currentCohort,
    monthlyPrice: settings.monthlyPrice,
    registrationOpen: settings.registrationOpen && !!currentCohort,
  });

  // `invalid` = токен мертвий або підписка вже не та. Для клієнта це те саме, що «нема
  // чого показувати»: мʼяке повідомлення про протермінування малює редирект з handler-а
  // (`?renew=expired`), а не ця відповідь.
  if (state.kind === 'invalid') {
    const res = new NextResponse(null, { status: 204 });
    res.cookies.delete(RENEW_COOKIE_NAME);
    return res;
  }

  // Токена в стані немає за побудовою (`RenewState`) — він лишається в httpOnly-cookie,
  // і саме звідти його бере чекаут.
  const res = NextResponse.json(state);
  res.headers.set('Cache-Control', 'no-store, private');
  return res;
}
