import Hero from '@/components/home/Hero';
import Directions from '@/components/home/Directions';
import CTA from '@/components/home/CTA';
import MissionSection from '@/components/home/MissionSection';
import { getTranslatedContent } from '@/lib/translate';
import { homeContent } from './_content/home/uk';

const getContent = getTranslatedContent(homeContent, 'home-page');

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main>
      <Hero content={c.hero} />
      <Directions content={c.directions} />
      <div style={{ height: 40, background: 'linear-gradient(180deg, #F7F3EE 0%, #FAF6F0 100%)', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />
      <MissionSection />
      <div style={{ height: 40, background: 'linear-gradient(180deg, #FAF6F0 0%, #FFFFFF 100%)', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />
      <CTA content={c.cta} />
    </main>
  );
}