-- CreateTable
CREATE TABLE "CategoryPromoOverride" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "promo1Code" TEXT,
    "promo1Price" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryPromoOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryPromoOverride_category_key" ON "CategoryPromoOverride"("category");
