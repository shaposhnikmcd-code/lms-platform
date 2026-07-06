import { translateStringWithDeepL, translateNewsContent, translateNewsJson } from './translate';

export interface NewsTranslatableFields {
  title: string;
  excerpt?: string | null;
  content: string;
  /** JSON-білдер прев'ю картки. Якщо null/undefined — переклад пропускається. */
  previewContent?: string | null;
  /** Block-based шаблонний контент (Block[] JSON). Тут живе текст EVENT/ARTICLE-
   *  карток (heading/text/quote/спецблоки). Пріоритет над templateData. */
  templateBlocks?: string | null;
  /** Legacy form-based шаблон (EventData/ArticleData object JSON). Fallback коли
   *  templateBlocks порожній. */
  templateData?: string | null;
}

export interface NewsTranslations {
  titleEn: string | null;
  titlePl: string | null;
  excerptEn: string | null;
  excerptPl: string | null;
  contentEn: string | null;
  contentPl: string | null;
  previewContentEn: string | null;
  previewContentPl: string | null;
  templateBlocksEn: string | null;
  templateBlocksPl: string | null;
  templateDataEn: string | null;
  templateDataPl: string | null;
}

/**
 * Translate a news item's title/excerpt/content/previewContent + шаблонний
 * контент (templateBlocks / templateData) into both EN and PL via DeepL.
 * Errors are swallowed per-locale: any locale that fails returns null and the
 * frontend falls back to the Ukrainian original.
 */
export async function translateNewsAllLocales(
  news: NewsTranslatableFields
): Promise<NewsTranslations> {
  const result: NewsTranslations = {
    titleEn: null, titlePl: null,
    excerptEn: null, excerptPl: null,
    contentEn: null, contentPl: null,
    previewContentEn: null, previewContentPl: null,
    templateBlocksEn: null, templateBlocksPl: null,
    templateDataEn: null, templateDataPl: null,
  };

  for (const locale of ['en', 'pl'] as const) {
    try {
      const [title, excerpt, content, previewContent, templateBlocks, templateData] = await Promise.all([
        translateStringWithDeepL(news.title, locale),
        news.excerpt ? translateStringWithDeepL(news.excerpt, locale) : Promise.resolve(null),
        translateNewsContent(news.content, locale),
        news.previewContent
          ? translateNewsContent(news.previewContent, locale)
          : Promise.resolve(null),
        news.templateBlocks
          ? translateNewsJson(news.templateBlocks, locale)
          : Promise.resolve(null),
        news.templateData
          ? translateNewsJson(news.templateData, locale)
          : Promise.resolve(null),
      ]);
      const suffix = locale === 'en' ? 'En' : 'Pl';
      result[`title${suffix}` as keyof NewsTranslations] = title;
      result[`excerpt${suffix}` as keyof NewsTranslations] = excerpt;
      result[`content${suffix}` as keyof NewsTranslations] = content;
      result[`previewContent${suffix}` as keyof NewsTranslations] = previewContent;
      result[`templateBlocks${suffix}` as keyof NewsTranslations] = templateBlocks;
      result[`templateData${suffix}` as keyof NewsTranslations] = templateData;
    } catch (e) {
      console.error(`Failed to translate news to ${locale}:`, e);
    }
  }

  return result;
}
