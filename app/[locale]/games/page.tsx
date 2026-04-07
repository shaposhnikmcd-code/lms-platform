import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { gamesContent } from './_content/uk';
import GamesPageClient from './_components/GamesPageClient';

const getContent = getTranslatedContent(gamesContent, 'games-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  const currency = getCurrency(locale);
  return <GamesPageClient content={c} currency={currency} />;
}