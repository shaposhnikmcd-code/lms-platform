import { getTranslations } from "next-intl/server";
import CharityCard from "@/app/[locale]/courses/_components/CharityCard";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const zhytyUrl = "https://t.me/zhyty_chysto_2_bot";

export default async function CharityPage() {
  const t = await getTranslations("CoursesPage");

  return (
    <div style={{ background: '#FAF6F0', minHeight: '100vh', fontFamily: sysFont }}>

      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', paddingTop: 52, paddingBottom: 48, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, borderRadius: '50%', backgroundColor: 'rgba(212,168,67,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div className="container mx-auto px-4 sm:px-8 md:px-16 relative z-10">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.12)', borderRadius: 100, padding: '5px 16px', marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>{"UIMP"}</span>
              </div>
              <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#F5EDD6', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
                {"Благодійні проєкти"}
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.75, margin: 0, fontFamily: sysFont }}>
                {"Курси, які ми надаємо безкоштовно для всіх охочих"}
              </p>
            </div>

            <div className="hidden md:flex" style={{ flex: 1, justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.2, background: 'radial-gradient(circle, #D4A843, #1C3A2E)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', width: 208, height: 208 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-white.png" alt="UIMP" width={208} height={208} style={{ display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="py-14 px-4 sm:px-8 md:px-12">
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ height: 1, width: 32, background: '#D4A843', opacity: 0.5 }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>{"Програми"}</span>
            </div>
            <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' }}>
              {"Оберіть курс"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CharityCard
              href="/courses/psychological-support"
              accent="#D4A843" accentRgb="212,168,67" icon="🤝"
              title={t("courses.support.title")} description={t("courses.support.description")}
              price={t("courses.support.price")} duration={t("courses.support.duration")}
              freeLabel={t("free")} index={0}
            />
            <CharityCard
              href={zhytyUrl} isExternal
              accent="#D4A843" accentRgb="212,168,67" imageSrc="/courses/zhyty-chysto.jpg"
              title={t("courses.porn.title")} description={t("courses.porn.description")}
              price={t("courses.porn.price")} duration={t("courses.porn.duration")}
              freeLabel={t("free")} index={1}
            />
          </div>
        </div>
      </section>
    </div>
  );
}