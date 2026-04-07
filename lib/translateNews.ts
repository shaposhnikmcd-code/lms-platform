import { translateStringWithDeepL, translateNewsContent } from './translate';

export interface NewsTranslatableFields {
  title: string;
  excerpt?: string | null;
  content: string;
}

export interface NewsTranslations {
  titleEn: string | null;
  titlePl: string | null;
  excerptEn: string | null;
  excerptPl: string | null;
  contentEn: string | null;
  contentPl: string | null;
}

/**
 * Translate a news item's title/excerpt/content into both EN and PL via DeepL.
 * Errors are swallowed per-locale: any locale that fails returns null and the
 * frontend will fall back to the Ukrainian original.
 */
export async function translateNewsAllLocales(
  news: NewsTranslatableFields
): Promise<NewsTranslations> {
  const result: NewsTranslations = {
    titleEn: null, titlePl: null,
    excerptEn: null, excerptPl: null,
    contentEn: null, contentPl: null,
  };

  for (const locale of ['en', 'pl'] as const) {
    try {
      const [title, excerpt, content] = await Promise.all([
        translateStringWithDeepL(news.title, locale),
        news.excerpt ? translateStringWithDeepL(news.excerpt, locale) : Promise.resolve(null),
        translateNewsContent(news.content, locale),
      ]);
      const suffix = locale === 'en' ? 'En' : 'Pl';
      result[`title${suffix}` as keyof NewsTranslations] = title;
      result[`excerpt${suffix}` as keyof NewsTranslations] = excerpt;
      result[`content${suffix}` as keyof NewsTranslations] = content;
    } catch (e) {
      console.error(`Failed to translate news to ${locale}:`, e);
    }
  }

  return result;
}
