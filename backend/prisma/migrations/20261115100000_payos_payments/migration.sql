-- Thanh toán chuyển khoản QR qua payOS
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYOS';

ALTER TABLE "orders"
  ADD COLUMN "paymentLinkId" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "qrCode" TEXT,
  ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);
