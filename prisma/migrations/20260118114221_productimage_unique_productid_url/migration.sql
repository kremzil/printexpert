-- Remove duplicates before adding unique index
DELETE FROM "ProductImage" a
USING "ProductImage" b
WHERE a."productId" = b."productId"
  AND a."url" = b."url"
  AND a."id" > b."id";

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_url_key" ON "ProductImage"("productId", "url");