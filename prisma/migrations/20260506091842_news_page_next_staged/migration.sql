-- AlterTable
ALTER TABLE "NewsPage" ADD COLUMN "nextContent" TEXT;
ALTER TABLE "NewsPage" ADD COLUMN "nextContentEn" TEXT;
ALTER TABLE "NewsPage" ADD COLUMN "nextContentPl" TEXT;
ALTER TABLE "NewsPage" ADD COLUMN "nextPageBgColor" TEXT;
ALTER TABLE "NewsPage" ADD COLUMN "nextPublishAt" TIMESTAMP(3);
ALTER TABLE "NewsPage" ADD COLUMN "nextUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NewsPage_nextPublishAt_idx" ON "NewsPage"("nextPublishAt");
