ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "oauth_identities" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_identities_provider_subject_key" ON "oauth_identities"("provider", "subject");
CREATE INDEX "oauth_identities_userId_idx" ON "oauth_identities"("userId");
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_records" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_records_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "auth_records_expiresAt_idx" ON "auth_records"("expiresAt");
CREATE TABLE "rate_counters" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_counters_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_counters_expiresAt_idx" ON "rate_counters"("expiresAt");
CREATE TABLE "runtime_leases" (
  "key" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runtime_leases_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "runtime_leases_expiresAt_idx" ON "runtime_leases"("expiresAt");
CREATE INDEX "products_isActive_categoryId_brandId_idx" ON "products"("isActive", "categoryId", "brandId");
CREATE INDEX "product_variants_price_productId_idx" ON "product_variants"("price", "productId");
CREATE INDEX "product_variants_productId_isAvailable_idx" ON "product_variants"("productId", "isAvailable");
