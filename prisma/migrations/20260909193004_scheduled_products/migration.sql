-- DropForeignKey
ALTER TABLE "ScheduledItem" DROP CONSTRAINT "ScheduledItem_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledItem" DROP CONSTRAINT "ScheduledItem_productVariantId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "scheduled" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "ScheduledItem";

