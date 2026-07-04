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
 * Видимість: публікація непорожньої чернетки ВВІМКНЕ сторінку (`published=true`).
 * «Опублікувати» і scheduled publish — це явний намір менеджера показати версію
 * публіці, тож ми не лишаємо її прихованою (раніше published не чіпався, і
 * запланована підміна тихо не зʼявлялась на /news — сторінка лишалась порожньою
 * доки хтось окремо не тисне «Активувати»). Порожню чернетку (blank) НЕ активуємо
 * — інакше показали б empty state.
 */
export async function publishStagedNewsPage(): Promise<PublishResult> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx): Promise<PublishResult> => {
    const page = await tx.newsPage.findUnique({ where: { key: KEY } });
    if (!page) return { published: false, reason: "Сторінка ще не створена" };
    if (page.nextContent === null) {
      return { published: false, reason: "Немає чернетки для публікації" };
    }

    // Чи промотований контент непорожній — визначає, чи вмикати видимість.
    const promotedHasContent =
      page.nextContent.trim().length > 0 && page.nextContent !== "[]";
    // Чи є що архівувати (порожню/нульову live-сторінку не архівуємо).
    const hasLiveContent = !!page.content && page.content.trim().length > 0 && page.content !== "[]";

    // Атомарний claim-and-swap. WHERE nextContent != null серіалізує конкурентні
    // виклики: publishStagedNewsPage фаериться з cron (05:00), read-time на КОЖНОМУ
    // хіті /news і адмінських GET-ів — на маунті адмінки два GET-и стартують
    // паралельно. Під Postgres row-lock-ом лише ОДИН updateMany матчить рядок
    // (після першого swap nextContent=null → WHERE другого не проходить, count=0),
    // тож архів і підміна виконуються рівно раз. Без цього — дублікати в Архіві.
    const swap = await tx.newsPage.updateMany({
      where: { key: KEY, nextContent: { not: null } },
      data: {
        content: page.nextContent,
        contentEn: page.nextContentEn,
        contentPl: page.nextContentPl,
        pageBgColor: page.nextPageBgColor,
        pageWidth: page.nextPageWidth ?? page.pageWidth,
        // Непорожня публікація вмикає видимість; порожню не активуємо.
        ...(promotedHasContent ? { published: true } : {}),
        // Чистимо staged.
        nextContent: null,
        nextContentEn: null,
        nextContentPl: null,
        nextPageBgColor: null,
        nextPageWidth: null,
        nextPublishAt: null,
        nextUpdatedAt: null,
      },
    });
    if (swap.count === 0) {
      // Інший виклик уже опублікував цю чернетку — не архівуємо повторно.
      return { published: false, reason: "Вже опубліковано (конкурентний виклик)" };
    }

    if (hasLiveContent) {
      await tx.newsPageArchive.create({
        data: {
          pageKey: KEY,
          content: page.content,
          contentEn: page.contentEn,
          contentPl: page.contentPl,
          pageBgColor: page.pageBgColor,
          pageWidth: page.pageWidth,
          wasPublished: page.published,
          archivedAt: now,
        },
      });
    }
    return { published: true, publishedAt: now.toISOString() };
  });

  // Інвалідуємо ISR-кеш /news лише коли реально сталася підміна. `revalidatePath`
  // безпечно викликати і з cron (server), і з read-time (request); поза цими
  // контекстами Next.js кине — ловимо.
  if (result.published) {
    try {
      revalidatePath("/uk/news");
      revalidatePath("/en/news");
      revalidatePath("/pl/news");
      revalidatePath("/news");
    } catch {
      /* поза server-context — ок */
    }
  }

  return result;
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
