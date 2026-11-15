import { Router } from "express";
import { randomUUID } from "node:crypto";
import prisma from "../config/prisma.js";
import {
  authMiddleware,
  requireCustomer,
} from "../middlewares/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { claimVoucher, releaseVoucher } from "../services/voucherService.js";
import {
  PAYMENT_METHOD_PAYOS,
  createPaymentLink,
  expireStalePayosOrders,
  getPayosClient,
  syncPayosOrder,
  cancelUnpaidOrder,
  toPayosOrderCode,
  toPublicPayment,
} from "../services/payosService.js";

const router = Router();
const SHIPPING_FEE = 30000;
const CANCELLABLE_STATUSES = ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"];
const PAYMENT_METHODS = ["COD", PAYMENT_METHOD_PAYOS];

router.use(authMiddleware);

function requiredText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `HV-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

router.post(
  "/",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const {
      addressId,
      recipientName,
      recipientPhone,
      shippingAddress,
      paymentMethod = "COD",
      customerNote,
      voucherCode,
    } = req.body ?? {};

    if (
      voucherCode !== undefined &&
      voucherCode !== null &&
      typeof voucherCode !== "string"
    ) {
      throw new HttpError(400, "VALIDATION_ERROR", "Mã giảm giá không hợp lệ.");
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new HttpError(
        400,
        "UNSUPPORTED_PAYMENT_METHOD",
        "Phương thức thanh toán không được hỗ trợ.",
      );
    }
    const payFirst = paymentMethod === PAYMENT_METHOD_PAYOS;
    const payos = payFirst ? getPayosClient() : null;
    if (payFirst && !payos) {
      throw new HttpError(
        503,
        "PAYMENT_UNAVAILABLE",
        "Thanh toán chuyển khoản QR tạm thời chưa khả dụng. Bạn vui lòng chọn thanh toán khi nhận hàng.",
      );
    }

    if (addressId && shippingAddress) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Chỉ chọn địa chỉ đã lưu hoặc nhập địa chỉ mới.",
      );
    }

    let recipient;
    let phone;
    let fullAddress;

    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId: req.user.id },
      });

      if (!address) {
        throw new HttpError(
          404,
          "ADDRESS_NOT_FOUND",
          "Không tìm thấy địa chỉ.",
        );
      }

      recipient = address.recipientName;
      phone = address.phone;
      fullAddress = [
        address.streetAddress,
        address.ward,
        address.district,
        address.province,
      ].join(", ");
    } else {
      const fields = shippingAddress ?? {};

      if (
        !requiredText(recipientName) ||
        !requiredText(recipientPhone) ||
        !requiredText(fields.streetAddress) ||
        // Phường/xã có thể trống: vài huyện đảo (Côn Đảo, Bạch Long Vĩ...) không có cấp xã.
        (fields.ward != null && typeof fields.ward !== "string") ||
        !requiredText(fields.district) ||
        !requiredText(fields.province)
      ) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.",
        );
      }

      recipient = recipientName.trim();
      phone = recipientPhone.trim();
      fullAddress = [
        fields.streetAddress,
        fields.ward,
        fields.district,
        fields.province,
      ]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ");
    }

    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId: req.user.id },
        include: {
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!cart?.items.length) {
        throw new HttpError(400, "CART_EMPTY", "Giỏ hàng đang trống.");
      }

      let subtotal = 0;

      for (const item of cart.items) {
        const variant = item.variant;

        if (
          !variant.isAvailable ||
          !variant.product.isActive ||
          variant.stockQuantity < item.quantity
        ) {
          throw new HttpError(
            409,
            "INSUFFICIENT_STOCK",
            `Sản phẩm "${variant.product.name}" không đủ tồn kho.`,
            { variantId: variant.id, available: variant.stockQuantity },
          );
        }

        subtotal += variant.price * item.quantity;
      }

      const applied = voucherCode?.trim()
        ? await claimVoucher(tx, voucherCode, subtotal)
        : null;
      const discountAmount = applied?.discountAmount ?? 0;
      const totalAmount = subtotal - discountAmount + SHIPPING_FEE;

      for (const item of cart.items) {
        const result = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            isAvailable: true,
            product: { isActive: true },
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (result.count !== 1) {
          throw new HttpError(
            409,
            "INSUFFICIENT_STOCK",
            "Tồn kho vừa thay đổi. Vui lòng tải lại giỏ hàng.",
            { variantId: item.variantId },
          );
        }

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: "OUT",
            quantity: item.quantity,
            reason: "ORDER_PLACED",
          },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          orderCode: createOrderCode(),
          userId: req.user.id,
          // Chuyển khoản QR: chờ khách trả tiền trước; COD: chờ shop xác nhận đơn.
          status: payFirst ? "PENDING_PAYMENT" : "PENDING_CONFIRMATION",
          paymentMethod,
          paymentStatus: "PENDING",
          subtotal,
          shippingFee: SHIPPING_FEE,
          discountAmount,
          totalAmount,
          voucherId: applied?.voucher.id ?? null,
          voucherCode: applied?.voucher.code ?? null,
          recipientName: recipient,
          recipientPhone: phone,
          shippingAddress: fullAddress,
          note: typeof customerNote === "string" ? customerNote.trim() : null,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productName: item.variant.product.name,
              variantName: item.variant.name,
              price: item.variant.price,
              quantity: item.quantity,
              subtotal: item.variant.price * item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return createdOrder;
    });

    if (!payFirst) {
      res.status(201).json({ data: order, message: "Đặt hàng thành công." });
      return;
    }

    // Tạo link thanh toán ở payOS. Nếu payOS lỗi thì hủy đơn và trả hàng về kho, khách có thể thử lại.
    let paidOrder;
    try {
      const link = await createPaymentLink({ payos, order, items: order.items });
      paidOrder = await prisma.order.update({
        where: { id: order.id },
        data: link,
        include: { items: true },
      });
    } catch (error) {
      console.error("[payos] Không tạo được link thanh toán:", error.message);
      await cancelUnpaidOrder(prisma, order, {
        paymentStatus: "FAILED",
        reason: "Không tạo được link thanh toán",
      });
      throw new HttpError(
        502,
        "PAYMENT_LINK_FAILED",
        "Không tạo được mã thanh toán. Vui lòng thử lại hoặc chọn thanh toán khi nhận hàng.",
      );
    }

    res.status(201).json({
      data: { ...paidOrder, payment: toPublicPayment(paidOrder) },
      message: "Đặt hàng thành công.",
    });
  }),
);

router.get(
  "/my",
  requireCustomer,
  asyncHandler(async (req, res) => {
    await expireStalePayosOrders({ database: prisma, payos: getPayosClient(), userId: req.user.id });
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      data: orders,
      meta: {
        page: 1,
        pageSize: orders.length,
        total: orders.length,
        totalPages: 1,
      },
    });
  }),
);

// Thông tin thanh toán của một đơn chuyển khoản. Khách mở trang này (và trang tự tải lại) thì backend
// hỏi payOS trạng thái thật, nên đơn được cập nhật ngay khi tiền về.
router.get(
  "/:id/payment",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const current = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: true },
    });

    if (!current) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    }
    if (current.paymentMethod !== PAYMENT_METHOD_PAYOS) {
      throw new HttpError(409, "NOT_QR_PAYMENT", "Đơn hàng này không thanh toán bằng mã QR.");
    }

    const order = await syncPayosOrder({
      database: prisma,
      payos: getPayosClient(),
      order: current,
    });
    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    res.json({ data: { order: fresh, payment: toPublicPayment(fresh) } });
  }),
);

router.post(
  "/:id/cancel",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { reason } = req.body ?? {};

    if (!requiredText(reason)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập lý do hủy.");
    }

    const payos = getPayosClient();
    const waiting = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
        paymentMethod: PAYMENT_METHOD_PAYOS,
        status: "PENDING_PAYMENT",
      },
      include: { items: true },
    });
    if (waiting && payos) {
      await syncPayosOrder({ database: prisma, payos, order: waiting });
    }

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: { items: true },
      });

      if (!current) {
        throw new HttpError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
      }

      if (!CANCELLABLE_STATUSES.includes(current.status)) {
        throw new HttpError(
          409,
          "ORDER_CANNOT_BE_CANCELLED",
          "Đơn hàng không thể hủy ở trạng thái hiện tại.",
        );
      }

      const nextStatus = "CANCELLED";
      const nextPaymentStatus =
        current.paymentStatus === "PAID"
          ? "REFUND_PENDING"
          : current.paymentStatus;

      const claim = await tx.order.updateMany({
        where: {
          id: current.id,
          userId: req.user.id,
          status: { in: CANCELLABLE_STATUSES },
          paymentStatus: current.paymentStatus,
        },
        data: {
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          cancelReason: reason.trim(),
        },
      });

      if (claim.count !== 1) {
        throw new HttpError(
          409,
          "ORDER_CANNOT_BE_CANCELLED",
          "Đơn hàng đã được cập nhật; vui lòng tải lại.",
        );
      }

      await releaseVoucher(tx, current);

      for (const item of current.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: "IN",
            quantity: item.quantity,
            reason: "ORDER_CANCELLED",
          },
        });
      }

      return tx.order.findUnique({
        where: { id: current.id },
        include: { items: true },
      });
    });

    if (waiting && payos) {
      await payos.paymentRequests
        .cancel(toPayosOrderCode(order.orderCode), "Khách hủy đơn")
        .catch((error) => console.error("[payos] Không hủy được link:", error.message));
    }

    res.json({ data: order, message: "Đã hủy đơn hàng." });
  }),
);

export default router;
