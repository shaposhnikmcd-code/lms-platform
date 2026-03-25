import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { gamesContent } from './_content/uk';
import GamesPageClient from './_components/GamesPageClient';

const getContent = getTranslatedContent(gamesContent, 'games-page');

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  const currency = getCurrency(locale);
  return <GamesPageClient content={c} currency={currency} />;
}