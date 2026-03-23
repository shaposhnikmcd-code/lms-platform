import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const COUNTRY_LANG: Record<string, string> = {
  PL: 'pl', DE: 'de', CZ: 'cs', LT: 'lt', LV: 'lv',
  EE: 'et', IT: 'it', ES: 'es', SK: 'sk', HU: 'hu',
  RO: 'ro', MD: 'ro', FR: 'fr', GB: 'en', AT: 'de', NL: 'nl',
};

function isUkrainian(text: string): boolean {
  return /[а-яіїєґА-ЯІЇЄҐ]/.test(text);
}

async function getLocalCityNames(query: string, countryCode: string): Promise<string[]> {
  try {
    const localLang = COUNTRY_LANG[countryCode] ?? 'en';

    // Крок 1 — шукаємо в Wikidata українською
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', query);
    searchUrl.searchParams.set('language', 'uk');
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('limit', '5');
    searchUrl.searchParams.set('format', 'json');

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'UIMP-LMS-Platform/1.0 (uimp.edu@gmail.com)' },
    });
    const searchData = await searchRes.json();
    const ids: string[] = searchData.search?.map((item: any) => item.id) || [];
    if (!ids.length) return [];

    // Крок 2 — отримуємо назви англійською + мовою країни
    const entitiesUrl = new URL('https://www.wikidata.org/w/api.php');
    entitiesUrl.searchParams.set('action', 'wbgetentities');
    entitiesUrl.searchParams.set('ids', ids.join('|'));
    entitiesUrl.searchParams.set('props', 'labels');
    entitiesUrl.searchParams.set('languages', `en|${localLang}`);
    entitiesUrl.searchParams.set('format', 'json');

    const entitiesRes = await fetch(entitiesUrl.toString(), {
      headers: { 'User-Agent': 'UIMP-LMS-Platform/1.0 (uimp.edu@gmail.com)' },
    });
    const entitiesData = await entitiesRes.json();

    const names: string[] = [];
    for (const id of ids) {
      const entity = entitiesData.entities?.[id];
      const enLabel = entity?.labels?.en?.value;
      const localLabel = entity?.labels?.[localLang]?.value;
      if (enLabel) names.push(enLabel);
      if (localLabel && localLabel !== enLabel) {
        names.push(localLabel);
        // Видаляємо діакритику (München → Munchen, Kraków → Krakow)
        const withoutDiacritics = localLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (withoutDiacritics !== localLabel) names.push(withoutDiacritics);
      }
    }

    return [...new Set(names)];
  } catch (e) {
    console.error('Wikidata error:', e);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { countryCode, search } = await req.json();

    if (!countryCode || !search || search.length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const searchTerms: string[] = [search];

    if (isUkrainian(search)) {
      const localNames = await getLocalCityNames(search, countryCode);
      searchTerms.push(...localNames);
    }

    const results = await prisma.novaPostDivision.findMany({
      where: {
        countryCode,
        OR: searchTerms.map(term => ({
          city: { contains: term, mode: 'insensitive' as const },
        })),
      },
      select: { city: true },
      distinct: ['city'],
      take: 10,
      orderBy: { city: 'asc' },
    });

    const cities = results.map(r => r.city).filter(Boolean) as string[];
    return NextResponse.json({ cities });

  } catch (error) {
    console.error('❌ Помилка пошуку міст EU:', error);
    return NextResponse.json({ cities: [] });
  }
}