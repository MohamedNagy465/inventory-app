-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "paymentMethod" TEXT;
