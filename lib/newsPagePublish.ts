import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const KEY = "default";

export interface PublishResult {
  published: boolean;
  reason?: string;
  publishedAt?: string;
}

/**
 * Копіює staged-копію (next*) у live (content/contentEn/contentPl/pageBgColor)
 * і чистить next*. Викликається ручною кнопкою "Опублікувати зараз" у адмінці
 * або хелпером `maybeAutoPublishStagedNewsPage` (read-time перевірка таймера).
 *
 * Безпека: НЕ змінює published-флаг — якщо сторінка не активна, після публікації
 * вона лишається не активною (адмін окремо вирішує коли активувати). Це навмисно:
 * scheduled publish не повинен раптово показувати чернетку публіці.
 */
export async function publishStagedNewsPage(): Promise<PublishResult> {
  const page = await prisma.newsPage.findUnique({ where: { key: KEY } });
  if (!page) return { published: false, reason: "Сторінка ще не створена" };
  if (page.nextContent === null) {
    return { published: false, reason: "Немає чернетки для публікації" };
  }

  const now = new Date();
  await prisma.newsPage.update({
    where: { key: KEY },
    data: {
      content: page.nextContent,
      contentEn: page.nextContentEn,
      contentPl: page.nextContentPl,
      pageBgColor: page.nextPageBgColor,
      // Чистимо staged.
      nextContent: null,
      nextContentEn: null,
      nextContentPl: null,
      nextPageBgColor: null,
      nextPublishAt: null,
      nextUpdatedAt: null,
    },
  });

  // Інвалідуємо ISR-кеш /news щоб новий контент з'явився одразу — і для cron
  // (server context), і для read-time (request context). `revalidatePath`
  // безпечно викликати з обох — Next.js no-op-ить за межами цих контекстів.
  try {
    revalidatePath("/uk/news");
    revalidatePath("/en/news");
    revalidatePath("/pl/news");
    revalidatePath("/news");
  } catch {
    /* поза server-context — ок */
  }

  return { published: true, publishedAt: now.toISOString() };
}

/**
 * Auto-publish якщо `nextPublishAt <= now()`. Викликається з трьох місць:
 *   — cron `/api/cron/news-publish` (04:00 UTC ≈ 06:00–07:00 Київ) — primary;
 *   — read-time у `app/[locale]/news/page.tsx` — safety-net на випадок коли
 *     cron не відпрацював (Vercel quiet-period, мережеві глюки);
 *   — адмінські GET-и на staged endpoint — синхронізує адмінку.
 *
 * Безпечно викликати скрізь: early-return якщо таймер ще не настав або
 * чернетки немає. Подвійна публікація неможлива — `nextContent === null`
 * після першого swap-у.
 */
export async function maybeAutoPublishStagedNewsPage(): Promise<boolean> {
  const page = await prisma.newsPage.findUnique({
    where: { key: KEY },
    select: { nextPublishAt: true, nextContent: true },
  });
  if (!page) return false;
  if (page.nextContent === null) return false;
  if (!page.nextPublishAt) return false;
  if (page.nextPublishAt > new Date()) return false;
  const result = await publishStagedNewsPage();
  return result.published;
}
