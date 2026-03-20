import Hero from '@/components/home/Hero';
import Directions from '@/components/home/Directions';
import CTA from '@/components/home/CTA';
import MissionSection from '@/components/home/MissionSection';
import SocialSection from '@/components/home/SocialSection';
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
      <MissionSection />
      <CTA content={c.cta} />
      <SocialSection />
    </main>
  );
}