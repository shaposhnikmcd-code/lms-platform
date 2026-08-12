import Hero from '@/components/home/Hero';
import Directions from '@/components/home/Directions';
import CTA from '@/components/home/CTA';
import MissionSection from '@/components/home/MissionSection';
import WhyChooseUimp from '@/components/home/WhyChooseUimp';
import { getTranslatedContent } from '@/lib/translate';
import { buildPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { homeContent } from './_content/home/uk';

const getContent = getTranslatedContent(homeContent, 'home-page', {
  en: () => import('./_content/home/en').then(m => m.default),
  pl: () => import('./_content/home/pl').then(m => m.default),
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = await getContent(locale);
  return buildPageMetadata({
    locale,
    path: '/',
    // Головна — єдина сторінка без суфікса « — UIMP»: назва інституту вже містить «UIMP».
    title: `${c.hero.title1} ${c.hero.title2}`,
    titleAbsolute: true,
    description: `${c.about.description}. ${c.hero.subtitle1}`,
  });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main>
      <Hero content={c.hero} />
      <Directions content={c.directions} />
      <MissionSection />
      <WhyChooseUimp />
      <CTA content={c.cta} />
    </main>
  );
}