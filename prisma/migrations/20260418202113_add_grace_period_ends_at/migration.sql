-- AlterTable
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "graceStartedAt" TIMESTAMP(3);
