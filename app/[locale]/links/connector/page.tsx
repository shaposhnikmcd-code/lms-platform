import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { connectorContent } from './_content/uk';
import ConnectorClient from './_components/ConnectorClient';

const getContent = getTranslatedContent(connectorContent, 'connector-page');

export default async function ConnectorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  const currency = getCurrency(locale);
  return <ConnectorClient content={c} currency={currency} />;
}