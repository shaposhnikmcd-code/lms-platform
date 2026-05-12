import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { connectorContent } from './_content/uk';
import { getConnectorPricing } from '@/lib/connectorPricing';
import ConnectorClient from './_components/ConnectorClient';

export const revalidate = 0;

const getContent = getTranslatedContent(connectorContent, 'connector-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function ConnectorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [c, pricing] = await Promise.all([getContent(locale), getConnectorPricing()]);
  const currency = getCurrency(locale);
  return (
    <ConnectorClient
      content={c}
      currency={currency}
      price={String(pricing.price)}
      oldPrice={pricing.oldPrice !== null ? String(pricing.oldPrice) : null}
      gamePrice={pricing.price}
    />
  );
}