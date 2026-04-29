-- Add provisioning tracking to Payment.
-- These fields enable reconciliation cron to retry failed enrollments/SendPulse events
-- without affecting the atomic Payment.status flip.

ALTER TABLE "Payment"
  ADD COLUMN "enrollmentsCompletedAt" TIMESTAMP(3),
  ADD COLUMN "sendpulseSentAt" TIMESTAMP(3),
  ADD COLUMN "provisionError" TEXT;

-- Backfill: assume historic PAID payments are fully provisioned. If a customer never
-- complained about missing access, their enrollments and SP events are in place. This
-- avoids the recon cron re-doing work on the entire history on first run.
UPDATE "Payment"
SET
  "enrollmentsCompletedAt" = "paidAt",
  "sendpulseSentAt" = "paidAt"
WHERE "status" = 'PAID' AND "paidAt" IS NOT NULL;

-- Index used by recon cron query: WHERE status = 'PAID' AND (enrollmentsCompletedAt IS NULL OR sendpulseSentAt IS NULL).
CREATE INDEX "Payment_status_enrollmentsCompletedAt_sendpulseSentAt_idx"
  ON "Payment"("status", "enrollmentsCompletedAt", "sendpulseSentAt");
