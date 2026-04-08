import { consultationsContent } from "./_content/uk";
import { getTranslatedContent } from "@/lib/translate";
import SpecialistCard from "./_components/SpecialistCard";
import NotionButton from "./_components/NotionButton";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const getContent = getTranslatedContent(consultationsContent, 'consultations-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-[#f4f9f4]">
      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', paddingTop: 52, paddingBottom: 48, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, borderRadius: '50%', backgroundColor: 'rgba(212,168,67,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div className="container mx-auto px-4 sm:px-8 md:px-16 relative z-10">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.12)', borderRadius: 100, padding: '5px 16px', marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>{"UIMP"}</span>
              </div>
              <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
                {c.hero.title}
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.75, margin: 0, fontFamily: sysFont }}>
                {c.hero.subtitle}
              </p>
            </div>

            <div className="hidden md:flex" style={{ flex: 1, justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.2, background: 'radial-gradient(circle, #D4A843, #1C3A2E)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', width: 208, height: 208 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/about-us/logo-yellow.webp" alt="UIMP" width={208} height={208} style={{ display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
        {c.specialists.map((s, i) => (
          <SpecialistCard key={i} s={s} labels={{ aboutTitle: c.aboutTitle, worksWithTitle: c.worksWithTitle, diplomasLabel: c.diplomasLabel, educationTitle: c.educationTitle, certificatesTitle: c.certificatesTitle, associationsLabel: c.associationsLabel, costLabel: c.costLabel, durationLabel: c.durationLabel, btnBook: c.btnBook }} />
        ))}
        <NotionButton label={c.notionBtn} />
      </div>
    </main>
  );
}