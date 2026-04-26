-- Add SendPulse course progress tracking to Enrollment
ALTER TABLE "Enrollment"
  ADD COLUMN "spProgressPercent" INTEGER,
  ADD COLUMN "spProgressCheckedAt" TIMESTAMP(3);

-- Add SendPulse Yearly Program course progress tracking to YearlyProgramSubscription
ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "spProgressPercent" INTEGER,
  ADD COLUMN "spProgressCheckedAt" TIMESTAMP(3);
