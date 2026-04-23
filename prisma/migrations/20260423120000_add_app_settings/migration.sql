-- Generic key-value таблиця для runtime-конфігурованих налаштувань.
-- Перший споживач — `yearlyGraceDays` (тривалість grace-періоду Річної програми).
CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
