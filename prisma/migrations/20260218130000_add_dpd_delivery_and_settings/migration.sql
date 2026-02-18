-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('DPD_COURIER', 'DPD_PICKUP');

-- CreateEnum
CREATE TYPE "CheckoutPaymentMethod" AS ENUM ('STRIPE', 'BANK_TRANSFER', 'COD');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "deliveryMethod" "DeliveryMethod",
ADD COLUMN "paymentMethod" "CheckoutPaymentMethod",
ADD COLUMN "dpdProduct" INTEGER,
ADD COLUMN "pickupPoint" JSONB,
ADD COLUMN "codAmount" DECIMAL(12,2),
ADD COLUMN "codCurrency" TEXT,
ADD COLUMN "carrier" TEXT,
ADD COLUMN "carrierShipmentId" TEXT,
ADD COLUMN "carrierParcelNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "carrierLabelLastPrintedAt" TIMESTAMP(3),
ADD COLUMN "carrierMeta" JSONB;

-- AlterTable
ALTER TABLE "ShopSettings"
ADD COLUMN "dpdSettings" JSONB,
ADD COLUMN "paymentSettings" JSONB;
