import prisma from "@/lib/prisma";

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

  return { published: true, publishedAt: now.toISOString() };
}

/**
 * Read-time auto-publish: перший хіт на /news (або адмінський виклик) після
 * `nextPublishAt` автоматично виконує swap. Той самий патерн що
 * News.suspendedAt/resumeAt — без cron-ів, перевірка інлайн при читанні.
 *
 * Безпечно викликати скрізь — early-return якщо таймер ще не настав або
 * чернетки немає. Атомарність гарантується самим update-ом (Prisma
 * робить SQL UPDATE одним statement).
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
