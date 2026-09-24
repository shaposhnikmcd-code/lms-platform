-- Прапорець «лист за 1 день до дати закінчення надіслано» (manual, разова місячна оплата).
-- false для всіх наявних підписок: лист піде в найближчому вікні, якщо ще доречний.
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "reminderSent1d" BOOLEAN NOT NULL DEFAULT false;
