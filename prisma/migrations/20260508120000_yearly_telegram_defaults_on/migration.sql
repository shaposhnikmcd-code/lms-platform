-- Перемикаємо дефолти autoAdd + joinRequestMode на TRUE.
-- Існуючі записи у YearlyProgramTelegramSetting не змінюються — DEFAULT впливає тільки
-- на нові INSERT-и без явного значення (singleton row у проді вже існує і збереже свій
-- стан). Менеджер може як завжди toggle-ити обидва прапорці у адмінці.
ALTER TABLE "YearlyProgramTelegramSetting" ALTER COLUMN "autoAdd" SET DEFAULT true;
ALTER TABLE "YearlyProgramTelegramSetting" ALTER COLUMN "joinRequestMode" SET DEFAULT true;
