import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../config/prisma.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const router = Router();
const SHIPPING_FEE = 30000;
const CANCELLABLE_STATUSES = [
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
];

router.use(authMiddleware);

function requiredText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `HV-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      addressId,
      recipientName,
      recipientPhone,
      shippingAddress,
      paymentMethod = 'COD',
      customerNote,
    } = req.body ?? {};

    if (paymentMethod !== 'COD') {
      throw new HttpError(
        400,
        'UNSUPPORTED_PAYMENT_METHOD',
        'Hiện tại chỉ hỗ trợ thanh toán COD.',
      );
    }

    if (addressId && shippingAddress) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Chỉ chọn địa chỉ đã lưu hoặc nhập địa chỉ mới.',
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
        throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ.');
      }

      recipient = address.recipientName;
      phone = address.phone;
      fullAddress = [
        address.streetAddress,
        address.ward,
        address.district,
        address.province,
      ].join(', ');
    } else {
      const fields = shippingAddress ?? {};

      if (
        !requiredText(recipientName) ||
        !requiredText(recipientPhone) ||
        !requiredText(fields.streetAddress) ||
        !requiredText(fields.ward) ||
        !requiredText(fields.district) ||
        !requiredText(fields.province)
      ) {
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.',
        );
      }

      recipient = recipientName.trim();
      phone = recipientPhone.trim();
      fullAddress = [
        fields.streetAddress,
        fields.ward,
        fields.district,
        fields.province,
      ].map((part) => part.trim()).join(', ');
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
        throw new HttpError(400, 'CART_EMPTY', 'Giỏ hàng đang trống.');
      }

      let subtotal = 0;

      for (const item of cart.items) {
        const variant = item.variant;

        if (!variant.isAvailable || variant.stockQuantity < item.quantity) {
          throw new HttpError(
            409,
            'INSUFFICIENT_STOCK',
            `Sản phẩm "${variant.product.name}" không đủ tồn kho.`,
            { variantId: variant.id, available: variant.stockQuantity },
          );
        }

        subtotal += variant.price * item.quantity;
      }

      const totalAmount = subtotal + SHIPPING_FEE;

      for (const item of cart.items) {
        const result = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            isAvailable: true,
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (result.count !== 1) {
          throw new HttpError(
            409,
            'INSUFFICIENT_STOCK',
            'Tồn kho vừa thay đổi. Vui lòng tải lại giỏ hàng.',
            { variantId: item.variantId },
          );
        }

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'OUT',
            quantity: item.quantity,
            reason: 'ORDER_PLACED',
          },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          orderCode: createOrderCode(),
          userId: req.user.id,
          status: 'PENDING_CONFIRMATION',
          paymentMethod: 'COD',
          paymentStatus: 'PENDING',
          subtotal,
          shippingFee: SHIPPING_FEE,
          totalAmount,
          recipientName: recipient,
          recipientPhone: phone,
          shippingAddress: fullAddress,
          note: typeof customerNote === 'string' ? customerNote.trim() : null,
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

    res.status(201).json({
      data: order,
      message: 'Đặt hàng thành công.',
    });
  }),
);

router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
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

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { reason } = req.body ?? {};

    if (!requiredText(reason)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do hủy.');
    }

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: { items: true },
      });

      if (!current) {
        throw new HttpError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      }

      if (!CANCELLABLE_STATUSES.includes(current.status)) {
        throw new HttpError(
          409,
          'ORDER_CANNOT_BE_CANCELLED',
          'Đơn hàng không thể hủy ở trạng thái hiện tại.',
        );
      }

      const nextStatus =
        current.paymentStatus === 'PAID' ? 'REFUND_PENDING' : 'CANCELLED';
      const nextPaymentStatus =
        current.paymentStatus === 'PAID' ? 'REFUND_PENDING' : current.paymentStatus;

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
          'ORDER_CANNOT_BE_CANCELLED',
          'Đơn hàng đã được cập nhật; vui lòng tải lại.',
        );
      }

      for (const item of current.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'ORDER_CANCELLED',
          },
        });
      }

      return tx.order.findUnique({
        where: { id: current.id },
        include: { items: true },
      });
    });

    res.json({ data: order, message: 'Đã hủy đơn hàng.' });
  }),
);

export default router;
