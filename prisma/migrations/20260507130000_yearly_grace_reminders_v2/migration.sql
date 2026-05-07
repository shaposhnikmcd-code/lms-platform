-- Адаптивний розклад reminder-листів grace:
--   start (день +1) → mid (середина, якщо graceDays ≥ 5) → last (1 день до, якщо ≥ 3) → closed
-- Mid-лист тепер єдиний для manual і cyclical (раніше був тільки cyclical-failed-3).
-- Last-лист — повністю новий, треба окреме поле reminderSentGraceLast.

ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "reminderSentGraceLast" BOOLEAN NOT NULL DEFAULT false;

-- Перейменовуємо ключ кастомізації шаблона у БД щоб не втратити правки менеджера.
-- Старий ключ "reminder.cyclical-failed-3" → новий "reminder.cyclical-grace-mid".
-- Новий ключ семантично коректний (mid grace, не "+3 дні від експайру").
UPDATE "EmailTemplate"
SET "templateKey" = 'reminder.cyclical-grace-mid'
WHERE "templateKey" = 'reminder.cyclical-failed-3';
