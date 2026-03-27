import { consultationsContent } from "./_content/uk";
import { getTranslatedContent } from "@/lib/translate";
import SpecialistCard from "./_components/SpecialistCard";
import NotionButton from "./_components/NotionButton";

const getContent = getTranslatedContent(consultationsContent, 'consultations-page');

export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-[#f4f9f4]">
      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)' }} className="text-white py-20">
        <div className="container mx-auto px-12 md:px-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[#D4A843]/20 border border-[#D4A843]/30 text-[#D4A843] text-sm font-semibold px-5 py-2 rounded-full mb-6 tracking-wide uppercase">
            {"◆"} {c.hero.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">{c.hero.title}</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">{c.hero.subtitle}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        {c.specialists.map((s, i) => (
          <SpecialistCard key={i} s={s} labels={{ aboutTitle: c.aboutTitle, worksWithTitle: c.worksWithTitle, diplomasLabel: c.diplomasLabel, costLabel: c.costLabel, durationLabel: c.durationLabel, btnBook: c.btnBook }} />
        ))}
        <NotionButton />
      </div>
    </main>
  );
}