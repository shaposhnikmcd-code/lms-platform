import { getTranslations } from "next-intl/server";
import CharityCard from "@/app/[locale]/courses/_components/CharityCard";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const zhytyUrl = "https://t.me/zhyty_chysto_2_bot";

export default async function CharityPage() {
  const t = await getTranslations("CoursesPage");

  return (
    <div style={{ background: '#FAF6F0', minHeight: '100vh', fontFamily: sysFont }}>

      {/* HERO */}
      <section style={{ background: '#1C3A2E', padding: '80px 48px 88px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -80, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(212,168,67,0.3)', background: 'rgba(212,168,67,0.1)', borderRadius: 100, padding: '6px 18px', marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A843' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
              {"Безкоштовно"}
            </span>
          </div>

          <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 700, color: '#F5EDD6', lineHeight: 1.08, letterSpacing: '-0.025em', margin: '0 0 24px', maxWidth: 680 }}>
            {"Благодійні проєкти"}
          </h1>

          <p style={{ fontSize: 17, color: 'rgba(245,237,214,0.5)', maxWidth: 500, lineHeight: 1.8, margin: 0, fontFamily: sysFont }}>
            {"Курси, які ми надаємо безкоштовно для всіх охочих — бо деякі знання мають бути доступні кожному."}
          </p>

        </div>
      </section>

      {/* КУРСИ */}
      <section style={{ padding: '72px 48px 96px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ height: 1, width: 32, background: '#D4A843', opacity: 0.5 }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
                {"Програми"}
              </span>
            </div>
            <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' }}>
              {"Оберіть курс"}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <CharityCard
              href="/courses/psychological-support"
              accent="#D4A843"
              accentRgb="212,168,67"
              icon="🤝"
              title={t("courses.support.title")}
              description={t("courses.support.description")}
              price={t("courses.support.price")}
              duration={t("courses.support.duration")}
              freeLabel={t("free")}
              index={0}
            />
            <CharityCard
              href={zhytyUrl}
              isExternal
              accent="#D4A843"
              accentRgb="212,168,67"
              imageSrc="/courses/zhyty-chysto.jpg"
              title={t("courses.porn.title")}
              description={t("courses.porn.description")}
              price={t("courses.porn.price")}
              duration={t("courses.porn.duration")}
              freeLabel={t("free")}
              index={1}
            />
          </div>

        </div>
      </section>
    </div>
  );
}