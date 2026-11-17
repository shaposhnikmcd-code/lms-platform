-- Стан продажу гри «Конектор»: адмін зупиняє/відновлює продаж з адмінки без деплою.
-- Рядка за замовчуванням немає → продаж відкритий (дефолт у коді).
CREATE TABLE "ConnectorSalesSetting" (
    "id" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedLabel" TEXT,
    "pausedNote" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorSalesSetting_pkey" PRIMARY KEY ("id")
);
