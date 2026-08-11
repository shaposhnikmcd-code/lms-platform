/**
 * Київ-зональні утиліти для дат публікацій. DST-aware через Intl —
 * не залежить від offset-у Vercel runtime (UTC) чи браузера.
 *
 * Контекст: менеджер обирає тільки ДАТУ публікації (наприклад 25.06.2026).
 * Бекенд зберігає `nextPublishAt` як 06:00 Europe/Kyiv цього дня в UTC.
 * Cron `/api/cron/news-publish` (04:00 UTC = 06:00–07:00 Київ залежно від
 * DST) гарантовано відпрацьовує після цього порогу і робить swap.
 */

export const KYIV_TZ = "Europe/Kyiv";
export const KYIV_PUBLISH_HOUR = 6;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && ISO_DATE_RE.test(s);
}

/**
 * "YYYY-MM-DD" + година в Київ → UTC Date.
 * DST-safe: рахує реальний offset Києва саме на ту дату через Intl.
 */
export function kyivDateAtHourToUTC(dateStr: string, hour: number): Date {
  if (!isIsoDate(dateStr)) {
    throw new Error(`Invalid date string (expected YYYY-MM-DD): ${dateStr}`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);

  // Початкове наближення: трактуємо як UTC. Далі двічі коригуємо різницю
  // (двох ітерацій достатньо щоб «зловити» DST навіть якщо offset зміниться
  // саме в цю добу).
  let candidate = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  for (let i = 0; i < 2; i++) {
    const kyivHour = readKyivHour(candidate);
    const diff = hour - kyivHour;
    if (diff === 0) break;
    candidate = new Date(candidate.getTime() + diff * 3_600_000);
  }
  return candidate;
}

function readKyivHour(at: Date): number {
  // Intl.DateTimeFormat з timeZone — єдиний DST-надійний шлях у JS без deps.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: KYIV_TZ,
    hour: "numeric",
    hour12: false,
  });
  return Number(fmt.format(at));
}

/**
 * Date → "YYYY-MM-DD" у Київ-таймзоні. Використовується щоб віддати
 * клієнту staged-дату у форматі, який просто кладеться в date-picker.
 */
export function utcToKyivDateStr(at: Date | null | undefined): string | null {
  if (!at) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA повертає `YYYY-MM-DD` саме у потрібному форматі.
  return fmt.format(at);
}

/// Компоненти дати/часу в Київ-зоні. `hourCycle: 'h23'` — щоб опівночі повертало 0,
/// а не 24 (en-GB з `hour12:false` у частині ICU-збірок друкує саме «24»).
const KYIV_PARTS_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: KYIV_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface KyivParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Розкладає instant на компоненти київського календаря (DST-aware). */
export function kyivParts(at: Date): KyivParts {
  const acc: Record<string, number> = {};
  for (const p of KYIV_PARTS_FMT.formatToParts(at)) {
    if (p.type !== "literal") acc[p.type] = Number(p.value);
  }
  return {
    year: acc.year, month: acc.month, day: acc.day,
    hour: acc.hour, minute: acc.minute, second: acc.second,
  };
}

/** Зсув київського часу відносно UTC (мс) на заданий момент. Влітку +3год, взимку +2год. */
export function kyivOffsetMs(at: Date): number {
  const p = kyivParts(at);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Скидаємо мілісекунди: у компонентах їх немає, інакше offset «плаває» на <1с.
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * UTC-instant, який у Києві є 00:00 доби, зміщеної на `offsetDays` від `at`.
 * Потрібен скрізь, де межа доби має бути київською, а не UTC-шною: у нас рантайм
 * Vercel в UTC, тож `setUTCHours(0,0,0,0)` різав добу о 03:00 за Києвом.
 * DST-safe: offset читається двічі — другий раз уже на кандидаті, тож перехід
 * на літній/зимовий час саме в цю добу не зсуває результат.
 */
export function kyivMidnightUtc(at: Date, offsetDays = 0): Date {
  const p = kyivParts(at);
  const utcNoon = Date.UTC(p.year, p.month - 1, p.day + offsetDays);
  let candidate = new Date(utcNoon - kyivOffsetMs(at));
  candidate = new Date(utcNoon - kyivOffsetMs(candidate));
  return candidate;
}

/** Дата у форматі «ДД.ММ.РРРР» за київським календарем — для листів студентам. */
export function kyivDateDisplay(at: Date): string {
  const p = kyivParts(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

/** Завтрашня дата у Київ-зоні як "YYYY-MM-DD". */
export function kyivTomorrowDateStr(): string {
  const now = new Date();
  const todayKyiv = utcToKyivDateStr(now);
  if (!todayKyiv) throw new Error("Failed to compute Kyiv date");
  const [y, m, d] = todayKyiv.split("-").map(Number);
  // Будуємо за допомогою UTC щоб не залежати від рантайм-таймзони.
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  return utcToKyivDateStr(tomorrow)!;
}
