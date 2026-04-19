-- AlterTable
ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "reminderSentOnExpiry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderSentGraceStart" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderSentGraceMid" BOOLEAN NOT NULL DEFAULT false;
