-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "designerBgColor" TEXT,
ADD COLUMN     "designerColorProfile" TEXT DEFAULT 'CMYK',
ADD COLUMN     "designerDpi" INTEGER DEFAULT 300,
ADD COLUMN     "designerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "designerHeight" INTEGER,
ADD COLUMN     "designerWidth" INTEGER;

-- CreateTable
CREATE TABLE "DesignTemplate" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "elements" JSONB NOT NULL,
    "thumbnailUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignTemplate_productId_idx" ON "DesignTemplate"("productId");

-- AddForeignKey
ALTER TABLE "DesignTemplate" ADD CONSTRAINT "DesignTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
