-- Issue Tracker для Річної програми. Менеджер заглушує issue коли проблема вирішена
-- поза системою (наприклад дописав email вручну, передзвонив студенту). Issue знову
-- стає активним, якщо нова failure-подія для цієї пари (sub, kind) виникає після
-- dismissedAt — collector у lib/yearlyProgramIssues.ts робить порівняння timestamp-ів.

CREATE TABLE "YearlyProgramIssueDismissal" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedBy" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "YearlyProgramIssueDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YearlyProgramIssueDismissal_subscriptionId_kind_key" ON "YearlyProgramIssueDismissal"("subscriptionId", "kind");
CREATE INDEX "YearlyProgramIssueDismissal_subscriptionId_idx" ON "YearlyProgramIssueDismissal"("subscriptionId");
CREATE INDEX "YearlyProgramIssueDismissal_kind_idx" ON "YearlyProgramIssueDismissal"("kind");

ALTER TABLE "YearlyProgramIssueDismissal" ADD CONSTRAINT "YearlyProgramIssueDismissal_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "YearlyProgramSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
