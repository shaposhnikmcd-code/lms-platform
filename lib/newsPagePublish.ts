import prisma from "@/lib/prisma";

const KEY = "default";

export interface PublishResult {
  published: boolean;
  reason?: string;
  publishedAt?: string;
}

/**
 * Копіює staged-копію (next*) у live (content/contentEn/contentPl/pageBgColor)
 * і чистить next*. Викликається з cron (`/api/cron/news-page-publish`) при
 * настанні nextPublishAt і з ручної кнопки "Опублікувати зараз" у адмінці.
 *
 * Безпека: НЕ змінює published-флаг — якщо сторінка не активна, після публікації
 * вона лишається не активною (адмін окремо вирішує коли активувати). Це навмисно:
 * "scheduled publish" не повинен раптово показувати чернетку публіці.
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

  return { published: true, publishedAt: now.toISOString() };
}
