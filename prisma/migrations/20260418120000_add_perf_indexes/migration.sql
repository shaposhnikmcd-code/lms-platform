-- Performance indexes for dashboard / cron / bundle filtering.
-- IF NOT EXISTS щоб міграція була безпечно повторно застосовна.

-- Payment
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_bundleId_idx" ON "Payment"("bundleId");
CREATE INDEX IF NOT EXISTS "Payment_courseId_idx" ON "Payment"("courseId");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

-- YearlyProgramSubscription
CREATE INDEX IF NOT EXISTS "YearlyProgramSubscription_status_expiresAt_idx" ON "YearlyProgramSubscription"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "YearlyProgramSubscription_plan_status_expiresAt_idx" ON "YearlyProgramSubscription"("plan", "status", "expiresAt");
