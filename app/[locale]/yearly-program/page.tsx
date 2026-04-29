import { Inter } from 'next/font/google';
import prisma from '@/lib/prisma';
import { getTranslatedContent } from '@/lib/translate';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
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

// ISR: статичний контент з файлів + DB settings (з адмінки). Адмінка викликає
// revalidatePath на /yearly-program при зміні — кеш оновлюється миттєво.
// Дефолтний інтервал 1 година — fallback якщо щось пропустимо.
export const revalidate = 3600;

const getContent = getTranslatedContent(learningContent, 'yearly-program-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function YearlyProgramPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [c, settings] = await Promise.all([
    getContent(locale) as Promise<any>,
    getYearlyProgramSettings(prisma),
  ]);

  // Override editable fields from admin settings.
  const btnLabel = settings.btnLabel;

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>
      <HeroSection
        badge={c.badge}
        title1={c.title1}
        title2={c.title2}
        description={c.description}
        btnEnroll={btnLabel}
        btnProgram={c.btnProgram}
        monthlyPayment={c.monthlyPayment}
        priceNote={settings.priceNote}
        durationLabel={c.durationLabel}
        duration={settings.duration}
        enrollNow={btnLabel}
        stats={c.stats}
        registrationOpen={settings.registrationOpen}
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
      <PricingSection
        t={{ ...c.pricingSection, btnYear: btnLabel, btnMonth: btnLabel }}
        yearlyPrice={settings.yearlyPrice}
        monthlyPrice={settings.monthlyPrice}
        registrationOpen={settings.registrationOpen}
      />
      <TeacherSection t={c.teacherSection} />
      <OutcomesSection label={c.outcomes.label} title={c.outcomes.title} items={c.outcomes.items} />
      <StepsSection label={c.steps.label} title={c.steps.title} items={c.steps.items} />
      <CtaSection title={c.cta.title} btnLabel={btnLabel} registrationOpen={settings.registrationOpen} />
    </main>
  );
}
