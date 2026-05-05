-- CreateTable
CREATE TABLE "KonektorManager" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT,
    "telegramChatId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNew" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPaid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KonektorManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KonektorManager_enabled_idx" ON "KonektorManager"("enabled");
