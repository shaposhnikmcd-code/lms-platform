-- «Хто вніс» для ручних платежів Річної програми (готівка / переказ / ФОП / перенесення):
-- email або ім'я адміна з getAdminActor. Для WFP-платежів лишається NULL.
-- Показується у реєстрі «Ручні платежі» в адмінці Річної.
-- Колонка вже додана на dev через db:push; цей файл доставляє її на pre/prod через migrate deploy.
-- IF NOT EXISTS — щоб повторне застосування (де колонка вже є) не падало.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "manualEnteredBy" TEXT;
