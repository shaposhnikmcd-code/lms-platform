import prisma from '@/lib/prisma';
import { getTranslations, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { COURSES_BY_SLUG } from '@/lib/coursesCatalog';
import BundlesView, { type BundleRowData, type BundleType, type MiniatureCourse } from './_components/BundlesView';

export default async function AdminBundles() {
  const [bundles, courses, t, messages] = await Promise.all([
    prisma.bundle.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { courses: true },
    }),
    prisma.course.findMany({
      select: { id: true, slug: true, title: true, price: true },
    }),
    getTranslations({ locale: 'uk', namespace: 'CoursesPage' }),
    getMessages({ locale: 'uk' }),
  ]);

  const COURSE_TITLES: Record<string, string> = {};
  const COURSE_PRICES: Record<string, number> = {};
  for (const c of courses) {
    const key = c.slug ?? c.id;
    COURSE_TITLES[key] = c.title;
    COURSE_PRICES[key] = c.price;
  }

  // Дані для міні-рендеру BundleCard (Row View в адмінці)
  const toMiniature = (slug: string, overridePrice?: number): MiniatureCourse | null => {
    const info = COURSES_BY_SLUG[slug];
    if (!info) return null;
    let title = COURSE_TITLES[slug] || info.titleUk || slug;
    let description = info.titleUk;
    let tag = info.titleUk;
    try { title = t(info.titleKey as Parameters<typeof t>[0]) || title; } catch {}
    try { description = t(info.descKey as Parameters<typeof t>[0]) || description; } catch {}
    try { tag = t(info.tagKey as Parameters<typeof t>[0]) || tag; } catch {}
    return {
      slug,
      title,
      description,
      tag,
      price: overridePrice ?? info.price,
      icon: info.icon,
      accent: info.accent,
      accentRgb: info.accentRgb,
    };
  };

  const rows: BundleRowData[] = bundles.map(bundle => {
    const type = ((bundle as { type?: string }).type ?? 'DISCOUNT') as BundleType;
    const paidSum = bundle.courses
      .filter(bc => !bc.isFree)
      .reduce((sum, bc) => sum + (COURSE_PRICES[bc.courseSlug] || 0), 0);
    const freePrices = bundle.courses
      .filter(bc => bc.isFree)
      .map(bc => COURSE_PRICES[bc.courseSlug] || 0)
      .sort((a, b) => b - a);
    const freeTake =
      type === 'CHOICE_FREE' ? Math.min(bundle.freeCount || 1, freePrices.length) : freePrices.length;
    const freeSum = freePrices.slice(0, freeTake).reduce((sum, p) => sum + p, 0);
    const fullPrice = paidSum + freeSum;
    const difference = fullPrice - bundle.price;
    const discountPct =
      difference > 0 && fullPrice > 0 ? Math.round((difference / fullPrice) * 100) : 0;

    return {
      id: bundle.id,
      title: bundle.title,
      type,
      price: bundle.price,
      fullPrice,
      difference,
      discountPct,
      isPublished: bundle.published,
      isSuspended: !!bundle.suspendedAt,
      suspendedAt: bundle.suspendedAt?.toISOString() ?? null,
      resumeAt: bundle.resumeAt?.toISOString() ?? null,
      displayMode: ((bundle as { displayMode?: string }).displayMode === 'solo' ? 'solo' : 'auto') as 'auto' | 'solo',
      pickN: bundle.freeCount,
      courses: bundle.courses.map(bc => ({
        id: bc.id,
        courseSlug: bc.courseSlug,
        title: COURSE_TITLES[bc.courseSlug] || bc.courseSlug,
        isFree: bc.isFree,
      })),
      miniaturePaid: bundle.courses.filter(bc => !bc.isFree)
        .map(bc => toMiniature(bc.courseSlug))
        .filter((x): x is MiniatureCourse => !!x),
      miniatureFree: bundle.courses.filter(bc => bc.isFree)
        .map(bc => toMiniature(bc.courseSlug))
        .filter((x): x is MiniatureCourse => !!x),
    };
  });

  return (
    <NextIntlClientProvider locale="uk" messages={messages}>
      <BundlesView bundles={rows} />
    </NextIntlClientProvider>
  );
}
