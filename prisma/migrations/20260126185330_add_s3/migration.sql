-- CreateEnum
CREATE TYPE "OrderAssetKind" AS ENUM ('ARTWORK', 'PREVIEW', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderAssetStatus" AS ENUM ('PENDING', 'UPLOADED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderAssetStorageProvider" AS ENUM ('S3');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ARTWORK_UPLOADED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "OrderAsset" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "kind" "OrderAssetKind" NOT NULL,
    "status" "OrderAssetStatus" NOT NULL DEFAULT 'PENDING',
    "fileNameOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "storageProvider" "OrderAssetStorageProvider" NOT NULL DEFAULT 'S3',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "region" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "orderId" TEXT,
    "toEmail" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "error" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAsset_orderId_createdAt_idx" ON "OrderAsset"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderAsset_orderItemId_idx" ON "OrderAsset"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderAsset_status_idx" ON "OrderAsset"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_orderId_idx" ON "NotificationLog"("orderId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_type_orderId_toEmail_key" ON "NotificationLog"("type", "orderId", "toEmail");

-- AddForeignKey
ALTER TABLE "OrderAsset" ADD CONSTRAINT "OrderAsset_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAsset" ADD CONSTRAINT "OrderAsset_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAsset" ADD CONSTRAINT "OrderAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
