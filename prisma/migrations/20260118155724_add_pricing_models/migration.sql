-- CreateEnum
CREATE TYPE "PricingKind" AS ENUM ('BASE', 'FINISHING');

-- CreateTable
CREATE TABLE "PricingModel" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "kind" "PricingKind" NOT NULL,
    "sourceMtypeId" INTEGER NOT NULL,
    "breakpoints" JSONB NOT NULL,
    "numStyle" INTEGER,
    "numType" INTEGER,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingEntry" (
    "id" UUID NOT NULL,
    "pricingModelId" UUID NOT NULL,
    "attrsKey" TEXT NOT NULL,
    "breakpoint" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingModel_productId_idx" ON "PricingModel"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingModel_productId_sourceMtypeId_key" ON "PricingModel"("productId", "sourceMtypeId");

-- CreateIndex
CREATE INDEX "PricingEntry_pricingModelId_attrsKey_idx" ON "PricingEntry"("pricingModelId", "attrsKey");

-- CreateIndex
CREATE INDEX "PricingEntry_pricingModelId_breakpoint_idx" ON "PricingEntry"("pricingModelId", "breakpoint");

-- CreateIndex
CREATE UNIQUE INDEX "PricingEntry_pricingModelId_attrsKey_breakpoint_key" ON "PricingEntry"("pricingModelId", "attrsKey", "breakpoint");

-- AddForeignKey
ALTER TABLE "PricingModel" ADD CONSTRAINT "PricingModel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingEntry" ADD CONSTRAINT "PricingEntry_pricingModelId_fkey" FOREIGN KEY ("pricingModelId") REFERENCES "PricingModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
