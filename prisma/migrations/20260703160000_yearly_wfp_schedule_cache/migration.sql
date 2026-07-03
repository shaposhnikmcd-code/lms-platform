-- Кеш графіка автосписань WFP на підписці Річної:
-- wfpNextChargeAt — дата наступного списання з regularApi STATUS (колонка «Наступний платіж»),
-- wfpScheduleCheckedAt — момент останньої звірки з WFP.
-- Колонки вже додані на dev через db:push; цей файл доставляє їх на pre/prod через migrate deploy.
-- IF NOT EXISTS — щоб повторне застосування (де колонка вже є) не падало.
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN IF NOT EXISTS "wfpNextChargeAt" TIMESTAMP(3);
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN IF NOT EXISTS "wfpScheduleCheckedAt" TIMESTAMP(3);
