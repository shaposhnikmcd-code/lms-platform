-- NewsPageArchive: snapshot live-полів /news перед заміною на staged-копію.
-- Запис створює publishStagedNewsPage (lib/newsPagePublish.ts) у транзакції
-- перед свопом. GET /api/admin/news/page-content/archive повертає список
-- snapshot-ів + повний контент за id для preview-модалки.
--
-- Чому міграція з'явилася лише зараз: модель потрапила у schema.prisma коміті
-- cda0718 (2026-05-13) разом з ендпоінтом + publish-обгорткою, але без
-- відповідної міграції — dev-branch отримав таблицю через `db:push`, а прод
-- Neon її не мав. /archive падало 500 на pre/проді.

CREATE TABLE "NewsPageArchive" (
  "id" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL DEFAULT 'default',
  "content" TEXT NOT NULL,
  "contentEn" TEXT,
  "contentPl" TEXT,
  "pageBgColor" TEXT,
  "wasPublished" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NewsPageArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsPageArchive_pageKey_archivedAt_idx" ON "NewsPageArchive"("pageKey", "archivedAt");
