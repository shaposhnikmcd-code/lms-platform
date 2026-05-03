-- DropIndex
DROP INDEX "YearlyProgramCohort_launchScheduledFor_idx";

-- CreateTable
CREATE TABLE "BookingOrder" (
    "id" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "promoCode" TEXT,
    "promoAmount" INTEGER,
    "promoCurrency" TEXT,
    "clientEmail" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "isAdminTest" BOOLEAN NOT NULL DEFAULT false,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "BookingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("templateKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingOrder_orderReference_key" ON "BookingOrder"("orderReference");

-- CreateIndex
CREATE INDEX "BookingOrder_status_idx" ON "BookingOrder"("status");

-- CreateIndex
CREATE INDEX "BookingOrder_createdAt_idx" ON "BookingOrder"("createdAt");

-- CreateIndex
CREATE INDEX "BookingOrder_service_idx" ON "BookingOrder"("service");

-- CreateIndex
CREATE INDEX "BookingOrder_method_idx" ON "BookingOrder"("method");

-- CreateIndex
CREATE INDEX "BookingOrder_status_createdAt_idx" ON "BookingOrder"("status", "createdAt");
