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
const getContent = getTranslatedContent(contactsContent, "contacts-page");

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', fontFamily: sysFont }}>
      <HeroSection />
      <TeamSection />
      <StorySection />
      <SolutionSection />
      <MissionBlock />
      <RequestsSection />
      <VisionSection />
      <SocialSection />
      <FormSection form={c.form} social={c.social} telegram={c.telegram} />
      <FaqSection faq={c.faq} />
    </main>
  );
}