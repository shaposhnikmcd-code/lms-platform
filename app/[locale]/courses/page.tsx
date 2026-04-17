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
import BundleRowSync from "./_components/BundleRowSync";
import prisma from "@/lib/prisma";
import { COURSES_BY_SLUG } from "@/lib/coursesCatalog";
import { getCoursePriceOverrides } from "@/lib/coursePrice";

export const dynamic = "force-dynamic";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const coursesMeta = [
  { key: "psychology",     slug: "psychology-basics",                 href: "/courses/psychology-basics",                icon: "🧠", tagKey: "tags.biblicalTherapy",   accent: '#D4A843', accentRgb: '212,168,67' },
  { key: "psychiatry",     slug: "psychiatry-basics",                 href: "/courses/psychiatry-basics",                icon: "🩺", tagKey: "tags.forPsychologists",   accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "mentorship",     slug: "mentorship",                        href: "/courses/mentorship",                       icon: "🫂", tagKey: "tags.forBeginners",       accent: '#1C3A2E', accentRgb: '28,58,46' },
  { key: "biblicalHeroes", slug: "psychotherapy-of-biblical-heroes", href: "/courses/psychotherapy-of-biblical-heroes", icon: "📖", tagKey: "tags.newPerspective",     accent: '#C4919A', accentRgb: '196,145,154' },
  { key: "sexEd",          slug: "sex-education",                     href: "/courses/sex-education",                    icon: "👨‍👩‍👧", tagKey: "tags.forParents",         accent: '#D4A843', accentRgb: '212,168,67' },
  { key: "militaryPsy",    slug: "military-psychology",               href: "/courses/military-psychology",              icon: "🪖",   tagKey: "tags.forMilitary",        accent: '#1C3A2E', accentRgb: '28,58,46' },
  { key: "emotionalIQ",    slug: "emotional-intelligence",            href: "/courses/emotional-intelligence",           icon: "🧠",   tagKey: "tags.forEveryone",        accent: '#D4A843', accentRgb: '212,168,67' },
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

const COURSE_INFO: Record<string, { price: number; icon: string; accent: string; accentRgb: string; tagKey: string; descKey: string }> = Object.fromEntries(
  Object.entries(COURSES_BY_SLUG).map(([slug, c]) => [slug, {
    price: c.price,
    icon: c.icon,
    accent: c.accent,
    accentRgb: c.accentRgb,
    tagKey: c.tagKey,
    descKey: c.descKey,
  }])
);

const COURSE_TITLE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(COURSES_BY_SLUG).map(([slug, c]) => [slug, c.titleKey])
);

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("CoursesPage");
  const currency = getCurrency(locale);

  // Auto-resume suspended bundles whose resumeAt has passed
  await prisma.bundle.updateMany({
    where: {
      suspendedAt: { not: null },
      resumeAt: { not: null, lte: new Date() },
    },
    data: { suspendedAt: null, resumeAt: null },
  });

  const [bundles, priceOverrides] = await Promise.all([
    prisma.bundle.findMany({
      where: { published: true, suspendedAt: null },
      include: { courses: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    getCoursePriceOverrides(),
  ]);

  const benefits = [
    { icon: "🎓", title: t("benefits.record.title"), desc: t("benefits.record.desc") },
    { icon: "🤝", title: t("benefits.support.title"), desc: t("benefits.support.desc") },
    { icon: "📜", title: t("benefits.cert.title"), desc: t("benefits.cert.desc") },
  ];

  const cardBenefits = benefits.map(b => ({ icon: b.icon, title: b.title }));

  const getPrice = (slug: string, key: string) => {
    const override = priceOverrides.get(slug);
    if (override !== undefined) return String(override);
    return key === "psychology"        ? PSYCHOLOGY_COURSE.price
      : key === "psychiatry"     ? PSYCHIATRY_COURSE.price
      : key === "mentorship"     ? MENTORSHIP_COURSE.price
      : key === "biblicalHeroes" ? BIBLICAL_HEROES_COURSE.price
      : key === "sexEd"         ? SEX_EDUCATION_COURSE.price
      : key === "militaryPsy"    ? MILITARY_PSYCHOLOGY_COURSE.price
      : EMOTIONAL_INTELLIGENCE_COURSE.price;
  };

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
                    price={getPrice(c.slug, c.key)}
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
        <section className="pt-0 sm:pt-2 pb-10 sm:pb-12 px-2 sm:px-3 md:px-4" style={{ background: '#F5F2ED' }}>
          <div style={{ maxWidth: 1920, margin: '0 auto' }}>
            <div style={{ maxWidth: 860, margin: '0 auto 36px' }}>
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
            {(() => {
              const count = bundles.length;
              const layout = count === 1 ? 'full' as const : 'compact' as const;

              // Групування: за замовчуванням (displayMode !== 'auto' → 'solo') кожен пакет у своєму ряду.
              // Якщо displayMode === 'auto' — усі пакети з 'auto' йдуть в один спільний bucket
              // незалежно від ширини / типу; адмін сам вирішує, що з чим комбінувати.
              const widthKey = (b: typeof bundles[number]) => {
                if ((b as { displayMode?: string }).displayMode !== 'auto') return `solo:${b.id}`;
                return 'group';
              };

              const buckets = new Map<string, typeof bundles>();
              for (const b of bundles) {
                const k = widthKey(b);
                if (!buckets.has(k)) buckets.set(k, [] as typeof bundles);
                buckets.get(k)!.push(b);
              }

              // Порядок усередині bucket-у = порядок який прийшов з БД (вже відсортовано за sortOrder).
              // Таким чином drag-and-drop в адмінці керує порядком відображення.

              // Порядок bucket-ів: той чий перший пакет (за прийдним sortOrder) стоїть найраніше в списку — іде першим.
              // Тобто drag-and-drop в адмінці керує не тільки позицією всередині групи, а й порядком самих груп.
              const firstIndex = new Map<string, number>();
              bundles.forEach((b, i) => {
                const k = widthKey(b);
                if (!firstIndex.has(k)) firstIndex.set(k, i);
              });
              const sortedKeys = Array.from(buckets.keys()).sort(
                (a, b) => (firstIndex.get(a) ?? 0) - (firstIndex.get(b) ?? 0),
              );

              // Правило: максимум 2 пакети в ряду. Для N пакетів — двійки, останній (якщо непарне) соло.
              const buildRowSizes = (n: number): number[] => {
                if (n <= 2) return [n];
                const rows: number[] = [];
                let rem = n;
                while (rem >= 2) {
                  rows.push(2);
                  rem -= 2;
                }
                if (rem > 0) rows.push(1);
                return rows;
              };

              const rows: (typeof bundles)[] = [];
              for (const key of sortedKeys) {
                const group = buckets.get(key)!;
                const sizes = buildRowSizes(group.length);
                let offset = 0;
                for (const size of sizes) {
                  rows.push(group.slice(offset, offset + size));
                  offset += size;
                }
              }

              const renderBundle = (bundle: typeof bundles[number]) => {
                const mapCourse = (bc: typeof bundle.courses[number]) => {
                  const info = COURSE_INFO[bc.courseSlug];
                  const overridePrice = priceOverrides.get(bc.courseSlug);
                  return {
                    slug: bc.courseSlug,
                    title: t(COURSE_TITLE_KEYS[bc.courseSlug] as Parameters<typeof t>[0]) || bc.courseSlug,
                    description: info ? t(info.descKey as Parameters<typeof t>[0]) : '',
                    tag: info ? t(info.tagKey as Parameters<typeof t>[0]) : '',
                    price: overridePrice ?? info?.price ?? 0,
                    icon: info?.icon || '📚',
                    accent: info?.accent || '#D4A843',
                    accentRgb: info?.accentRgb || '212,168,67',
                  };
                };
                const paidCourses = bundle.courses.filter((c) => !c.isFree).map(mapCourse);
                const freeCourses = bundle.courses.filter((c) => c.isFree).map(mapCourse);
                return (
                  <BundleCard
                    key={bundle.id}
                    title={bundle.title}
                    price={bundle.price}
                    slug={bundle.slug}
                    layout={layout}
                    courses={paidCourses}
                    freeCourses={freeCourses}
                    bundleType={bundle.type}
                    freeCount={bundle.freeCount}
                    benefits={cardBenefits}
                    currency={currency}
                    priceLabel={t("bundlePriceLabel")}
                    bundleLabel={t("bundleBadge")}
                    saveLabel={t("bundleSave")}
                    buyLabel={t("bundleBuy")}
                  />
                );
              };

              // Натуральна ширина одного пакету (solo-стан). У 2-per-row групах
              // кожен пакет зберігає свою ширину — не стискається під сусіда.
              const nativeBundleWidth = (b: typeof bundles[number]): number => {
                const paid = b.courses.filter((c) => !c.isFree).length;
                const free = b.courses.filter((c) => c.isFree).length;
                if (b.type !== 'DISCOUNT' && free === 4) return 1200;
                if (paid <= 2 && free <= 2 && paid + free >= 2) return 625;
                return 730;
              };

              return (
                <div className="flex flex-col gap-10">
                  {rows.map((rowBundles, rowIdx) => (
                    <BundleRowSync
                      key={rowIdx}
                      className="flex flex-wrap gap-4 items-start justify-center"
                    >
                      {rowBundles.map((b) => (
                        <div
                          key={b.id}
                          style={{ width: nativeBundleWidth(b), flexShrink: 0 }}
                        >
                          {renderBundle(b)}
                        </div>
                      ))}
                    </BundleRowSync>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}
    </div>
  );
}