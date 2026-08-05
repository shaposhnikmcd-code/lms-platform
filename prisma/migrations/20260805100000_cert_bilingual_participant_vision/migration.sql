-- Категорія «Учасник» для сертифікатів Річної програми
ALTER TYPE "CertCategory" ADD VALUE IF NOT EXISTS 'PARTICIPANT';

-- Статус оплати/видачі сертифіката «Vision»
CREATE TYPE "VisionCertStatus" AS ENUM ('NOT_PAID', 'PAID', 'ISSUED');

-- Snapshot англомовного імені (null = одномовний сертифікат)
ALTER TABLE "Certificate" ADD COLUMN "recipientNameEn" TEXT;

ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "visionCertStatus" "VisionCertStatus" NOT NULL DEFAULT 'NOT_PAID';
