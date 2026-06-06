-- Payment: платіжний провайдер + метод оплати (з WFP paymentSystem).
-- Колонки вже додані на dev через db:push; цей файл доносить їх на pre/prod через migrate deploy.
-- IF NOT EXISTS — щоб повторне застосування (де колонка вже є) не падало.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT NOT NULL DEFAULT 'wayforpay';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
