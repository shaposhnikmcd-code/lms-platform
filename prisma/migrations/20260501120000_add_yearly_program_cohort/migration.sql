-- CreateTable
CREATE TABLE "YearlyProgramCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "launchedAt" TIMESTAMP(3),
    "emailScheduledFor" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "launchEmailSubject" TEXT,
    "launchEmailBody" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearlyProgramCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YearlyProgramCohort_startDate_idx" ON "YearlyProgramCohort"("startDate");

-- CreateIndex
CREATE INDEX "YearlyProgramCohort_isCurrent_idx" ON "YearlyProgramCohort"("isCurrent");

-- CreateIndex: гарантує, що тільки один cohort має isCurrent=true одночасно.
-- Partial unique index — null/false не блокують, лише true рядки змагаються за єдиний слот.
CREATE UNIQUE INDEX "YearlyProgramCohort_only_one_current"
    ON "YearlyProgramCohort"("isCurrent")
    WHERE "isCurrent" = true;

-- AlterTable
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "cohortId" TEXT;

-- CreateIndex
CREATE INDEX "YearlyProgramSubscription_cohortId_idx" ON "YearlyProgramSubscription"("cohortId");

-- AddForeignKey
ALTER TABLE "YearlyProgramSubscription"
    ADD CONSTRAINT "YearlyProgramSubscription_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "YearlyProgramCohort"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
