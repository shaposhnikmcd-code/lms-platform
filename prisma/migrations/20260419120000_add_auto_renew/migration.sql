-- AlterTable
ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;
