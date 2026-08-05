-- Мовний склад PDF сертифіката: UK (тільки укр), EN (тільки англ), UK_EN (обидві сторінки).
CREATE TYPE "CertLanguages" AS ENUM ('UK', 'EN', 'UK_EN');

ALTER TABLE "Certificate" ADD COLUMN "languages" "CertLanguages" NOT NULL DEFAULT 'UK';

-- Backfill: серти, видані з англійським іменем до появи вибору мов, були двомовними.
-- (Новий enum створено в цій же транзакції, тому вживати його значення тут легально.)
UPDATE "Certificate" SET "languages" = 'UK_EN' WHERE "recipientNameEn" IS NOT NULL;
