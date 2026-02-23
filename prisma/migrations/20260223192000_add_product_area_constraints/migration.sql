ALTER TABLE "Product"
ADD COLUMN "areaMinQuantity" INTEGER,
ADD COLUMN "areaMinWidth" DECIMAL(10,2),
ADD COLUMN "areaMinHeight" DECIMAL(10,2),
ADD COLUMN "areaMaxWidth" DECIMAL(10,2),
ADD COLUMN "areaMaxHeight" DECIMAL(10,2);

UPDATE "Product"
SET
  "areaMaxWidth" = COALESCE("areaMaxWidth", 200),
  "areaMaxHeight" = COALESCE("areaMaxHeight", 300)
WHERE "wpProductId" = 1426;

UPDATE "Product"
SET "areaMaxWidth" = COALESCE("areaMaxWidth", 99)
WHERE "wpProductId" = 1433;

UPDATE "Product"
SET
  "areaMinQuantity" = COALESCE("areaMinQuantity", 10),
  "areaMaxWidth" = COALESCE("areaMaxWidth", 29.7),
  "areaMaxHeight" = COALESCE("areaMaxHeight", 42)
WHERE "wpProductId" = 1444;
