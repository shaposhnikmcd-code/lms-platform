/**
 * Централізовані SEO-хелпери: canonical, hreflang, OG/Twitter, title-шаблон.
 *
 * Правила URL-ів (мають збігатися з `i18n/routing.ts`):
 *   `localePrefix: "as-needed"` + `defaultLocale: "uk"` → uk-сторінки живуть
 *   БЕЗ префікса (`/courses`), en/pl — з префіксом (`/en/courses`, `/pl/courses`).
 *   Якщо колись зміниться routing — правити тут, в одному місці.
 */

import type { Metadata } from "next";

/** Канонічний хост. Усі canonical/hreflang/sitemap будуються від нього. */
export const SITE_URL = "https://www.uimp.com.ua";

export const SITE_NAME = "UIMP";

/** Повна назва інституту — для OG-описів і title головної. */
export const SITE_FULL_NAME_UK = "Український інститут Душеопіки та Психотерапії";

export const LOCALES = ["uk", "en", "pl"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "uk";

/** BCP-47 для `hreflang`. uk-UA — основний ринок, en/pl без регіону (глобальні). */
const HREFLANG: Record<AppLocale, string> = {
  uk: "uk-UA",
  en: "en",
  pl: "pl",
};

/** Значення для `<html lang>`. */
export const HTML_LANG: Record<AppLocale, string> = {
  uk: "uk",
  en: "en",
  pl: "pl",
};

/** Значення для `og:locale`. */
const OG_LOCALE: Record<AppLocale, string> = {
  uk: "uk_UA",
  en: "en_US",
  pl: "pl_PL",
};

/** Дефолтна OG-картинка (1080×1080 логотип UIMP). */
export const DEFAULT_OG_IMAGE = {
  url: "/logo.jpg",
  width: 1080,
  height: 1080,
  alt: "UIMP",
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Будь-який рядок → валідна локаль (фолбек на uk). */
export function normalizeLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Абсолютний URL сторінки в конкретній локалі.
 * `path` — шлях БЕЗ локального префікса, з ведучим слешем (`/` для головної).
 */
export function localeUrl(locale: string, path: string): string {
  const loc = normalizeLocale(locale);
  const prefix = loc === DEFAULT_LOCALE ? "" : `/${loc}`;
  const clean = path === "/" || path === "" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${SITE_URL}${prefix}${clean}`;
}

/**
 * `alternates` для Metadata: canonical поточної локалі + hreflang усіх трьох
 * + `x-default` (uk як основна версія).
 */
export function buildAlternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: localeUrl(locale, path),
    languages: {
      [HREFLANG.uk]: localeUrl("uk", path),
      [HREFLANG.en]: localeUrl("en", path),
      [HREFLANG.pl]: localeUrl("pl", path),
      "x-default": localeUrl(DEFAULT_LOCALE, path),
    },
  };
}

/** Обрізає опис до SEO-адекватної довжини по межі слова. */
export function clampDescription(text: string | null | undefined, max = 160): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?–—-]+$/, "")}…`;
}

export type SeoImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type PageSeoInput = {
  locale: string;
  /** Шлях без локального префікса, напр. `/courses` або `/news/my-slug`. */
  path: string;
  /** Заголовок БЕЗ « — UIMP» — суфікс додасть title.template з root layout. */
  title: string;
  description: string;
  /** true → title використовується як є, без « — UIMP». */
  titleAbsolute?: boolean;
  image?: SeoImage | null;
  type?: "website" | "article";
  /** `noindex, nofollow` — для сторінок верифікації/прев'ю. */
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

/** Єдина точка збірки Metadata для публічних сторінок. */
export function buildPageMetadata(input: PageSeoInput): Metadata {
  const locale = normalizeLocale(input.locale);
  const description = clampDescription(input.description);
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const fullTitle = input.titleAbsolute ? input.title : `${input.title} — ${SITE_NAME}`;
  const url = localeUrl(locale, input.path);

  const metadata: Metadata = {
    title: input.titleAbsolute ? { absolute: input.title } : input.title,
    description,
    alternates: buildAlternates(locale, input.path),
    openGraph: {
      type: input.type ?? "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [image],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.url],
    },
  };

  if (input.noindex) {
    // Сторінка не має потрапляти в індекс, але й canonical/hreflang їй не потрібні —
    // прибираємо, щоб не плодити суперечливі сигнали.
    delete metadata.alternates;
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    };
  }

  return metadata;
}

/**
 * Метадані лендінга курсу. Усі 8 лендінгів мають однакову форму `_content/{locale}.ts`
 * (`title1` + `title2`/`title3` + `description`), тож збірка спільна — щоб title
 * і опис завжди бралися з реального контенту сторінки, а не дублювались руками.
 */
export function buildCourseLandingMetadata(opts: {
  locale: string;
  /** Слаг папки лендінга, напр. `psychiatry-basics`. */
  slug: string;
  content: { title1: string; title2?: string; title3?: string; description: string };
}): Metadata {
  const { title1, title2, title3, description } = opts.content;
  const title = [title1, title2, title3].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return buildPageMetadata({
    locale: opts.locale,
    path: `/courses/${opts.slug}`,
    title,
    description,
  });
}
