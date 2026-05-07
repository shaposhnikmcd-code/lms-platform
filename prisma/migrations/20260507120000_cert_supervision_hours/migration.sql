-- Сертифікати супервізії: додаємо тривалість заняття в годинах (Float, опційне).
-- Друкується поряд з датою у body сертифіката та показується у таблиці адмінки.

ALTER TABLE "Certificate" ADD COLUMN "supervisionHours" DOUBLE PRECISION;
