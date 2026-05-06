-- CreateTable
CREATE TABLE "NewsPage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "content" TEXT NOT NULL,
    "contentEn" TEXT,
    "contentPl" TEXT,
    "pageBgColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsPage_key_key" ON "NewsPage"("key");
