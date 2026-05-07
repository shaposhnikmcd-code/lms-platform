-- Telegram user_id (BigInt) для швидкого lookup підписки при `chat_member` events.
-- Заповнюється при першому approve або при rejoin через chat_member-handler.
ALTER TABLE "YearlyProgramSubscription" ADD COLUMN "telegramTgUserId" BIGINT;

CREATE INDEX "YearlyProgramSubscription_telegramTgUserId_idx" ON "YearlyProgramSubscription"("telegramTgUserId");
