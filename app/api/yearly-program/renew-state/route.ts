import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { RENEW_COOKIE_NAME } from '@/lib/yearlyProgramRenew';
import { resolveRenewState } from '@/lib/yearlyProgramRenewState';

/// GET /api/yearly-program/renew-state — стан блоку «Оплата наступного модуля» для того,
/// хто щойно прийшов за персональним посиланням.
///
/// Токен береться ВИКЛЮЧНО з httpOnly-cookie, яку поставив `/yearly-program/renew/<token>`.
/// Ні query, ні body тут не читаються: інакше сенс виносу токена з URL зникав би — його
/// знову можна було б підставити ззовні й засвітити в логах.
///
/// 204 — cookie немає взагалі: людина відкрила лендінг сама, персональної частини для неї
/// не існує. Якщо ж cookie є, а токен більше не сходиться з підпискою, віддаємо
/// `{ kind: 'invalid' }` — панель покаже текст і контакт менеджера. Мовчазні 204 у цьому
/// випадку лишали людину з листа перед сторінкою, на якій не сталося нічого.
///
/// Набір для поновлення резолвиться з САМОЇ підписки (`resolveRenewState`), а не з
/// `resolveSellableCohort`: доплата йде в набір, у якому людина навчається, навіть коли
/// продажі вже перемкнули на наступний.
///
/// Кеш вимкнений жорстко: відповідь персональна, і потрапити в CDN вона не має права.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(RENEW_COOKIE_NAME)?.value;
  if (!token) return new NextResponse(null, { status: 204 });

  const settings = await getYearlyProgramSettings(prisma);

  const state = await resolveRenewState({
    client: prisma,
    token,
    monthlyPrice: settings.monthlyPrice,
    registrationOpen: settings.registrationOpen,
  });

  const res = NextResponse.json(state);
  res.headers.set('Cache-Control', 'no-store, private');
  // Мертвий токен не має лишатись у браузері: він уже нічого не відкриє, а на наступних
  // відкриттях лендінга (у тому числі коли людина просто прийшла купувати) знову малював
  // би повідомлення про недійсне посилання.
  if (state.kind === 'invalid') res.cookies.delete(RENEW_COOKIE_NAME);
  return res;
}
