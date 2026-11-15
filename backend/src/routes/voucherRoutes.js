import { Router } from "express";
import prisma from "../config/prisma.js";
import {
  authMiddleware,
  requireCustomer,
} from "../middlewares/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { calculateVoucherDiscount } from "../utils/voucher.js";
import { cartSubtotal, findVoucherByCode } from "../services/voucherService.js";

const router = Router();

router.use(authMiddleware, requireCustomer);

// Preview only: the order route checks the voucher again and reserves a use.
router.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const { code } = req.body ?? {};
    if (typeof code !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập mã giảm giá.");
    }

    const [voucher, cart] = await Promise.all([
      findVoucherByCode(prisma, code),
      prisma.cart.findUnique({
        where: { userId: req.user.id },
        include: { items: { include: { variant: true } } },
      }),
    ]);
    if (!cart?.items.length) {
      throw new HttpError(400, "CART_EMPTY", "Giỏ hàng đang trống.");
    }

    const subtotal = cartSubtotal(cart);
    const discountAmount = calculateVoucherDiscount(voucher, subtotal);

    res.json({
      data: {
        code: voucher.code,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        subtotal,
        discountAmount,
      },
      message: "Áp dụng mã giảm giá thành công.",
    });
  }),
);

export default router;
