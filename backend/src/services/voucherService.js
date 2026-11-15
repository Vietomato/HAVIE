import prisma from "../config/prisma.js";
import { HttpError } from "../utils/http.js";
import { calculateVoucherDiscount, normalizeVoucherCode } from "../utils/voucher.js";

export async function findVoucherByCode(db, rawCode) {
  const code = normalizeVoucherCode(rawCode);
  if (!code) {
    throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập mã giảm giá.");
  }
  return db.voucher.findUnique({ where: { code } });
}

/**
 * Inside an order transaction: checks the voucher against `subtotal` and
 * reserves one use. The conditional update keeps concurrent checkouts from
 * going past the usage limit.
 */
export async function claimVoucher(tx, rawCode, subtotal, now = new Date()) {
  const voucher = await findVoucherByCode(tx, rawCode);
  const discountAmount = calculateVoucherDiscount(voucher, subtotal, now);

  const claim = await tx.voucher.updateMany({
    where: {
      id: voucher.id,
      isActive: true,
      OR: [
        { usageLimit: null },
        { usedCount: { lt: prisma.voucher.fields.usageLimit } },
      ],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claim.count !== 1) {
    throw new HttpError(409, "VOUCHER_USED_UP", "Mã giảm giá đã hết lượt sử dụng.");
  }

  return { voucher, discountAmount };
}

/** Gives back the use reserved by a cancelled order. */
export async function releaseVoucher(tx, order) {
  if (!order.voucherId) return;
  await tx.voucher.updateMany({
    where: { id: order.voucherId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}

export function cartSubtotal(cart) {
  return (cart?.items ?? []).reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  );
}
