-- CreateEnum
CREATE TYPE "TopProductsMode" AS ENUM ('RANDOM_ALL', 'RANDOM_CATEGORIES', 'MANUAL');

-- CreateTable
CREATE TABLE "TopProducts" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "mode" "TopProductsMode" NOT NULL DEFAULT 'RANDOM_ALL',
    "categoryIds" TEXT[],
    "productIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopProducts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopProducts_audience_key" ON "TopProducts"("audience");
