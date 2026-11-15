ALTER TABLE "reviews" ADD COLUMN "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "reviews_verified_user_product_key" ON "reviews" ("userId", "productId") WHERE "isVerifiedPurchase" = true;
CREATE INDEX "reviews_productId_isVisible_createdAt_idx" ON "reviews" ("productId", "isVisible", "createdAt");
CREATE INDEX "orders_userId_status_idx" ON "orders" ("userId", "status");
CREATE INDEX "order_items_orderId_variantId_idx" ON "order_items" ("orderId", "variantId");
