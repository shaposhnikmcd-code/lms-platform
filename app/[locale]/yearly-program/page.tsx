import { Inter } from 'next/font/google';
import { getTranslatedContent } from '@/lib/translate';
import { learningContent } from './_content/uk';
import HeroSection from './_components/HeroSection';
import ForWhomSection from './_components/ForWhomSection';
import FormatSection from './_components/FormatSection';
import CertificatesSection from './_components/CertificatesSection';
import ModulesSection from './_components/ModulesSection';
import PricingSection from './_components/PricingSection';
import TeacherSection from './_components/TeacherSection';
import OutcomesSection from './_components/OutcomesSection';
import StepsSection from './_components/StepsSection';
import CtaSection from './_components/CtaSection';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

// ISR: статичний контент з файлів, без БД. Регенерація раз/годину достатньо.
// Миттєве оновлення — через revalidatePath('/yearly-program') у CMS-мутаціях, якщо з’являться.
export const revalidate = 3600;

const getContent = getTranslatedContent(learningContent, 'yearly-program-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function YearlyProgramPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale) as any;

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>
      <HeroSection
        badge={c.badge}
        title1={c.title1}
        title2={c.title2}
        description={c.description}
        btnEnroll={c.btnEnroll}
        btnProgram={c.btnProgram}
        monthlyPayment={c.monthlyPayment}
        priceNote={c.priceNote}
        durationLabel={c.durationLabel}
        duration={c.duration}
        enrollNow={c.enrollNow}
        stats={c.stats}
      />
      <ForWhomSection title={c.forWhom.title} items={c.forWhom.items} label={c.forWhom.label} />
      <FormatSection label={c.format.label} title={c.format.title} items={c.format.items} />
      <CertificatesSection t={c.certificatesSection} />
      <ModulesSection
        label={c.modules.label}
        title={c.modules.title}
        subtitle={c.modules.subtitle}
        items={c.modules.items}
      />
      <PricingSection t={c.pricingSection} />
      <TeacherSection t={c.teacherSection} />
      <OutcomesSection label={c.outcomes.label} title={c.outcomes.title} items={c.outcomes.items} />
      <StepsSection label={c.steps.label} title={c.steps.title} items={c.steps.items} />
      <CtaSection title={c.cta.title} btnLabel={c.cta.btnChoosePayment} />
    </main>
  );
}