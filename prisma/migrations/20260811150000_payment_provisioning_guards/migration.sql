-- Захист «гроші є, доступу немає»:
--   1) Payment.bundleSlugsSnapshot — склад пакета на момент створення платежу
--      ({ paid: string[], free: string[] }). Провіжинінг бере склад ЗІ snapshot-у, а не з
--      живого bundle, тож правка пакета між оплатою і callback-ом більше не ріже клієнту доступ.
--      NULL = старий платіж → fallback на живий bundle (стара поведінка).
--   2) Payment.provisionAlertedAt — коли менеджерам пішов алерт про провалений провіжинінг.
--      Дедуплікує денний cron: один алерт на платіж, а не щодоби.
--   3) ConnectorOrder.paidNotifiedAt — коли менеджерам пішла нотифікація про оплату гри.
--      Recon-cron добирає PAID-замовлення з NULL і шле повторно.
-- Колонки вже додані на dev через db:push; цей файл доставляє їх на pre/prod через migrate deploy.
-- IF NOT EXISTS — щоб повторне застосування (де колонка вже є) не падало.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bundleSlugsSnapshot" JSONB;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provisionAlertedAt" TIMESTAMP(3);
ALTER TABLE "ConnectorOrder" ADD COLUMN IF NOT EXISTS "paidNotifiedAt" TIMESTAMP(3);
--   4) PaymentCallbackLog.alertedAt — дедуплікація алерту «Approved прийшов, а Payment не знайдено».
ALTER TABLE "PaymentCallbackLog" ADD COLUMN IF NOT EXISTS "alertedAt" TIMESTAMP(3);

-- Backfill: усі вже оплачені замовлення вважаємо пронотифікованими. Без цього перший
-- прогін recon-крона розіслав би менеджерам повторні листи по всій історії оплат.
UPDATE "ConnectorOrder"
SET "paidNotifiedAt" = COALESCE("paidAt", "createdAt")
WHERE "paymentStatus" = 'PAID' AND "paidNotifiedAt" IS NULL;
