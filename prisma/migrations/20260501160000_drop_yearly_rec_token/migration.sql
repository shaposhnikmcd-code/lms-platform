-- Drop YearlyProgramSubscription.recToken — мертвий вантаж.
-- WFP-merchant-acc не повертає recToken у callback, тому колонка завжди була NULL.
-- Cyclical-схема працює через WFP-managed schedule (regularApi), розрізнення MANUAL vs
-- CYCLICAL у cron-і робиться через autoRenew, не через recToken.
ALTER TABLE "YearlyProgramSubscription" DROP COLUMN IF EXISTS "recToken";
