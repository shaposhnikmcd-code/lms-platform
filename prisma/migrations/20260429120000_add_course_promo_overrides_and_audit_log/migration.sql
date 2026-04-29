-- Adds 4 per-course promo columns to CoursePriceOverride.
-- Each course can have up to 2 promo codes that map to fixed prices.
-- Codes are stored UPPER-cased; same code may repeat across courses (per-course unique).
ALTER TABLE "CoursePriceOverride" ADD COLUMN "promo1Code" TEXT;
ALTER TABLE "CoursePriceOverride" ADD COLUMN "promo1Price" INTEGER;
ALTER TABLE "CoursePriceOverride" ADD COLUMN "promo2Code" TEXT;
ALTER TABLE "CoursePriceOverride" ADD COLUMN "promo2Price" INTEGER;

-- Audit log of every change made on /dashboard/admin/courses (price, oldPrice, promos, SP id).
CREATE TABLE "CoursePriceAuditLog" (
  "id"         TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "userId"     TEXT,
  "userEmail"  TEXT,
  "userName"   TEXT,
  "action"     TEXT NOT NULL,
  "changes"    JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CoursePriceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoursePriceAuditLog_slug_createdAt_idx" ON "CoursePriceAuditLog"("slug", "createdAt");
CREATE INDEX "CoursePriceAuditLog_createdAt_idx" ON "CoursePriceAuditLog"("createdAt");
