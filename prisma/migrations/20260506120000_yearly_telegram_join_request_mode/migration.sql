-- AlterTable: subscription gets join-tracking timestamp
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "telegramJoinedAt" TIMESTAMP(3);

-- AlterTable: settings get joinRequestMode toggle
ALTER TABLE "YearlyProgramTelegramSetting" ADD COLUMN "joinRequestMode" BOOLEAN NOT NULL DEFAULT false;
