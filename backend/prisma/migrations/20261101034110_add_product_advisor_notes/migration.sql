-- CreateEnum
CREATE TYPE "AdvisorNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "advisorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_advisor_notes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "content" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "reviewStatus" "AdvisorNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_advisor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_advisor_notes_productId_reviewStatus_idx" ON "product_advisor_notes"("productId", "reviewStatus");

-- CreateIndex
CREATE INDEX "product_advisor_notes_variantId_idx" ON "product_advisor_notes"("variantId");

-- AddForeignKey
ALTER TABLE "product_advisor_notes" ADD CONSTRAINT "product_advisor_notes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_advisor_notes" ADD CONSTRAINT "product_advisor_notes_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
