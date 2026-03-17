-- CreateTable
CREATE TABLE "NovaPostDivision" (
    "id" INTEGER NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT,
    "category" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaPostDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovaPostSyncLog" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "NovaPostSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovaPostDivision_externalId_key" ON "NovaPostDivision"("externalId");

-- CreateIndex
CREATE INDEX "NovaPostDivision_countryCode_idx" ON "NovaPostDivision"("countryCode");

-- CreateIndex
CREATE INDEX "NovaPostDivision_countryCode_name_idx" ON "NovaPostDivision"("countryCode", "name");

-- CreateIndex
CREATE INDEX "NovaPostDivision_countryCode_city_idx" ON "NovaPostDivision"("countryCode", "city");
