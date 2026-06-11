import prisma from '@/lib/prisma';

/// Series продажів для адмін-дашборду. Працюємо в часовій зоні Europe/Kyiv,
/// інакше платежі біля півночі потраплятимуть у "не той" календарний день/місяць.

export type SalesPeriod = '30d' | '1m' | '3m' | '6m' | '1y' | 'all';
export type CategoryKey = 'courses' | 'bundles' | 'yearly' | 'connector';
export type Granularity = 'day' | 'week' | 'month';

export type SalesBucket = {
  /// ISO key (YYYY-MM-DD для day/week, YYYY-MM для month) — стабільний id для recharts.
  key: string;
  /// Що показуємо на осі X (e.g. "12", "8 кв", "Кві").
  label: string;
  courses: number;
  bundles: number;
  yearly: number;
  connector: number;
  /// Підсумок за тиждень — заповнено лише на останньому дні тижня (нд) у denominacji 'day'.
  /// Використовується як ненав'язлива анотація над лінією на місячному графіку.
  weekTotal?: number;
};

export type SalesKpi = { count: number; sum: number; avg: number };

export type SalesKpiBuckets = {
  courses: SalesKpi;
  bundles: SalesKpi;
  yearlyYearly: SalesKpi;
  yearlyMonthlyOnce: SalesKpi;
  yearlyMonthlyAuto: SalesKpi;
  connector: SalesKpi;
};

export type SalesInsight = {
  /// Найкращий день/тиждень/місяць (залежно від granularity) — для callout-карток.
  bestBucketKey: string | null;
  bestBucketLabel: string | null;
  bestBucketValue: number;
  bestWeekNum: number | null;
  bestWeekLabel: string | null;
  bestWeekValue: number;
};

export type SalesSeries = {
  granularity: Granularity;
  buckets: SalesBucket[];
  totals: { courses: number; bundles: number; yearly: number; connector: number; all: number };
  kpi: SalesKpiBuckets;
  rangeStart: Date;
  rangeEnd: Date;
  /// Людський опис діапазону для шапки картки ("1 кві – 30 кві").
  rangeLabel: string;
  /// Сума за попередній період такого ж розміру (для % порівняння hero-метрики).
  previousTotal: number;
  previousLabel: string;
  /// Підпис поточного періоду для порівняння (напр. "Останні 30 днів").
  currentLabel: string;
  insights: SalesInsight;
};

const TZ = 'Europe/Kyiv';

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

function tzParts(d: Date) {
  const parts = PARTS.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'), /// 'Mon', 'Tue', …
  };
}

/// Конструюємо UTC-instant, який у TZ Europe/Kyiv є 00:00 заданої дати.
/// Для UTC+2/+3 це 22:00 / 21:00 попереднього дня UTC. Завдяки цьому всі бакети
/// мають консистентні межі, незалежно від літнього/зимового часу.
function kyivStartOfDay(year: number, month: number, day: number): Date {
  /// Беремо приблизний UTC-instant того ж календарного моменту, рахуємо реальне
  /// TZ-зміщення Києва у цей день і повертаємось до точного UTC-часу 00:00 Київ.
  const approx = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMin = kyivOffsetMinutes(approx);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMin * 60_000);
}

function kyivOffsetMinutes(d: Date): number {
  /// Diff між тим, що бачить Kyiv, і UTC у мс / 60_000.
  const kyivStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
  /// kyivStr приклад: "04/29/2026, 14:35:00"
  const m = kyivStr.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const [, mo, da, yr, hh, mi, ss] = m;
  const asIfUtc = Date.UTC(Number(yr), Number(mo) - 1, Number(da), Number(hh), Number(mi), Number(ss));
  return Math.round((asIfUtc - d.getTime()) / 60_000);
}

function startOfMonthKyiv(d: Date): Date {
  const p = tzParts(d);
  return kyivStartOfDay(p.year, p.month, 1);
}

function addMonthsKyiv(d: Date, months: number): Date {
  const p = tzParts(d);
  let m = p.month + months;
  let y = p.year;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return kyivStartOfDay(y, m, p.day);
}

function endOfMonthKyiv(d: Date): Date {
  const p = tzParts(d);
  /// Перший день наступного місяця → мінус 1 мс.
  const nextMonth = p.month === 12 ? 1 : p.month + 1;
  const nextYear = p.month === 12 ? p.year + 1 : p.year;
  const nextStart = kyivStartOfDay(nextYear, nextMonth, 1);
  return new Date(nextStart.getTime() - 1);
}

function dayKey(d: Date): string {
  const p = tzParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  const p = tzParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

/// Пн=0, Нд=6 — узгоджується з ISO-week start.
function dayOfWeekMon0(d: Date): number {
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[tzParts(d).weekday] ?? 0;
}

function startOfWeekKyiv(d: Date): Date {
  const p = tzParts(d);
  const dow = dayOfWeekMon0(d);
  /// Йдемо назад dow днів від поточного дня, отримуємо понеділок.
  return kyivStartOfDay(p.year, p.month, p.day - dow);
}

function addDaysKyiv(d: Date, days: number): Date {
  const p = tzParts(d);
  return kyivStartOfDay(p.year, p.month, p.day + days);
}

const UA_MONTH_SHORT = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
const UA_MONTH_FULL = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const UA_MONTH_NOMINATIVE = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

function fmtDayLabel(d: Date): string {
  const p = tzParts(d);
  return String(p.day);
}

function fmtWeekLabel(weekStart: Date): string {
  const p = tzParts(weekStart);
  return `${p.day} ${UA_MONTH_SHORT[p.month - 1]}`;
}

function fmtMonthLabel(d: Date): string {
  const p = tzParts(d);
  return `${UA_MONTH_SHORT[p.month - 1]} ${String(p.year).slice(2)}`;
}

function fmtRange(start: Date, end: Date, granularity: Granularity): string {
  const a = tzParts(start);
  const b = tzParts(end);
  if (granularity === 'day') {
    return `${a.day} ${UA_MONTH_FULL[a.month - 1]} – ${b.day} ${UA_MONTH_FULL[b.month - 1]} ${b.year}`;
  }
  return `${UA_MONTH_FULL[a.month - 1]} ${a.year} – ${UA_MONTH_FULL[b.month - 1]} ${b.year}`;
}

/// Експортується для повторного використання в інших аналітичних модулях
/// (sales-by-product тощо) — повертає start/end/rangeLabel БЕЗ обчислення buckets/series.
/// Для 'all' робить додатковий запит на найдавніший платіж у БД.
export async function getSalesPeriodRange(period: SalesPeriod): Promise<{
  start: Date;
  end: Date;
  granularity: Granularity;
  rangeLabel: string;
}> {
  let earliest: Date | null = null;
  if (period === 'all') {
    const [firstPay, firstConn] = await Promise.all([
      prisma.payment.findFirst({
        where: { status: 'PAID' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.connectorOrder.findFirst({
        where: { paymentStatus: 'PAID', amount: { gt: 1 } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    const candidates = [firstPay?.createdAt, firstConn?.createdAt].filter(Boolean) as Date[];
    if (candidates.length) earliest = candidates.reduce((a, b) => (a < b ? a : b));
  }
  const { start, end, granularity } = pickRange(period, earliest);
  return { start, end, granularity, rangeLabel: fmtRange(start, end, granularity) };
}

function pickRange(period: SalesPeriod, earliestPaymentAt: Date | null): { start: Date; end: Date; granularity: Granularity } {
  const now = new Date();
  const monthStart = startOfMonthKyiv(now);
  const monthEnd = endOfMonthKyiv(now);
  switch (period) {
    case '30d': {
      /// Ковзне вікно: сьогодні + 29 попередніх днів = рівно 30 днів. End = кінець сьогодні.
      const tp = tzParts(now);
      const todayStart = kyivStartOfDay(tp.year, tp.month, tp.day);
      const start = addDaysKyiv(todayStart, -29);
      const end = new Date(addDaysKyiv(todayStart, 1).getTime() - 1);
      return { start, end, granularity: 'day' };
    }
    case '1m':
      return { start: monthStart, end: monthEnd, granularity: 'day' };
    case '3m':
      return { start: addMonthsKyiv(monthStart, -2), end: monthEnd, granularity: 'week' };
    case '6m':
      return { start: addMonthsKyiv(monthStart, -5), end: monthEnd, granularity: 'week' };
    case '1y':
      return { start: addMonthsKyiv(monthStart, -11), end: monthEnd, granularity: 'month' };
    case 'all': {
      const start = earliestPaymentAt
        ? startOfMonthKyiv(earliestPaymentAt)
        : addMonthsKyiv(monthStart, -11);
      return { start, end: monthEnd, granularity: 'month' };
    }
  }
}

export async function getSalesAnalytics(period: SalesPeriod): Promise<SalesSeries> {
  /// Для 'all' нам потрібно знати найдавніший платіж. Беремо мінімум з обох таблиць.
  let earliest: Date | null = null;
  if (period === 'all') {
    const [firstPay, firstConn] = await Promise.all([
      prisma.payment.findFirst({
        where: { status: 'PAID' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.connectorOrder.findFirst({
        where: { paymentStatus: 'PAID', amount: { gt: 1 } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    const candidates = [firstPay?.createdAt, firstConn?.createdAt].filter(Boolean) as Date[];
    if (candidates.length) {
      earliest = candidates.reduce((a, b) => (a < b ? a : b));
    }
  }

  const { start, end, granularity } = pickRange(period, earliest);

  /// Тягнемо платежі. Виключаємо тестові (user.role ∉ ADMIN/MANAGER, connector amount > 1).
  /// Кожен платіж рахується ПОВНОЮ сумою в день оплати (реальний обіг/каса) —
  /// включно з річними 15 000 ₴. Жодного розмазування на місяці: графік збігається
  /// з тим, що видно в розділі Платежі.
  const [payments, connectorOrders] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: start, lte: end },
        user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
      },
      select: {
        amount: true,
        createdAt: true,
        courseId: true,
        bundleId: true,
        yearlyProgramSubscriptionId: true,
        yearlyProgramSubscription: { select: { plan: true, autoRenew: true } },
      },
    }),
    prisma.connectorOrder.findMany({
      where: {
        paymentStatus: 'PAID',
        amount: { gt: 1 },
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  /// Будуємо порожні бакети у потрібній гранулярності.
  const buckets: SalesBucket[] = [];
  const indexByKey = new Map<string, number>();

  if (granularity === 'day') {
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      const key = dayKey(cursor);
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: fmtDayLabel(cursor),
        courses: 0, bundles: 0, yearly: 0, connector: 0,
      });
      cursor = addDaysKyiv(cursor, 1);
    }
  } else if (granularity === 'week') {
    /// Тижні Пн-Нд. Стартуємо з пн ≤ start.
    let cursor = startOfWeekKyiv(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = `w-${dayKey(cursor)}`;
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: fmtWeekLabel(cursor),
        courses: 0, bundles: 0, yearly: 0, connector: 0,
      });
      cursor = addDaysKyiv(cursor, 7);
    }
  } else {
    /// month
    let cursor = startOfMonthKyiv(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = monthKey(cursor);
      indexByKey.set(key, buckets.length);
      buckets.push({
        key,
        label: fmtMonthLabel(cursor),
        courses: 0, bundles: 0, yearly: 0, connector: 0,
      });
      cursor = addMonthsKyiv(cursor, 1);
    }
  }

  function bucketIndexFor(date: Date): number | null {
    if (granularity === 'day') {
      return indexByKey.get(dayKey(date)) ?? null;
    }
    if (granularity === 'week') {
      const ws = startOfWeekKyiv(date);
      return indexByKey.get(`w-${dayKey(ws)}`) ?? null;
    }
    return indexByKey.get(monthKey(date)) ?? null;
  }

  const totals = { courses: 0, bundles: 0, yearly: 0, connector: 0, all: 0 };
  const kpiAcc = {
    courses: [] as number[],
    bundles: [] as number[],
    yearlyYearly: [] as number[],
    yearlyMonthlyOnce: [] as number[],
    yearlyMonthlyAuto: [] as number[],
    connector: [] as number[],
  };

  for (const p of payments) {
    const idx = bucketIndexFor(p.createdAt);
    if (idx == null) continue;
    let cat: CategoryKey | null = null;
    if (p.yearlyProgramSubscriptionId) {
      cat = 'yearly';
      const plan = p.yearlyProgramSubscription?.plan;
      const auto = p.yearlyProgramSubscription?.autoRenew === true;
      if (plan === 'YEARLY') kpiAcc.yearlyYearly.push(p.amount);
      else if (plan === 'MONTHLY' && auto) kpiAcc.yearlyMonthlyAuto.push(p.amount);
      else if (plan === 'MONTHLY') kpiAcc.yearlyMonthlyOnce.push(p.amount);
    } else if (p.bundleId) {
      cat = 'bundles';
      kpiAcc.bundles.push(p.amount);
    } else if (p.courseId) {
      cat = 'courses';
      kpiAcc.courses.push(p.amount);
    }
    if (!cat) continue;
    buckets[idx][cat] += p.amount;
    totals[cat] += p.amount;
    totals.all += p.amount;
  }

  for (const o of connectorOrders) {
    const idx = bucketIndexFor(o.createdAt);
    if (idx == null) continue;
    buckets[idx].connector += o.amount;
    totals.connector += o.amount;
    totals.all += o.amount;
    kpiAcc.connector.push(o.amount);
  }

  const summarize = (arr: number[]): SalesKpi => {
    const count = arr.length;
    const sum = arr.reduce((s, v) => s + v, 0);
    return { count, sum, avg: count ? Math.round(sum / count) : 0 };
  };
  const kpi: SalesKpiBuckets = {
    courses: summarize(kpiAcc.courses),
    bundles: summarize(kpiAcc.bundles),
    yearlyYearly: summarize(kpiAcc.yearlyYearly),
    yearlyMonthlyOnce: summarize(kpiAcc.yearlyMonthlyOnce),
    yearlyMonthlyAuto: summarize(kpiAcc.yearlyMonthlyAuto),
    connector: summarize(kpiAcc.connector),
  };

  /// Для денного графіку — заповнюємо weekTotal на бакеті, що закриває тиждень (нд)
  /// АБО на останньому дні діапазону (обірваний тиждень). Ставимо ЗАВЖДИ, навіть якщо
  /// сума 0 — це межа тижня для футера; без нього порожні тижні «зливалися» з сусідніми
  /// і період показувався некоректно. Нульові тижні футер покаже як "0 ₴".
  if (granularity === 'day') {
    let acc = 0;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      acc += b.courses + b.bundles + b.yearly + b.connector;
      const dow = dayOfWeekMon0(parseDayKey(b.key));
      const isLastDay = i === buckets.length - 1;
      if (dow === 6 || isLastDay) {
        buckets[i].weekTotal = acc;
        acc = 0;
      }
    }
  }

  /// Порівняння з попереднім періодом такої ж тривалості — повна сума кожного платежу
  /// в день оплати (узгоджено з головним циклом, без розмазування).
  const periodMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  const [prevAggr, prevConn] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: prevStart, lte: prevEnd },
        user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
      },
    }),
    prisma.connectorOrder.aggregate({
      _sum: { amount: true },
      where: {
        paymentStatus: 'PAID',
        amount: { gt: 1 },
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
  ]);

  const previousTotal = (prevAggr._sum.amount ?? 0) + (prevConn._sum.amount ?? 0);
  const { currentLabel, previousLabel } = fmtComparisonLabels(
    start, end, prevStart, prevEnd, granularity, period,
  );

  /// Інсайти: найкращий бакет (день/тиждень/місяць) + найкращий тиждень (для day-вʼю).
  let bestIdx = -1;
  let bestVal = 0;
  buckets.forEach((b, i) => {
    const t = b.courses + b.bundles + b.yearly + b.connector;
    if (t > bestVal) { bestVal = t; bestIdx = i; }
  });
  const bestBucket = bestIdx >= 0 ? buckets[bestIdx] : null;

  let bestWeekVal = 0;
  let bestWeekNum: number | null = null;
  let bestWeekLabel: string | null = null;
  if (granularity === 'day') {
    let weekNum = 0;
    let weekStart = 0;
    buckets.forEach((b, i) => {
      /// Межа тижня = weekTotal заданий (навіть 0), щоб нумерація збігалася з футером.
      if (b.weekTotal !== undefined) {
        weekNum++;
        if (b.weekTotal > bestWeekVal) {
          bestWeekVal = b.weekTotal;
          bestWeekNum = weekNum;
          /// Лейбл — "1 кві – 7 кві".
          const startDate = parseDayKey(buckets[weekStart].key);
          const endDate = parseDayKey(b.key);
          const sp = tzParts(startDate);
          const ep = tzParts(endDate);
          bestWeekLabel = `${sp.day} ${UA_MONTH_SHORT[sp.month - 1]} – ${ep.day} ${UA_MONTH_SHORT[ep.month - 1]}`;
        }
        weekStart = i + 1;
      }
    });
  }

  /// Лейбл для найкращого дня — "5 квітня".
  let bestBucketLabel: string | null = null;
  if (bestBucket) {
    if (granularity === 'day') {
      const d = parseDayKey(bestBucket.key);
      const p = tzParts(d);
      bestBucketLabel = `${p.day} ${UA_MONTH_FULL[p.month - 1]}`;
    } else {
      bestBucketLabel = bestBucket.label;
    }
  }

  return {
    granularity,
    buckets,
    totals,
    kpi,
    rangeStart: start,
    rangeEnd: end,
    rangeLabel: fmtRange(start, end, granularity),
    previousTotal,
    previousLabel,
    currentLabel,
    insights: {
      bestBucketKey: bestBucket?.key ?? null,
      bestBucketLabel,
      bestBucketValue: bestVal,
      bestWeekNum,
      bestWeekLabel,
      bestWeekValue: bestWeekVal,
    },
  };
}

/// Підписи поточного та попереднього періодів для порівняння hero-метрики.
function fmtComparisonLabels(
  curStart: Date,
  curEnd: Date,
  prevStart: Date,
  prevEnd: Date,
  granularity: Granularity,
  period: SalesPeriod,
): { currentLabel: string; previousLabel: string } {
  /// 30d — ковзне вікно: "Останні 30 днів vs попередніх 30 днів".
  if (period === '30d') {
    return { currentLabel: 'Останні 30 днів', previousLabel: 'попередніх 30 днів' };
  }
  /// 1m — календарні місяці: "Травень 2026 vs Квітень 2026".
  if (granularity === 'day') {
    const cur = tzParts(curStart);
    const prev = tzParts(prevStart);
    return {
      currentLabel: `${UA_MONTH_NOMINATIVE[cur.month - 1]} ${cur.year}`,
      previousLabel: `${UA_MONTH_NOMINATIVE[prev.month - 1]} ${prev.year}`,
    };
  }
  /// week/month — діапазони місяців.
  const ca = tzParts(curStart);
  const cb = tzParts(curEnd);
  const pa = tzParts(prevStart);
  const pb = tzParts(prevEnd);
  const range = (a: ReturnType<typeof tzParts>, b: ReturnType<typeof tzParts>) =>
    a.month === b.month && a.year === b.year
      ? `${UA_MONTH_NOMINATIVE[a.month - 1]} ${a.year}`
      : `${UA_MONTH_SHORT[a.month - 1]} ${String(a.year).slice(2)} – ${UA_MONTH_SHORT[b.month - 1]} ${String(b.year).slice(2)}`;
  return { currentLabel: range(ca, cb), previousLabel: range(pa, pb) };
}

function parseDayKey(key: string): Date {
  /// key — YYYY-MM-DD у TZ Kyiv.
  const [y, m, d] = key.split('-').map(Number);
  return kyivStartOfDay(y, m, d);
}
