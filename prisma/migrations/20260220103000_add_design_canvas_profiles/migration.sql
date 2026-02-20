-- Ensure UUID generator is available for data backfill rows.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "DesignCanvasProfile" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sizeAid" TEXT,
    "sizeTermId" TEXT,
    "sizeLabel" TEXT,
    "trimWidthMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "trimHeightMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dpi" INTEGER NOT NULL DEFAULT 300,
    "bgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "colorProfile" TEXT NOT NULL DEFAULT 'CMYK',
    "bleedTopMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bleedRightMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bleedBottomMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bleedLeftMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "safeTopMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "safeRightMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "safeBottomMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "safeLeftMm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignCanvasProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DesignTemplate" ADD COLUMN "canvasProfileId" UUID;

-- Backfill default profile for products with enabled designer.
INSERT INTO "DesignCanvasProfile" (
    "id",
    "productId",
    "name",
    "trimWidthMm",
    "trimHeightMm",
    "dpi",
    "bgColor",
    "colorProfile",
    "sortOrder",
    "isActive",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    p."id",
    'default',
    ROUND((COALESCE(p."designerWidth", 1050)::numeric / GREATEST(COALESCE(p."designerDpi", 300), 1)::numeric) * 25.4, 2),
    ROUND((COALESCE(p."designerHeight", 600)::numeric / GREATEST(COALESCE(p."designerDpi", 300), 1)::numeric) * 25.4, 2),
    GREATEST(COALESCE(p."designerDpi", 300), 1),
    COALESCE(p."designerBgColor", '#ffffff'),
    COALESCE(p."designerColorProfile", 'CMYK'),
    0,
    true,
    CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."designerEnabled" = true;

-- Backfill profile for products that already have templates but were not enabled.
INSERT INTO "DesignCanvasProfile" (
    "id",
    "productId",
    "name",
    "trimWidthMm",
    "trimHeightMm",
    "dpi",
    "bgColor",
    "colorProfile",
    "sortOrder",
    "isActive",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    p."id",
    'default',
    ROUND((COALESCE(p."designerWidth", 1050)::numeric / GREATEST(COALESCE(p."designerDpi", 300), 1)::numeric) * 25.4, 2),
    ROUND((COALESCE(p."designerHeight", 600)::numeric / GREATEST(COALESCE(p."designerDpi", 300), 1)::numeric) * 25.4, 2),
    GREATEST(COALESCE(p."designerDpi", 300), 1),
    COALESCE(p."designerBgColor", '#ffffff'),
    COALESCE(p."designerColorProfile", 'CMYK'),
    0,
    true,
    CURRENT_TIMESTAMP
FROM "Product" p
WHERE EXISTS (
    SELECT 1
    FROM "DesignTemplate" t
    WHERE t."productId" = p."id"
)
AND NOT EXISTS (
    SELECT 1
    FROM "DesignCanvasProfile" cp
    WHERE cp."productId" = p."id"
);

-- Link existing templates to the first/default profile of their product.
WITH "first_profile" AS (
    SELECT DISTINCT ON ("productId")
        "id",
        "productId"
    FROM "DesignCanvasProfile"
    ORDER BY "productId", "sortOrder" ASC, "createdAt" ASC
)
UPDATE "DesignTemplate" t
SET "canvasProfileId" = fp."id"
FROM "first_profile" fp
WHERE t."productId" = fp."productId"
  AND t."canvasProfileId" IS NULL;

ALTER TABLE "DesignTemplate" ALTER COLUMN "canvasProfileId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DesignCanvasProfile_productId_idx" ON "DesignCanvasProfile"("productId");
CREATE UNIQUE INDEX "DesignCanvasProfile_productId_sizeAid_sizeTermId_key" ON "DesignCanvasProfile"("productId", "sizeAid", "sizeTermId");
CREATE INDEX "DesignTemplate_canvasProfileId_idx" ON "DesignTemplate"("canvasProfileId");

-- AddForeignKey
ALTER TABLE "DesignCanvasProfile" ADD CONSTRAINT "DesignCanvasProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignTemplate" ADD CONSTRAINT "DesignTemplate_canvasProfileId_fkey" FOREIGN KEY ("canvasProfileId") REFERENCES "DesignCanvasProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
