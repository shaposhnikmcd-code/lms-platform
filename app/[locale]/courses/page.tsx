import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PSYCHIATRY_COURSE } from "./psychiatry-basics/config";
import { PSYCHOLOGY_COURSE } from "./psychology-basics/config";
import { MENTORSHIP_COURSE } from "./mentorship/config";
import { BIBLICAL_HEROES_COURSE } from "./psychotherapy-of-biblical-heroes/config";
import { SEX_EDUCATION_COURSE } from "./sex-education/config";
import { MILITARY_PSYCHOLOGY_COURSE } from "./military-psychology/config";
import { EMOTIONAL_INTELLIGENCE_COURSE } from "./emotional-intelligence/config";
import { getCurrency } from "@/lib/currency";
import CourseCard from "./_components/CourseCard";
import BundleCard from "./_components/BundleCard";
import prisma from "@/lib/prisma";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const coursesMeta = [
  { key: "psychology",     price: null, href: "/courses/psychology-basics",                icon: "🧠", tagKey: "tags.biblicalTherapy",   accent: '#D4A843', accentRgb: '212,168,67' },
  { key: "psychiatry",     price: null, href: "/courses/psychiatry-basics",                icon: "🩺", tagKey: "tags.forPsychologists",   accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "mentorship",     price: null, href: "/courses/mentorship",                       icon: "🫂", tagKey: "tags.forBeginners",       accent: '#1C3A2E', accentRgb: '28,58,46' },
  { key: "biblicalHeroes", price: null, href: "/courses/psychotherapy-of-biblical-heroes", icon: "📖", tagKey: "tags.newPerspective",     accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "sexEd",          price: null, href: "/courses/sex-education",                    icon: "👨‍👩‍👧", tagKey: "tags.forParents",         accent: '#D4A843', accentRgb: '212,168,67' },
  { key: "militaryPsy",   price: null, href: "/courses/military-psychology",               icon: "🪖",   tagKey: "tags.forMilitary",        accent: '#1C3A2E', accentRgb: '28,58,46' },
  { key: "emotionalIQ",  price: null, href: "/courses/emotional-intelligence",            icon: "🧠",   tagKey: "tags.forEveryone",        accent: '#D4A843', accentRgb: '212,168,67' },
];

const cardLayouts: { width: string; marginLeft: string; className: string }[] = [
  { width: '100%', marginLeft: '0',    className: '' },
  { width: '88%',  marginLeft: 'auto', className: 'sm:w-[88%] sm:ml-auto' },
  { width: '94%',  marginLeft: '0',    className: 'sm:w-[94%]' },
  { width: '90%',  marginLeft: 'auto', className: 'sm:w-[90%] sm:ml-auto' },
  { width: '96%',  marginLeft: '0',    className: 'sm:w-[96%]' },
  { width: '92%',  marginLeft: 'auto', className: 'sm:w-[92%] sm:ml-auto' },
  { width: '100%', marginLeft: '0',    className: '' },
];

const COURSE_INFO: Record<string, { price: number; icon: string; accent: string; accentRgb: string; tagKey: string; descKey: string }> = {
  'psychology-basics': { price: 3500, icon: '🧠', accent: '#D4A843', accentRgb: '212,168,67', tagKey: 'tags.biblicalTherapy', descKey: 'courses.psychology.description' },
  'psychiatry-basics': { price: 3500, icon: '🩺', accent: '#C4919A', accentRgb: '196,145,154', tagKey: 'tags.forPsychologists', descKey: 'courses.psychiatry.description' },
  'mentorship': { price: 3500, icon: '🫂', accent: '#1C3A2E', accentRgb: '28,58,46', tagKey: 'tags.forBeginners', descKey: 'courses.mentorship.description' },
  'psychotherapy-of-biblical-heroes': { price: 1400, icon: '📖', accent: '#C4919A', accentRgb: '196,145,154', tagKey: 'tags.newPerspective', descKey: 'courses.biblicalHeroes.description' },
  'sex-education': { price: 4300, icon: '👨‍👩‍👧', accent: '#D4A843', accentRgb: '212,168,67', tagKey: 'tags.forParents', descKey: 'courses.sexEd.description' },
  'military-psychology': { price: 5999, icon: '🪖', accent: '#1C3A2E', accentRgb: '28,58,46', tagKey: 'tags.forMilitary', descKey: 'courses.militaryPsy.description' },
  'emotional-intelligence': { price: 1499, icon: '🧠', accent: '#D4A843', accentRgb: '212,168,67', tagKey: 'tags.forEveryone', descKey: 'courses.emotionalIQ.description' },
};

const COURSE_TITLE_KEYS: Record<string, string> = {
  'psychology-basics': 'courses.psychology.title',
  'psychiatry-basics': 'courses.psychiatry.title',
  'mentorship': 'courses.mentorship.title',
  'psychotherapy-of-biblical-heroes': 'courses.biblicalHeroes.title',
  'sex-education': 'courses.sexEd.title',
  'military-psychology': 'courses.militaryPsy.title',
  'emotional-intelligence': 'courses.emotionalIQ.title',
};

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("CoursesPage");
  const currency = getCurrency(locale);

  const bundles = await prisma.bundle.findMany({
    where: { published: true },
    include: { courses: true },
    orderBy: { createdAt: 'desc' },
  });

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
    : key === "sexEd"         ? SEX_EDUCATION_COURSE.price
    : key === "militaryPsy"    ? MILITARY_PSYCHOLOGY_COURSE.price
    : EMOTIONAL_INTELLIGENCE_COURSE.price
  );

  return (
    <div style={{ background: '#F5F2ED', minHeight: '100vh' }}>

      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', paddingTop: 52, paddingBottom: 48, position: 'relative', overflow: 'hidden' }}>
        <div className="container mx-auto px-4 sm:px-8 md:px-16 relative z-10">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.12)', borderRadius: 100, padding: '5px 16px', marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>{"UIMP"}</span>
              </div>
              <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
                {t("title")}
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.75, margin: 0, fontFamily: sysFont }}>
                {t("subtitle")}
              </p>
            </div>
            <div className="hidden md:flex" style={{ flex: 1, justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.2, background: 'radial-gradient(circle, #D4A843, #1C3A2E)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', width: 208, height: 208 }}>
                  <Image src="/logo-white.png" alt="UIMP" width={208} height={208} style={{ display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14 px-4 sm:px-8 md:px-12">
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' }}>
              {t("sectionTitle")}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {coursesMeta.map((c, i) => {
              const layout = cardLayouts[i];
              return (
                <div key={c.key} className={`w-full ${layout.className}`}>
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
        </div>
      </section>

      {bundles.length > 0 && (
        <section className="py-4 sm:py-6 px-4 sm:px-8 md:px-12" style={{ background: '#F5F2ED' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 100, padding: '4px 14px', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
                  {t("bundleBadge")}
                </span>
              </div>
              <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' }}>
                {t("bundlesTitle")}
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(28,58,46,0.5)', marginTop: 8, fontFamily: sysFont }}>
                {t("bundlesSubtitle")}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              {bundles.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  title={bundle.title}
                  description={bundle.description || undefined}
                  price={bundle.price}
                  slug={bundle.slug}
                  courses={bundle.courses.map((bc) => {
                    const info = COURSE_INFO[bc.courseSlug];
                    return {
                      slug: bc.courseSlug,
                      title: t(COURSE_TITLE_KEYS[bc.courseSlug] as Parameters<typeof t>[0]) || bc.courseSlug,
                      description: info ? t(info.descKey as Parameters<typeof t>[0]) : '',
                      tag: info ? t(info.tagKey as Parameters<typeof t>[0]) : '',
                      price: info?.price || 0,
                      icon: info?.icon || '📚',
                      accent: info?.accent || '#D4A843',
                      accentRgb: info?.accentRgb || '212,168,67',
                    };
                  })}
                  benefits={cardBenefits}
                  currency={currency}
                  priceLabel={t("bundlePriceLabel")}
                  bundleLabel={t("bundleBadge")}
                  saveLabel={t("bundleSave")}
                  buyLabel={t("bundleBuy")}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}