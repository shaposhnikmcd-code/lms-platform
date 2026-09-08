import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(uk|pl|en)/:path*",
    // Персональне посилання на оплату модуля Річної: /yearly-program/renew/<token>.
    // Потрібен ОКРЕМИЙ запис, бо загальне правило нижче відсіює будь-який шлях із
    // крапкою (щоб не чіпати статику), а підписаний токен — це рівно
    // `payload.signature`. Без цього рядка посилання з листа віддавало 404:
    // middleware не переписувала шлях на дефолтну локаль, і роут під app/[locale]/…
    // просто не знаходився.
    "/yearly-program/renew/:path*",
    "/((?!api|_next|_vercel|dashboard|auth|.*\\.(?!0).*$).*)",
  ],
};