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
  { key: "sexEd",          price: null, href: "/courses/sex-education",                    icon: "👨‍👩‍👧", tagKey: "tags.forParents",         accent: '#D4A843', accentRgb: '212,168,67' },
];

const cardLayouts: { width: string; marginLeft: string }[] = [
  { width: '100%', marginLeft: '0' },
  { width: '88%',  marginLeft: 'auto' },
  { width: '94%',  marginLeft: '0' },
  { width: '90%',  marginLeft: 'auto' },
  { width: '96%',  marginLeft: '0' },
];

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("CoursesPage");
  const currency = getCurrency(locale);

  const benefits = [
    { icon: "🎓", title: t("benefits.record.title"), desc: t("benefits.record.desc") },
    { icon: "🤝", title: t("benefits.support.title"), desc: t("benefits.support.desc") },
    { icon: "📜", title: t("benefits.cert.title"), desc: t("benefits.cert.desc") },
  ];

  const cardBenefits = benefits.map(b => ({ icon: b.icon, title: b.title }));

  const getPrice = (key: string, override: string | null) => override ?? (
    key === "psychology"        ? PSYCHOLOGY_COURSE.price
    : key === "psychiatry"     ? PSYCHIATRY_COURSE.price
    : key === "mentorship"     ? MENTORSHIP_COURSE.price
    : key === "biblicalHeroes" ? BIBLICAL_HEROES_COURSE.price
    : SEX_EDUCATION_COURSE.price
  );

  return (
    <div style={{ background: '#F5F2ED', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{ background: '#1C3A2E', padding: '52px 48px 48px' }}>
        <div style={{ maxWidth: 1200, marginLeft: 0, marginRight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ paddingLeft: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.12)', borderRadius: 100, padding: '5px 16px', marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: '-apple-system, sans-serif' }}>
                {"UIMP"}
              </span>
            </div>
            <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.75, margin: 0, fontFamily: '-apple-system, sans-serif' }}>
              {t("subtitle")}
            </p>
          </div>
          <div style={{ flexShrink: 0, marginRight: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="UIMP" width={164} height={164} style={{ display: 'block', borderRadius: 12 }} />
          </div>
        </div>
      </section>

      {/* ── КУРСИ + БЛАГОДІЙНІ (єдина секція) ── */}
      <section style={{ padding: '56px 48px 80px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Заголовок платних */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 400, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' }}>
              {t("sectionTitle")}
            </h2>
          </div>

          {/* Платні курси */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 56 }}>
            {coursesMeta.map((c, i) => {
              const layout = cardLayouts[i];
              return (
                <div key={c.key} style={{ width: layout.width, marginLeft: layout.marginLeft, marginRight: layout.marginLeft === 'auto' ? '0' : undefined }}>
                  <CourseCard
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
                    index={i}
                    benefits={cardBenefits}
                  />
                </div>
              );
            })}
          </div>

          {/* ── Роздільник ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(28,58,46,0.1)' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 100, padding: '5px 14px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A843' }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: '-apple-system, sans-serif' }}>
                {"Безкоштовно"}
              </span>
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(28,58,46,0.1)' }} />
          </div>

          {/* Заголовок благодійних */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 400, color: '#1C3A2E', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {t("charityTitle")}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(28,58,46,0.45)', margin: 0, lineHeight: 1.7, fontFamily: '-apple-system, sans-serif' }}>
              {t("charitySubtitle")}
            </p>
          </div>

          {/* Благодійні картки */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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