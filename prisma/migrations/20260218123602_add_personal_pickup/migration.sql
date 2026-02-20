DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'carrierParcelNumbers'
  ) THEN
    ALTER TABLE "Order" ALTER COLUMN "carrierParcelNumbers" DROP DEFAULT;
  END IF;
END $$;
