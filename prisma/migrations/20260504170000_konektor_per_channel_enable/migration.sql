-- Per-channel вимикачі для KonektorManager — дозволяють тимчасово відключити email
-- або Telegram без видалення значення.
ALTER TABLE "KonektorManager"
  ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;
