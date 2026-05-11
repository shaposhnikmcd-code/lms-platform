-- Додає другий слот промокоду для категорій (bundle / connector / yearly / monthly)
-- Перший слот (promo1*) історично використовується для SECRETPASS (адмін-тариф).
-- Новий promo2* — для публічних промокодів типу FORYOU10.

ALTER TABLE "CategoryPromoOverride" ADD COLUMN     "promo2Code" TEXT,
ADD COLUMN     "promo2Price" INTEGER,
ADD COLUMN     "promo2StartsAt" TIMESTAMP(3),
ADD COLUMN     "promo2ExpiresAt" TIMESTAMP(3);
