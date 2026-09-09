-- CreateEnum
CREATE TYPE "AdjustmentSource" AS ENUM ('MANUAL', 'ADMIN_EDIT', 'SHOPIFY_ORDER', 'SHOPIFY_CANCEL', 'SHOPIFY_REFUND', 'RECONCILE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shopifyOptionValue" TEXT,
ADD COLUMN     "shopifyProductId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "shopifyInventoryItemId" TEXT,
ADD COLUMN     "shopifyVariantId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "source" "AdjustmentSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ShopifyToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopifyProductId_shopifyOptionValue_key" ON "Product"("shopifyProductId", "shopifyOptionValue");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_shopifyVariantId_key" ON "ProductVariant"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_shopifyInventoryItemId_key" ON "ProductVariant"("shopifyInventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_externalRef_productVariantId_key" ON "StockAdjustment"("externalRef", "productVariantId");

