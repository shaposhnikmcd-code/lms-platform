import { Inter } from 'next/font/google';
import prisma from '@/lib/prisma';
import { getTranslatedContent } from '@/lib/translate';
import { buildPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { resolveSellableCohort } from '@/lib/yearlyProgramCohort';
import { cohortSlotIndex, maxAutopayChargeCount } from '@/lib/yearlyProgramAccess';
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
import RenewPanel from './_components/RenewPanel';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

// ISR: статичний контент з файлів + DB settings (з адмінки). Адмінка викликає
// revalidatePath на /yearly-program при зміні — кеш оновлюється миттєво.
// Дефолтний інтервал 1 година — fallback якщо щось пропустимо.
export const revalidate = 3600;

const getContent = getTranslatedContent(learningContent, 'yearly-program-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = await getContent(locale);
  return buildPageMetadata({
    locale,
    path: '/yearly-program',
    title: `${c.title1} ${c.title2}`,
    // badge починається з емодзі («🎓 Сертифікаційна програма UIMP») — зрізаємо його,
    // лишаючи текст. `\p{L}` з прапорцем `u`, бо `\w` не покриває кирилицю.
    description: `${c.description}. ${c.duration} — ${c.badge.replace(/^[^\p{L}\p{N}]+/u, '')}.`,
  });
}

export default async function YearlyProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { locale } = await params;
  const { invite: inviteToken } = await searchParams;
  const [c, settings, currentCohort, unfinishedCohort] = await Promise.all([
    getContent(locale) as Promise<any>,
    getYearlyProgramSettings(prisma),
    // «Поточний» cohort, або fallback на найближчий незавершений — щоб кнопки оплати
    // були активні за «Реєстрація відкрита» + наявності запуску, без ручного прапорця.
    resolveSellableCohort(prisma),
    // Будь-який ще не завершений набір — умова показу рядка доплати модуля. Це ШИРШЕ за
    // sellable: коли поряд зʼявляється набір 2027 під продажі, `resolveSellableCohort`
    // віддає його, а студент 2026 доплачує у СВІЙ набір, який теж ще живий.
    prisma.yearlyProgramCohort.findFirst({
      where: { endDate: { gte: new Date() } },
      select: { id: true },
    }),
  ]);

  // Invite-flow: парсимо token (якщо є). Якщо валідний — підтягуємо назву cohort-у
  // для банера й lock-имо план/email у формі. Якщо невалідний — ігноруємо як ?invite=null
  // (звичайна сторінка), без помилки користувачу.
  let invitePayload: InvitePayload | null = null;
  let inviteCohortName: string | null = null;
  /// Набір, за яким рахуємо ціну для цього відвідувача: у invite-флоу він береться
  /// з token-у (менеджер міг запросити в інший набір), інакше — поточний продажний.
  let pricingCohort: { startDate: Date; endDate: Date } | null = currentCohort;
  if (inviteToken) {
    invitePayload = verifyInvite(inviteToken);
    if (invitePayload) {
      const cohort = await prisma.yearlyProgramCohort.findUnique({
        where: { id: invitePayload.cohortId },
        select: { name: true, startDate: true, endDate: true },
      });
      inviteCohortName = cohort?.name ?? null;
      if (cohort) pricingCohort = { startDate: cohort.startDate, endDate: cohort.endDate };
    }
  }

  // Скільки місячних платежів реально буде у того, хто купує СЬОГОДНІ: модуль, у який
  // потрапляє покупка, і всі наступні. У вересні це 9, у жовтні — 8. Без цього сторінка
  // обіцяла б «9 платежів × 2200 = 19 800», а WayForPay програмував би 8 списань.
  // Сторінка ISR з `revalidate = 3600`, тож на межі модулів число оновлюється протягом
  // години — набагато частіше за добу.
  const recurringCount = pricingCohort
    ? maxAutopayChargeCount({
      cohort: pricingCohort,
      firstSlot: cohortSlotIndex(pricingCohort, new Date()),
    })
    : YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;

  const btnLabel = settings.btnLabel;
  // Реєстрація відкрита для широкої аудиторії ТІЛЬКИ коли:
  // 1) admin увімкнув `registrationOpen` у налаштуваннях, І
  // 2) існує `isCurrent` cohort (від чого рахувати startDate/endDate доступу).
  // Invite-flow обходить обидва пункти — invite-cohort береться з самого token-у, тому
  // запрошений студент може оплатити навіть коли широка реєстрація закрита.
  const hasCurrentCohort = !!currentCohort;
  const registrationOpenForUser = (settings.registrationOpen && hasCurrentCohort) || !!invitePayload;
  // Рядок «Уже навчаєтесь за місячною оплатою? Оплатити наступний модуль» — окремий вхід
  // для чинного студента, і рубильник реєстрації його не стосується (рішення власника
  // 09.09.2026): менеджер закриває продажі одразу після запуску набору, а помісячним
  // студентам платити за модулі ще весь рік.
  //
  // Умова — наявність будь-якого НЕзавершеного набору, а не набору під продажі: роут для
  // такої доплати бере набір із самої підписки студента, тож рядок лишається робочим і
  // тоді, коли продажі вже перемкнули на наступний набір.
  const renewEntryOpen = !!unfinishedCohort;

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
      {/* Персональний блок поновлення. Дані тягне сам, з cookie, поставленої
          route handler-ом `/yearly-program/renew/<token>` — сторінка лишається
          знеособленою і придатною для кешу. Без cookie не рендерить нічого. */}
      <RenewPanel />
      <PricingSection
        t={{ ...c.pricingSection, btnYear: btnLabel, btnMonth: btnLabel }}
        yearlyPrice={settings.yearlyPrice}
        yearlyOldPrice={settings.yearlyOldPrice}
        monthlyPrice={settings.monthlyPrice}
        monthlyOldPrice={settings.monthlyOldPrice}
        registrationOpen={registrationOpenForUser}
        renewOpen={renewEntryOpen}
        recurringCount={recurringCount}
        locale={locale}
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
