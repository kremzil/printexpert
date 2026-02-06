-- CreateTable
CREATE TABLE "SavedCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCartItem" (
    "id" TEXT NOT NULL,
    "savedCartId" TEXT NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "selectedOptions" JSONB,
    "priceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedCart_userId_idx" ON "SavedCart"("userId");

-- CreateIndex
CREATE INDEX "SavedCartItem_savedCartId_idx" ON "SavedCartItem"("savedCartId");

-- CreateIndex
CREATE INDEX "SavedCartItem_productId_idx" ON "SavedCartItem"("productId");

-- AddForeignKey
ALTER TABLE "SavedCart" ADD CONSTRAINT "SavedCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCartItem" ADD CONSTRAINT "SavedCartItem_savedCartId_fkey" FOREIGN KEY ("savedCartId") REFERENCES "SavedCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCartItem" ADD CONSTRAINT "SavedCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
