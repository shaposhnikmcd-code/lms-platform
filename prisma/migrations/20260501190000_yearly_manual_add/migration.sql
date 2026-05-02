-- Manual-add: підписка створена через invite-link від менеджера для студента,
-- який не встиг купити Річну програму до запуску cohort-у.
-- manuallyAddedAt = коли студент натиснув invite-лінк і оплатив (callback).
-- manuallyAddedBy = email менеджера, що згенерував invite.
ALTER TABLE "YearlyProgramSubscription"
  ADD COLUMN "manuallyAddedAt" TIMESTAMP(3),
  ADD COLUMN "manuallyAddedBy" TEXT;

CREATE INDEX "YearlyProgramSubscription_manuallyAddedAt_idx"
  ON "YearlyProgramSubscription"("manuallyAddedAt");
