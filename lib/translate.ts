import { unstable_cache } from 'next/cache';

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

const TRANSLATION_FIXES: Record<string, Record<string, string>> = {
  en: {
    'Soul Care and Psychotherapy': 'Ministry and Psychotherapy',
    'soul care and psychotherapy': 'ministry and psychotherapy',
    'Soul Care': 'Ministry',
    'soul care': 'ministry',
    'Soulcare': 'Ministry',
    'soulcare': 'ministry',
    'Institute of Soul': 'Institute of Ministry',
    'institute of soul': 'institute of ministry',
  },
  pl: {
    'Opieki nad Duszą i Psychoterapii': 'Służby i Psychoterapii',
    'opieki nad duszą i psychoterapii': 'służby i psychoterapii',
    'Opieka nad Duszą': 'Służba',
    'opieka nad duszą': 'służba',
    'Duszpasterstwo': 'Służba',
    'duszpasterstwo': 'służba',
  },
};

function applyFixes(text: string, targetLang: string): string {
  const fixes = TRANSLATION_FIXES[targetLang];
  if (!fixes) return text;
  let result = text;
  for (const [wrong, correct] of Object.entries(fixes)) {
    result = result.replaceAll(wrong, correct);
  }
  return result;
}

async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (!texts.length) return texts;

  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        source_lang: 'UK',
        target_lang: targetLang === 'pl' ? 'PL' : 'EN-US',
      }),
    });

    if (!response.ok) {
      console.error(`DeepL error: ${response.status} ${response.statusText}`);
      return texts;
    }

    const raw = await response.text();
    if (!raw) return texts;

    const data = JSON.parse(raw);
    const translated = data.translations?.map((t: { text: string }) => t.text) ?? texts;

    return translated.map((result: string, i: number) => {
      const original = texts[i];
      let fixed = result;
      if (!original.endsWith('.') && fixed.endsWith('.')) {
        fixed = fixed.slice(0, -1);
      }
      return applyFixes(fixed, targetLang);
    });
  } catch (e) {
    console.error('DeepL batch error:', e);
    return texts;
  }
}

function shouldSkip(key: string, value: string): boolean {
  if (/^(https?:\/\/|\/|from-\[|#[0-9A-Fa-f]|\.webp|\.jpg|\.png|\.jpeg)/.test(value)) return true;
  if (/^\d+[+]?$/.test(value)) return true;
  if (!value.trim()) return true;
  return false;
}

const SKIP_KEYS = ['color', 'image', 'href', 'icon', 'number', 'rating', 'step', 'value', 'currency'];

function collectStrings(obj: unknown, key: string, strings: string[], paths: string[], currentPath: string): void {
  if (typeof obj === 'string') {
    if (!SKIP_KEYS.includes(key) && !shouldSkip(key, obj)) {
      strings.push(obj);
      paths.push(currentPath);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStrings(item, key, strings, paths, `${currentPath}[${i}]`));
    return;
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const [k, v] of Object.entries(obj)) {
      if (!SKIP_KEYS.includes(k)) {
        collectStrings(v, k, strings, paths, `${currentPath}.${k}`);
      }
    }
  }
}

function applyTranslations(obj: unknown, key: string, translations: Map<string, string>, currentPath: string): unknown {
  if (typeof obj === 'string') {
    if (!SKIP_KEYS.includes(key) && !shouldSkip(key, obj)) {
      return translations.get(currentPath) ?? obj;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => applyTranslations(item, key, translations, `${currentPath}[${i}]`));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.includes(k)) {
        result[k] = v;
      } else {
        result[k] = applyTranslations(v, k, translations, `${currentPath}.${k}`);
      }
    }
    return result;
  }
  return obj;
}

async function translateObject<T>(obj: T, targetLang: string): Promise<T> {
  if (targetLang === 'uk') return obj;

  const strings: string[] = [];
  const paths: string[] = [];
  collectStrings(obj, '', strings, paths, 'root');

  if (!strings.length) return obj;

  const BATCH_SIZE = 50;
  const allTranslated: string[] = [];

  for (let i = 0; i < strings.length; i += BATCH_SIZE) {
    const batch = strings.slice(i, i + BATCH_SIZE);
    const translated = await translateBatch(batch, targetLang);
    allTranslated.push(...translated);
  }

  const translationMap = new Map<string, string>();
  paths.forEach((path, i) => translationMap.set(path, allTranslated[i]));

  return applyTranslations(obj, '', translationMap, 'root') as T;
}

export function getTranslatedContent<T>(content: T, cacheKey: string) {
  return async (locale: string): Promise<T> => {
    if (locale === 'uk') return content;

    const translate = unstable_cache(
      async (): Promise<T> => translateObject(content, locale),
      [`${cacheKey}-${locale}`],
      { revalidate: 2592000 }
    );

    return translate();
  };
}

const UA_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd',
  'е': 'e', 'є': 'ye', 'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i',
  'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ь': '', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D',
  'Е': 'E', 'Є': 'Ye', 'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I',
  'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
  'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
  'Ь': '', 'Ю': 'Yu', 'Я': 'Ya',
};

export function transliterateUA(text: string): string {
  return text.split('').map(char => UA_TO_LATIN[char] ?? char).join('');
}