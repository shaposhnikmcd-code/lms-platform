import prisma from '@/lib/prisma';
import { getSalesPeriodRange, type SalesPeriod } from './admin-sales-analytics';

export type ProductSalesType = 'course' | 'cohort' | 'connector';

export type ProductSalesRow = {
  key: string;
  type: ProductSalesType;
  title: string;
  /// e.g. course slug, cohort start date — для другого рядка під назвою.
  subtitle?: string;
  count: number;
  sum: number;
};

export type ProductSalesData = {
  rows: ProductSalesRow[];
  totalCount: number;
  totalSum: number;
  rangeStart: Date;
  rangeEnd: Date;
  rangeLabel: string;
};

/// Підсумок продажів по продуктах за період.
/// — Курси: прямі покупки + частка від продажів пакетів (зважено по catalog price).
/// — Річна програма: 3 типи покупок (Річна / Місячна разова / Місячна автоплатіж), всі окремими рядками.
/// — Конектор: один рядок з агрегатом.
/// Тестові оплати ADMIN/MANAGER виключаються (як у chart-аналітиці).
export async function getSalesByProduct(period: SalesPeriod): Promise<ProductSalesData> {
  const { start, end, rangeLabel } = await getSalesPeriodRange(period);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'PAID',
      createdAt: { gte: start, lte: end },
      user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
    },
    select: {
      amount: true,
      courseId: true,
      bundleId: true,
      yearlyProgramSubscriptionId: true,
      freeSlugs: true,
      course: { select: { id: true, slug: true, title: true } },
      bundle: {
        select: {
          id: true,
          type: true,
          courses: { select: { courseSlug: true, isFree: true } },
        },
      },
      yearlyProgramSubscription: {
        select: {
          id: true,
          plan: true,
          autoRenew: true,
        },
      },
    },
  });

  /// Резолвимо ціни курсів-учасників пакетів — ваги для розподілу суми.
  const slugSet = new Set<string>();
  for (const p of payments) {
    if (p.bundle) for (const bc of p.bundle.courses) slugSet.add(bc.courseSlug);
  }
  const courseBySlug = new Map<string, { id: string; title: string; price: number; slug: string }>();
  if (slugSet.size) {
    const list = await prisma.course.findMany({
      where: { slug: { in: [...slugSet] } },
      select: { id: true, slug: true, title: true, price: true },
    });
    for (const c of list) {
      if (c.slug) courseBySlug.set(c.slug, { id: c.id, title: c.title, price: c.price, slug: c.slug });
    }
  }

  const courseAcc = new Map<string, { id: string; title: string; slug: string; count: number; sum: number }>();
  /// Річна програма — 3 типи покупок (за CLAUDE.md мапінгом Тип/Вид):
  ///   yearly        → «Річна підписка» (plan=YEARLY)
  ///   monthly_once  → «Місячна на 1 міс.» (plan=MONTHLY, autoRenew=false)
  ///   monthly_auto  → «Місячна Автоплатіж» (plan=MONTHLY, autoRenew=true)
  /// Рахуємо кожен PAID-платіж окремо (автоплатіж = N списань = N продажів).
  type YearlyVariant = 'yearly' | 'monthly_once' | 'monthly_auto';
  const yearlyAcc = new Map<YearlyVariant, { count: number; sum: number }>();

  function bumpCourse(id: string, title: string, slug: string, addSum: number, addCount: number) {
    const cur = courseAcc.get(id) ?? { id, title, slug, count: 0, sum: 0 };
    cur.sum += addSum;
    cur.count += addCount;
    courseAcc.set(id, cur);
  }

  for (const p of payments) {
    if (p.courseId && p.course) {
      bumpCourse(p.course.id, p.course.title, p.course.slug ?? '', p.amount, 1);
      continue;
    }
    if (p.bundleId && p.bundle) {
      /// Які курси з пакета увійшли в цю покупку:
      /// — DISCOUNT/FIXED_FREE: усі bundle.courses;
      /// — CHOICE_FREE: всі платні + ті isFree, що клієнт обрав (Payment.freeSlugs).
      const includedSlugs: { slug: string; isFree: boolean }[] = [];
      for (const bc of p.bundle.courses) {
        if (p.bundle.type === 'CHOICE_FREE') {
          if (!bc.isFree) includedSlugs.push({ slug: bc.courseSlug, isFree: false });
          else if (p.freeSlugs?.includes(bc.courseSlug)) includedSlugs.push({ slug: bc.courseSlug, isFree: true });
        } else {
          includedSlugs.push({ slug: bc.courseSlug, isFree: bc.isFree });
        }
      }
      const items = includedSlugs.map(i => {
        const c = courseBySlug.get(i.slug);
        /// Free-курси отримують вагу 0 (ділимо тільки серед платних).
        /// Якщо ВСІ курси у пакеті безкоштовні (рідкісний edge) — fallback на рівний розподіл.
        return { slug: i.slug, isFree: i.isFree, course: c, weight: i.isFree ? 0 : (c?.price ?? 0) };
      });
      const totalWeight = items.reduce((s, x) => s + x.weight, 0);
      for (const it of items) {
        if (!it.course) continue; // курс видалено / slug не знайдено — пропускаємо
        const share = totalWeight > 0
          ? p.amount * (it.weight / totalWeight)
          : p.amount / Math.max(items.length, 1);
        bumpCourse(it.course.id, it.course.title, it.slug, share, 1);
      }
      continue;
    }
    if (p.yearlyProgramSubscriptionId && p.yearlyProgramSubscription) {
      const sub = p.yearlyProgramSubscription;
      const variant: YearlyVariant =
        sub.plan === 'YEARLY'
          ? 'yearly'
          : sub.autoRenew
            ? 'monthly_auto'
            : 'monthly_once';
      const cur = yearlyAcc.get(variant) ?? { count: 0, sum: 0 };
      cur.sum += p.amount;
      cur.count += 1;
      yearlyAcc.set(variant, cur);
    }
  }

  /// Конектор — окремий агрегат.
  const connectorAgg = await prisma.connectorOrder.aggregate({
    where: {
      paymentStatus: 'PAID',
      amount: { gt: 1 },
      createdAt: { gte: start, lte: end },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const connectorCount = connectorAgg._count._all ?? 0;
  const connectorSum = connectorAgg._sum.amount ?? 0;

  const rows: ProductSalesRow[] = [];

  for (const c of courseAcc.values()) {
    rows.push({
      key: `course:${c.id}`,
      type: 'course',
      title: c.title,
      subtitle: c.slug || undefined,
      count: c.count,
      sum: Math.round(c.sum),
    });
  }
  const YEARLY_VARIANT_META: { variant: YearlyVariant; title: string; subtitle: string }[] = [
    { variant: 'yearly', title: 'Річна підписка', subtitle: 'Оплата за рік' },
    { variant: 'monthly_once', title: 'Місячна на 1 міс.', subtitle: 'Разова без автопродовження' },
    { variant: 'monthly_auto', title: 'Місячна Автоплатіж', subtitle: 'Щомісячне автосписання' },
  ];
  for (const meta of YEARLY_VARIANT_META) {
    const acc = yearlyAcc.get(meta.variant);
    if (!acc || acc.count === 0) continue;
    rows.push({
      key: `yearly:${meta.variant}`,
      type: 'cohort',
      title: meta.title,
      subtitle: meta.subtitle,
      count: acc.count,
      sum: acc.sum,
    });
  }
  if (connectorCount > 0) {
    rows.push({
      key: 'connector',
      type: 'connector',
      title: 'Гра Конектор',
      count: connectorCount,
      sum: connectorSum,
    });
  }

  // Усі типи Річної програми (cohort) йдуть разом першими (позиції 1-3), решта —
  // по сумі. Всередині кожної групи сортуємо за сумою (спадання).
  rows.sort((a, b) => {
    const aCohort = a.type === 'cohort' ? 0 : 1;
    const bCohort = b.type === 'cohort' ? 0 : 1;
    if (aCohort !== bCohort) return aCohort - bCohort;
    return b.sum - a.sum;
  });

  const totalSum = rows.reduce((s, r) => s + r.sum, 0);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  return { rows, totalCount, totalSum, rangeStart: start, rangeEnd: end, rangeLabel };
}
