import { Inter } from 'next/font/google';
import prisma from '@/lib/prisma';
import { getTranslatedContent } from '@/lib/translate';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { verifyInvite, type InvitePayload } from '@/lib/yearlyProgramInvite';
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
import InviteBanner from './_components/InviteBanner';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

// ISR: статичний контент з файлів + DB settings (з адмінки). Адмінка викликає
// revalidatePath на /yearly-program при зміні — кеш оновлюється миттєво.
// Дефолтний інтервал 1 година — fallback якщо щось пропустимо.
export const revalidate = 3600;

const getContent = getTranslatedContent(learningContent, 'yearly-program-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function YearlyProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { locale } = await params;
  const { invite: inviteToken } = await searchParams;
  const [c, settings, currentCohort] = await Promise.all([
    getContent(locale) as Promise<any>,
    getYearlyProgramSettings(prisma),
    prisma.yearlyProgramCohort.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    }),
  ]);

  // Invite-flow: парсимо token (якщо є). Якщо валідний — підтягуємо назву cohort-у
  // для банера й lock-имо план/email у формі. Якщо невалідний — ігноруємо як ?invite=null
  // (звичайна сторінка), без помилки користувачу.
  let invitePayload: InvitePayload | null = null;
  let inviteCohortName: string | null = null;
  if (inviteToken) {
    invitePayload = verifyInvite(inviteToken);
    if (invitePayload) {
      const cohort = await prisma.yearlyProgramCohort.findUnique({
        where: { id: invitePayload.cohortId },
        select: { name: true },
      });
      inviteCohortName = cohort?.name ?? null;
    }
  }

  const btnLabel = settings.btnLabel;
  // Реєстрація відкрита для широкої аудиторії ТІЛЬКИ коли:
  // 1) admin увімкнув `registrationOpen` у налаштуваннях, І
  // 2) існує `isCurrent` cohort (від чого рахувати startDate/endDate доступу).
  // Invite-flow обходить обидва пункти — invite-cohort береться з самого token-у, тому
  // запрошений студент може оплатити навіть коли широка реєстрація закрита.
  const hasCurrentCohort = !!currentCohort;
  const registrationOpenForUser = (settings.registrationOpen && hasCurrentCohort) || !!invitePayload;

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>
      {invitePayload && (
        <InviteBanner
          email={invitePayload.email}
          cohortName={inviteCohortName}
        />
      )}
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
        registrationOpen={registrationOpenForUser}
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
        registrationOpen={registrationOpenForUser}
        invite={invitePayload && inviteToken ? {
          token: inviteToken,
          email: invitePayload.email,
          name: invitePayload.name ?? null,
        } : null}
      />
      <TeacherSection t={c.teacherSection} />
      <OutcomesSection label={c.outcomes.label} title={c.outcomes.title} items={c.outcomes.items} />
      <StepsSection label={c.steps.label} title={c.steps.title} items={c.steps.items} />
      <CtaSection title={c.cta.title} btnLabel={btnLabel} registrationOpen={registrationOpenForUser} />
    </main>
  );
}
