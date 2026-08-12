import Script from "next/script";
import { Inter } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import {
  DEFAULT_OG_IMAGE,
  HTML_LANG,
  SITE_FULL_NAME_UK,
  SITE_NAME,
  SITE_URL,
  normalizeLocale,
} from "@/lib/seo";

// Inter — variable font з повним діапазоном ваг 100..900. Завантажується через
// next/font/google (self-hosted, без CSS-запиту до Google → нуль layout shift).
// Експорт CSS variable `--font-inter` робить шрифт доступним у будь-якому місці
// як `var(--font-inter)`. Для news editor дозволяє плавно змінювати font-weight
// (через слайдер 100..900) без fallback-хаків.
const inter = Inter({
  subsets: ["latin", "cyrillic", "latin-ext", "cyrillic-ext"],
  display: "swap",
  variable: "--font-inter",
  axes: ["opsz"],
});

// Базові SEO-дефолти для всього сайту. Кожна публічна сторінка перекриває
// title/description/OG через власний generateMetadata (див. [lib/seo.ts](lib/seo.ts));
// тут — те, що успадковується скрізь: metadataBase (від нього резолвляться
// відносні OG-картинки й canonical), title-шаблон «%s — UIMP» і OG-дефолти.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_FULL_NAME_UK}`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "UIMP — Український інститут Душеопіки та Психотерапії: курси психології, психіатрії, душеопікунства та сертифікаційна річна програма з біблійної терапії.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_FULL_NAME_UK}`,
    description:
      "Курси психології, психіатрії, душеопікунства та сертифікаційна річна програма з біблійної терапії.",
    url: SITE_URL,
    locale: "uk_UA",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_FULL_NAME_UK}`,
    description:
      "Курси психології, психіатрії, душеопікунства та сертифікаційна річна програма з біблійної терапії.",
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

/**
 * `<html lang>` має відповідати активній локалі. Root layout не отримує `params`,
 * тому локаль беремо з next-intl (її проставляє middleware). Поза `[locale]`
 * (dashboard/auth) хедера немає — фолбек на `uk`, що коректно: dashboard uk-only.
 */
async function resolveHtmlLang(): Promise<string> {
  try {
    return HTML_LANG[normalizeLocale(await getLocale())];
  } catch (e) {
    // Next сигналить «сторінка динамічна» через throw з полем `digest`. Проковтнути
    // його не можна — інакше prerender падає замість того, щоб позначити роут ƒ.
    if (e && typeof e === "object" && "digest" in e) throw e;
    return HTML_LANG.uk;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const lang = await resolveHtmlLang();

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {gtmId && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
        )}
      </head>
      <body>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {children}
      </body>
    </html>
  );
}
