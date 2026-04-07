import LinksClient from './_components/LinksClient';
import { getTranslatedContent } from '@/lib/translate';
import { linksContent } from './_content/uk';

const getContent = getTranslatedContent(linksContent, 'links-page', {
  en: () => import('./_content/en').then(m => m.linksContent),
  pl: () => import('./_content/pl').then(m => m.linksContent),
});

export default async function LinksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  return <LinksClient content={c} />;
}