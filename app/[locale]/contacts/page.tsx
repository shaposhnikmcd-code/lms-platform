import { getTranslatedContent } from "@/lib/translate";
import { contactsContent } from "./_content/uk";
import HeroSection from "./_components/HeroSection";
import TeamSection from "./_components/TeamSection";
import StorySection from "./_components/StorySection";
import SolutionSection from "./_components/SolutionSection";
import MissionBlock from "./_components/MissionBlock";
import RequestsSection from "./_components/RequestsSection";
import VisionSection from "./_components/VisionSection";
import SocialSection from "./_components/SocialSection";
import FormSection from "./_components/FormSection";
import FaqSection from "./_components/FaqSection";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const getContent = getTranslatedContent(contactsContent, "contacts-page", {
  en: () => import("./_content/en").then(m => m.default),
  pl: () => import("./_content/pl").then(m => m.default),
});

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', fontFamily: sysFont }}>
      <HeroSection t={c.sections.hero} />
      <TeamSection t={c.sections.team} />
      <StorySection t={c.sections.story} />
      <SolutionSection t={c.sections.solution} />
      <MissionBlock t={c.sections.mission} />
      <RequestsSection t={c.sections.requests} />
      <VisionSection t={c.sections.vision} />
      <SocialSection t={c.sections.socialBlock} />
      <FormSection form={c.form} social={c.social} telegram={c.telegram} />
      <FaqSection faq={c.faq} />
    </main>
  );
}