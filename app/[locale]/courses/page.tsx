import { getTranslations } from "next-intl/server";
import { PSYCHIATRY_COURSE } from "./psychiatry-basics/config";
import { PSYCHOLOGY_COURSE } from "./psychology-basics/config";
import { MENTORSHIP_COURSE } from "./mentorship/config";
import { BIBLICAL_HEROES_COURSE } from "./psychotherapy-of-biblical-heroes/config";
import { SEX_EDUCATION_COURSE } from "./sex-education/config";
import { getCurrency } from "@/lib/currency";
import CourseCard from "./_components/CourseCard";
import CharityCard from "./_components/CharityCard";

const zhytyUrl = "https://t.me/zhyty_chysto_2_bot";

const coursesMeta = [
  { key: "psychology",     price: null, href: "/courses/psychology-basics",                icon: "🧠", tagKey: "tags.biblicalTherapy",   accent: '#D4A843', accentRgb: '212,168,67' },
  { key: "psychiatry",     price: null, href: "/courses/psychiatry-basics",                icon: "🩺", tagKey: "tags.forPsychologists",   accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "mentorship",     price: null, href: "/courses/mentorship",                       icon: "🫂", tagKey: "tags.forBeginners",       accent: '#1C3A2E', accentRgb: '28,58,46' },
  { key: "biblicalHeroes", price: null, href: "/courses/psychotherapy-of-biblical-heroes", icon: "📖", tagKey: "tags.newPerspective",     accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "sexEd",          price: null, href: "/courses/sex-education",                   icon: "👨‍👩‍👧", tagKey: "tags.forParents",          accent: '#D4A843', accentRgb: '212,168,67' },
];

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("CoursesPage");
  const currency = getCurrency(locale);

  const benefits = [
    { icon: "🎓", title: t("benefits.record.title"),  desc: t("benefits.record.desc") },
    { icon: "🤝", title: t("benefits.support.title"), desc: t("benefits.support.desc") },
    { icon: "📜", title: t("benefits.cert.title"),    desc: t("benefits.cert.desc") },
  ];

  const getPrice = (key: string, override: string | null) => override ?? (
    key === "psychology"       ? PSYCHOLOGY_COURSE.price
    : key === "psychiatry"    ? PSYCHIATRY_COURSE.price
    : key === "mentorship"    ? MENTORSHIP_COURSE.price
    : key === "biblicalHeroes"? BIBLICAL_HEROES_COURSE.price
    : SEX_EDUCATION_COURSE.price
  );

  return (
    <div className="min-h-screen">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(170deg, #1C3A2E 0%, #163224 55%, #0f2419 100%)', padding: '140px 24px 120px' }}
      >
        {/* dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        {/* top gold line */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 }} />
        {/* bottom gold line */}
        <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 }} />
        {/* glow */}
        <div className="absolute pointer-events-none" style={{ top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(212,168,67,0.07) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div className="relative z-10 text-center" style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* badge */}
          <div className="inline-flex items-center gap-3 mb-12" style={{ padding: '7px 22px', borderRadius: 100, border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.06)' }}>
            <div style={{ width: 20, height: 1, background: '#D4A843', opacity: 0.6 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: '#D4A843' }}>{"UIMP"}</span>
            <div style={{ width: 20, height: 1, background: '#D4A843', opacity: 0.6 }} />
          </div>

          {/* title */}
          <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(52px, 9vw, 108px)', fontWeight: 400, color: 'white', lineHeight: 1, letterSpacing: '-0.02em', margin: '0 0 36px' }}>
            {t("title")}
          </h1>

          {/* ornament */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <div style={{ flex: 1, maxWidth: 100, height: 1, background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.5))' }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A843', opacity: 0.8 }} />
            <div style={{ width: 32, height: 1, background: 'rgba(212,168,67,0.35)' }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4919A', opacity: 0.8 }} />
            <div style={{ width: 32, height: 1, background: 'rgba(212,168,67,0.35)' }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A843', opacity: 0.8 }} />
            <div style={{ flex: 1, maxWidth: 100, height: 1, background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.5))' }} />
          </div>

          {/* subtitle */}
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', maxWidth: 420, margin: '0 auto', lineHeight: 1.8, fontWeight: 300 }}>
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* ── КУРСИ ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: '#FAF6F0', padding: '100px 24px 48px' }}>
        {/* top divider */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.4 }} />

        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* section header */}
          <div style={{ marginBottom: 64, textAlign: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase' as const, color: '#D4A843', display: 'block', marginBottom: 16 }}>
              {t("sectionLabel")}
            </span>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, color: '#1C3A2E', margin: '0 0 22px', letterSpacing: '-0.01em' }}>
              {t("sectionTitle")}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div style={{ width: 48, height: 1, background: 'rgba(212,168,67,0.4)' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A843', opacity: 0.7 }} />
              <div style={{ width: 48, height: 1, background: 'rgba(212,168,67,0.4)' }} />
            </div>
          </div>

          {/* top 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginBottom: 24 }}>
            {coursesMeta.slice(0, 3).map((c) => (
              <CourseCard
                key={c.key}
                href={c.href}
                accent={c.accent}
                accentRgb={c.accentRgb}
                tag={t(c.tagKey as any)}
                icon={c.icon}
                title={t(`courses.${c.key}.title` as any)}
                description={t(`courses.${c.key}.description` as any)}
                price={getPrice(c.key, c.price)}
                duration={t(`courses.${c.key}.duration` as any)}
                currency={currency}
                priceLabel={t("priceLabel")}
              />
            ))}
          </div>

          {/* bottom 2 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 728, margin: '0 auto 0' }}>
            {coursesMeta.slice(3).map((c) => (
              <CourseCard
                key={c.key}
                href={c.href}
                accent={c.accent}
                accentRgb={c.accentRgb}
                tag={t(c.tagKey as any)}
                icon={c.icon}
                title={t(`courses.${c.key}.title` as any)}
                description={t(`courses.${c.key}.description` as any)}
                price={getPrice(c.key, c.price)}
                duration={t(`courses.${c.key}.duration` as any)}
                currency={currency}
                priceLabel={t("priceLabel")}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── ПЕРЕВАГИ (під курсами) ─────────────────────────── */}
      <section style={{ background: '#FAF6F0', padding: '48px 24px 100px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* thin separator above benefits */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.3))' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: 'rgba(28,58,46,0.3)' }}>{"Що входить у навчання"}</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.3))' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="flex items-start gap-4"
                style={{ background: 'white', border: '1px solid rgba(28,58,46,0.07)', borderRadius: 16, padding: '28px 28px', position: 'relative', overflow: 'hidden' }}
              >
                {/* accent left bar */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: i === 1 ? '#C4919A' : '#D4A843', borderRadius: '12px 0 0 12px' }} />
                <div style={{ width: 48, height: 48, borderRadius: 14, background: i === 1 ? 'rgba(196,145,154,0.1)' : 'rgba(212,168,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {b.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1C3A2E', margin: '0 0 5px' }}>{b.title}</p>
                  <p style={{ fontSize: 12, color: 'rgba(28,58,46,0.45)', margin: 0, lineHeight: 1.6 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── БЛАГОДІЙНІ ────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: '#E8F5E0', padding: '100px 24px 108px' }}>
        {/* top divider */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.4 }} />
        {/* bottom divider */}
        <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.4 }} />

        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(196,145,154,0.15)', border: '1px solid rgba(196,145,154,0.3)', borderRadius: 100, padding: '7px 22px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: '#9a6570' }}>{"🎁"} {t("charityBadge")}</span>
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#1C3A2E', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              {t("charityTitle")}
            </h2>
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: 14 }}>
              <div style={{ width: 40, height: 1, background: 'rgba(196,145,154,0.5)' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4919A', opacity: 0.7 }} />
              <div style={{ width: 40, height: 1, background: 'rgba(196,145,154,0.5)' }} />
            </div>
            <p style={{ fontSize: 14, color: 'rgba(28,58,46,0.5)', margin: 0, fontWeight: 300 }}>{t("charitySubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CharityCard
              href="/courses/psychological-support"
              accent="#1C3A2E"
              accentRgb="28,58,46"
              icon="🤝"
              title={t("courses.support.title")}
              description={t("courses.support.description")}
              price={t("courses.support.price")}
              duration={t("courses.support.duration")}
              freeLabel={t("free")}
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
            />
          </div>
        </div>
      </section>

    </div>
  );
}