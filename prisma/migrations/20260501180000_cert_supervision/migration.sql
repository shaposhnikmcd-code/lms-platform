-- Сертифікати супервізії: новий тип CertificateType.SUPERVISION + дата проведення
-- супервізійного заняття. Видаються менеджерами вручну з адмінки → /certificates → "Супервізія".
-- Не пов'язані з оплатою/курсом/підпискою — partial unique index по (userId, type, courseId)
-- не блокує дублі (courseId завжди NULL → NULL вважається distinct у PG).

ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'SUPERVISION';

ALTER TABLE "Certificate" ADD COLUMN "supervisionDate" TIMESTAMP(3);
