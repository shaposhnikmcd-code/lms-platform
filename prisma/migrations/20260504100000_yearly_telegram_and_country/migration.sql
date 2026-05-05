-- AlterTable: add country + telegram fields to YearlyProgramSubscription
ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "country"             TEXT,
  ADD COLUMN "telegramUsername"    TEXT,
  ADD COLUMN "telegramInviteLink"  TEXT,
  ADD COLUMN "telegramInvitedAt"   TIMESTAMP(3),
  ADD COLUMN "telegramInviteError" TEXT;

-- CreateTable: singleton config for the yearly-program Telegram channel/group
CREATE TABLE "YearlyProgramTelegramSetting" (
    "id"         TEXT NOT NULL DEFAULT 'singleton',
    "chatId"     TEXT,
    "chatTitle"  TEXT,
    "chatType"   TEXT,
    "autoAdd"    BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    "updatedBy"  TEXT,
    CONSTRAINT "YearlyProgramTelegramSetting_pkey" PRIMARY KEY ("id")
);
