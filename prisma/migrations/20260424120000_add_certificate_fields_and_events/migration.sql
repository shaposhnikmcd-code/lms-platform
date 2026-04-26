-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('COURSE', 'YEARLY_PROGRAM');

-- CreateEnum
CREATE TYPE "CertCategory" AS ENUM ('LISTENER', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "CertEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');

-- DropForeignKey (було ON DELETE CASCADE — міняємо на SET NULL, бо sert має пережити видалення курсу)
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_courseId_fkey";

-- DropIndex
DROP INDEX "Certificate_userId_courseId_key";

-- DropIndex
DROP INDEX "Certificate_userId_idx";

-- AlterTable (Certificate розширення)
ALTER TABLE "Certificate" DROP COLUMN "certificateUrl",
ADD COLUMN     "category" "CertCategory",
ADD COLUMN     "certNumber" TEXT NOT NULL,
ADD COLUMN     "courseName" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" "CertEmailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "issueYear" INTEGER NOT NULL,
ADD COLUMN     "issuedByEmail" TEXT,
ADD COLUMN     "issuedByName" TEXT,
ADD COLUMN     "issuedByUserId" TEXT,
ADD COLUMN     "issuedManually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pdfHash" TEXT,
ADD COLUMN     "recipientEmail" TEXT NOT NULL,
ADD COLUMN     "recipientName" TEXT NOT NULL,
ADD COLUMN     "revoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedByName" TEXT,
ADD COLUMN     "revokedByUserId" TEXT,
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "type" "CertificateType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verificationToken" TEXT NOT NULL,
ALTER COLUMN "courseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CertificateEvent" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certNumber_key" ON "Certificate"("certNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verificationToken_key" ON "Certificate"("verificationToken");

-- CreateIndex
CREATE INDEX "Certificate_type_issuedAt_idx" ON "Certificate"("type", "issuedAt");

-- CreateIndex
CREATE INDEX "Certificate_subscriptionId_idx" ON "Certificate"("subscriptionId");

-- CreateIndex
CREATE INDEX "Certificate_issuedByUserId_idx" ON "Certificate"("issuedByUserId");

-- CreateIndex
CREATE INDEX "Certificate_emailStatus_idx" ON "Certificate"("emailStatus");

-- CreateIndex
CREATE INDEX "Certificate_revoked_idx" ON "Certificate"("revoked");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_type_courseId_key" ON "Certificate"("userId", "type", "courseId");

-- CreateIndex
CREATE INDEX "CertificateEvent_certificateId_createdAt_idx" ON "CertificateEvent"("certificateId", "createdAt");

-- CreateIndex
CREATE INDEX "CertificateEvent_actorId_idx" ON "CertificateEvent"("actorId");

-- CreateIndex
CREATE INDEX "CertificateEvent_action_idx" ON "CertificateEvent"("action");

-- CreateIndex
CREATE INDEX "CertificateEvent_createdAt_idx" ON "CertificateEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "YearlyProgramSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateEvent" ADD CONSTRAINT "CertificateEvent_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
