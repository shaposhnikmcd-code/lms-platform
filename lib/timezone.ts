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
