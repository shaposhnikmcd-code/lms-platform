-- CreateTable
CREATE TABLE "YearlyProgramSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "yearlyPrice" INTEGER,
    "monthlyPrice" INTEGER,
    "btnLabel" TEXT,
    "priceNote" TEXT,
    "duration" TEXT,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearlyProgramSetting_pkey" PRIMARY KEY ("id")
);
