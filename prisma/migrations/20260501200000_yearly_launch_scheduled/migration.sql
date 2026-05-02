-- Запланований запуск Річної програми. Менеджер може натиснути 🚀 Запустити та обрати дату+час
-- замість миттєвого запуску — `launchScheduledFor` фіксує бажаний момент.
-- Cron yearly-subscriptions перевіряє щодоби: коли launchScheduledFor <= now AND launchedAt IS NULL —
-- виконує реальний запуск (відкриває SendPulse доступ, перераховує expiresAt усім підпискам).
ALTER TABLE "YearlyProgramCohort"
  ADD COLUMN "launchScheduledFor" TIMESTAMP(3);

CREATE INDEX "YearlyProgramCohort_launchScheduledFor_idx"
  ON "YearlyProgramCohort"("launchScheduledFor");
