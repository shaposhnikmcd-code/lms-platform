-- Track когда подписчик вышел/был исключён из Telegram-канала
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "telegramLeftAt" TIMESTAMP(3);
