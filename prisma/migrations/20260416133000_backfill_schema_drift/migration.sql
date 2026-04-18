-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('DISCOUNT', 'FIXED_FREE', 'CHOICE_FREE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterEnum
ALTER TYPE "NewsCategory" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "ConnectorOrder" ADD COLUMN     "actualShippingCost" INTEGER,
ADD COLUMN     "gamePrice" INTEGER,
ADD COLUMN     "shippingCost" INTEGER,
ADD COLUMN     "trackingSetAt" TIMESTAMP(3),
ADD COLUMN     "trackingSetByEmail" TEXT,
ADD COLUMN     "trackingSetById" TEXT,
ADD COLUMN     "trackingSetByName" TEXT,
ADD COLUMN     "trackingSetByRole" TEXT;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "contentEn" TEXT,
ADD COLUMN     "contentPl" TEXT,
ADD COLUMN     "excerptEn" TEXT,
ADD COLUMN     "excerptPl" TEXT,
ADD COLUMN     "resumeAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "titleEn" TEXT,
ADD COLUMN     "titlePl" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bundleId" TEXT,
ADD COLUMN     "freeSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByEmail" TEXT,
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByName" TEXT;

-- CreateTable
CREATE TABLE "ConnectorOrderTrackingLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "changedByName" TEXT,
    "changedByEmail" TEXT,
    "changedByRole" TEXT,

    CONSTRAINT "ConnectorOrderTrackingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "resumeAt" TIMESTAMP(3),
    "type" "BundleType" NOT NULL DEFAULT 'DISCOUNT',
    "paidCount" INTEGER NOT NULL DEFAULT 2,
    "freeCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleCourse" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BundleCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" INTEGER NOT NULL,
    "courseId" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCallbackLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderReference" TEXT,
    "transactionStatus" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "clientEmail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "signatureValid" BOOLEAN,
    "prevStatus" TEXT,
    "actionsTaken" TEXT,
    "sendpulseSlugs" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "rawPayload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCallbackLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistOverride" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" TEXT,
    "duration" TEXT,
    "btnLabel" TEXT,
    "btnUrl" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePriceOverride" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" INTEGER,
    "oldPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectorOrderTrackingLog_orderId_idx" ON "ConnectorOrderTrackingLog"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- CreateIndex
CREATE INDEX "Bundle_sortOrder_idx" ON "Bundle"("sortOrder");

-- CreateIndex
CREATE INDEX "BundleCourse_bundleId_idx" ON "BundleCourse"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleCourse_bundleId_courseSlug_key" ON "BundleCourse"("bundleId", "courseSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PaymentCallbackLog_orderReference_idx" ON "PaymentCallbackLog"("orderReference");

-- CreateIndex
CREATE INDEX "PaymentCallbackLog_createdAt_idx" ON "PaymentCallbackLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentCallbackLog_kind_idx" ON "PaymentCallbackLog"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistOverride_slug_key" ON "SpecialistOverride"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePriceOverride_slug_key" ON "CoursePriceOverride"("slug");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- CreateIndex
CREATE INDEX "ConnectorOrder_paymentStatus_idx" ON "ConnectorOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "ConnectorOrder_orderStatus_idx" ON "ConnectorOrder"("orderStatus");

-- CreateIndex
CREATE INDEX "CourseTeacher_userId_idx" ON "CourseTeacher"("userId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_receiverId_read_idx" ON "Message"("receiverId", "read");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE INDEX "News_published_createdAt_idx" ON "News"("published", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorOrderTrackingLog" ADD CONSTRAINT "ConnectorOrderTrackingLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ConnectorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleCourse" ADD CONSTRAINT "BundleCourse_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

