-- CreateEnum
CREATE TYPE "YearlyProgramPlan" AS ENUM ('YEARLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "YearlyProgramSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "yearlyProgramSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "YearlyProgramSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "YearlyProgramPlan" NOT NULL,
    "status" "YearlyProgramSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelledReason" TEXT,
    "recToken" TEXT,
    "wfpRegularRef" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "lastChargeAttemptAt" TIMESTAMP(3),
    "lastChargeError" TEXT,
    "failedChargeCount" INTEGER NOT NULL DEFAULT 0,
    "sendpulseStudentId" INTEGER,
    "sendpulseAccessOpenedAt" TIMESTAMP(3),
    "sendpulseAccessClosedAt" TIMESTAMP(3),
    "reminderSent3d" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent1d" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearlyProgramSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearlyProgramSubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YearlyProgramSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YearlyProgramSubscription_userId_idx" ON "YearlyProgramSubscription"("userId");

-- CreateIndex
CREATE INDEX "YearlyProgramSubscription_status_idx" ON "YearlyProgramSubscription"("status");

-- CreateIndex
CREATE INDEX "YearlyProgramSubscription_expiresAt_idx" ON "YearlyProgramSubscription"("expiresAt");

-- CreateIndex
CREATE INDEX "YearlyProgramSubscriptionEvent_subscriptionId_idx" ON "YearlyProgramSubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "YearlyProgramSubscriptionEvent_createdAt_idx" ON "YearlyProgramSubscriptionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "YearlyProgramSubscriptionEvent_type_idx" ON "YearlyProgramSubscriptionEvent"("type");

-- CreateIndex
CREATE INDEX "Payment_yearlyProgramSubscriptionId_idx" ON "Payment"("yearlyProgramSubscriptionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_yearlyProgramSubscriptionId_fkey" FOREIGN KEY ("yearlyProgramSubscriptionId") REFERENCES "YearlyProgramSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyProgramSubscription" ADD CONSTRAINT "YearlyProgramSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyProgramSubscriptionEvent" ADD CONSTRAINT "YearlyProgramSubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "YearlyProgramSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

