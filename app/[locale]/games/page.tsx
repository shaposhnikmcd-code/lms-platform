import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { gamesContent } from './_content/uk';
import { getConnectorPricing } from '@/lib/connectorPricing';
import GamesPageClient from './_components/GamesPageClient';

// ISR вимкнено: ціна Конектора резолвиться з БД (override з адмінки).
// Перерахунок на кожен запит — допустимо для одного запиту до БД.
export const revalidate = 0;

const getContent = getTranslatedContent(gamesContent, 'games-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [c, pricing] = await Promise.all([getContent(locale), getConnectorPricing()]);
  const currency = getCurrency(locale);
  return (
    <GamesPageClient
      content={c}
      currency={currency}
      price={String(pricing.price)}
      oldPrice={pricing.oldPrice !== null ? String(pricing.oldPrice) : null}
      gamePrice={pricing.price}
    />
  );
}