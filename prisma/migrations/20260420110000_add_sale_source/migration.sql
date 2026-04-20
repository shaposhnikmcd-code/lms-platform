-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('UIMP', 'TETYANA');

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "source" "SaleSource" NOT NULL DEFAULT 'UIMP',
  ADD COLUMN "externalRef" TEXT;

-- AlterTable
ALTER TABLE "ConnectorOrder"
  ADD COLUMN "source" "SaleSource" NOT NULL DEFAULT 'UIMP',
  ADD COLUMN "externalRef" TEXT;

-- CreateIndex
CREATE INDEX "Payment_source_idx" ON "Payment"("source");

-- CreateIndex
CREATE INDEX "ConnectorOrder_source_idx" ON "ConnectorOrder"("source");
