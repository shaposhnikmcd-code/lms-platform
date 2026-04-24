import { translateStringWithDeepL } from './translate';

export interface BundleTranslations {
  titleEn: string | null;
  titlePl: string | null;
}

/**
 * Translate a bundle title into EN and PL via DeepL. Same pattern as
 * translateNewsAllLocales — per-locale errors are swallowed so the caller can
 * still save the Ukrainian original if DeepL is down.
 */
export async function translateBundleTitle(title: string): Promise<BundleTranslations> {
  const result: BundleTranslations = { titleEn: null, titlePl: null };
  if (!title) return result;

  for (const locale of ['en', 'pl'] as const) {
    try {
      const translated = await translateStringWithDeepL(title, locale);
      if (locale === 'en') result.titleEn = translated;
      else result.titlePl = translated;
    } catch (e) {
      console.error(`Failed to translate bundle title to ${locale}:`, e);
    }
  }

  return result;
}
