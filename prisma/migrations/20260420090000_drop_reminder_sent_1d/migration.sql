-- Видаляємо legacy поле reminderSent1d. Воно лишилось після refactor-у email-templates
-- (див. 20260419100000_add_reminder_flags), де 1-day-before reminder замінили на
-- більш деталізовані флаги (manualOnExpiry, reminderSentGraceStart тощо).
ALTER TABLE "YearlyProgramSubscription" DROP COLUMN IF EXISTS "reminderSent1d";
