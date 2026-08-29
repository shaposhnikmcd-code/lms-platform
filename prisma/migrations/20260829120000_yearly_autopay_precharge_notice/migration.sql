-- Дата списання, про яке клієнту вже пішов лист «скоро спишеться».
-- NULL = попередження ще не надсилалось (усі наявні підписки).
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "autopayNoticeSentFor" TIMESTAMP(3);
