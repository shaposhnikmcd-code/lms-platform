-- Optional validity window for per-course promo codes.
-- NULL `*StartsAt` => активний одразу. NULL `*ExpiresAt` => безстроково.
ALTER TABLE "CoursePriceOverride"
  ADD COLUMN "promo1StartsAt"  TIMESTAMP(3),
  ADD COLUMN "promo1ExpiresAt" TIMESTAMP(3),
  ADD COLUMN "promo2StartsAt"  TIMESTAMP(3),
  ADD COLUMN "promo2ExpiresAt" TIMESTAMP(3);

-- Те саме для категорійного промокоду (bundle / connector / yearly / monthly).
ALTER TABLE "CategoryPromoOverride"
  ADD COLUMN "promo1StartsAt"  TIMESTAMP(3),
  ADD COLUMN "promo1ExpiresAt" TIMESTAMP(3);
