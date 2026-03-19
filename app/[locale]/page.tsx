import Hero from '@/components/home/Hero';
import About from '@/components/home/About';
import Directions from '@/components/home/Directions';
import WhyUs from '@/components/home/WhyUs';
import CTA from '@/components/home/CTA';
import AboutTetiana from '@/components/home/AboutTetiana';
import { getTranslatedContent } from '@/lib/translate';
import { homeContent } from './_content/home/uk';

const getContent = getTranslatedContent(homeContent, 'home-page');

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main>
      <Hero content={c.hero} />
      <About content={c.about} />
      <Directions content={c.directions} />
      <WhyUs content={c.whyUs} />
      <AboutTetiana content={c.aboutTetiana} />
      <CTA content={c.cta} />
    </main>
  );
}