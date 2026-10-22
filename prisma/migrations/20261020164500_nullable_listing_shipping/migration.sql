-- Null shipping means the source did not disclose a cost.
-- 0 remains a real free-shipping offer. Existing 0 rows stay 0.
ALTER TABLE "Listing" ALTER COLUMN "shipping" DROP DEFAULT;
ALTER TABLE "Listing" ALTER COLUMN "shipping" DROP NOT NULL;

ALTER TABLE "PriceHistory" ALTER COLUMN "shipping" DROP DEFAULT;
ALTER TABLE "PriceHistory" ALTER COLUMN "shipping" DROP NOT NULL;
