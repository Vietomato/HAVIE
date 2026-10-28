import { Router } from 'express';
import prisma from '../config/prisma.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const router = Router();

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          attributes: true,
          price: true,
          oldPrice: true,
          stockQuantity: true,
          isAvailable: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              imageUrls: true,
              category: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    },
  },
};

async function getOrCreateCart(db, userId) {
  return db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: cartInclude,
  });
}

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(prisma, req.user.id);

    res.json({
      data: cart,
      message: 'Lấy giỏ hàng thành công.',
    });
  }),
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const { variantId, quantity } = req.body ?? {};

    if (typeof variantId !== 'string' || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'variantId và quantity hợp lệ là bắt buộc.',
      );
    }

    const cart = await prisma.$transaction(async (tx) => {
      const currentCart = await tx.cart.upsert({
        where: { userId: req.user.id },
        update: {},
        create: { userId: req.user.id },
      });

      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          isAvailable: true,
          stockQuantity: true,
        },
      });

      if (!variant || !variant.isAvailable) {
        throw new HttpError(
          404,
          'VARIANT_NOT_FOUND',
          'Biến thể không tồn tại hoặc đã ngừng bán.',
        );
      }

      const existingItem = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: currentCart.id,
            variantId,
          },
        },
      });

      const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

      if (nextQuantity > variant.stockQuantity) {
        throw new HttpError(
          409,
          'INSUFFICIENT_STOCK',
          'Số lượng tồn kho không đủ.',
          { available: variant.stockQuantity },
        );
      }

      await tx.cartItem.upsert({
        where: {
          cartId_variantId: {
            cartId: currentCart.id,
            variantId,
          },
        },
        create: {
          cartId: currentCart.id,
          variantId,
          quantity: nextQuantity,
        },
        update: { quantity: nextQuantity },
      });

      return getOrCreateCart(tx, req.user.id);
    });

    res.json({ data: cart, message: 'Đã thêm sản phẩm vào giỏ hàng.' });
  }),
);

router.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const { quantity } = req.body ?? {};

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'quantity phải là số nguyên không âm.',
      );
    }

    const cart = await prisma.$transaction(async (tx) => {
      const userCart = await tx.cart.findUnique({
        where: { userId: req.user.id },
      });

      if (!userCart) {
        throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
      }

      const item = await tx.cartItem.findFirst({
        where: { id: req.params.id, cartId: userCart.id },
        include: { variant: true },
      });

      if (!item) {
        throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
      }

      if (quantity === 0) {
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        if (!item.variant.isAvailable) {
          throw new HttpError(409, 'VARIANT_UNAVAILABLE', 'Biến thể đã ngừng bán.');
        }

        if (quantity > item.variant.stockQuantity) {
          throw new HttpError(
            409,
            'INSUFFICIENT_STOCK',
            'Số lượng tồn kho không đủ.',
            { available: item.variant.stockQuantity },
          );
        }

        await tx.cartItem.update({
          where: { id: item.id },
          data: { quantity },
        });
      }

      return getOrCreateCart(tx, req.user.id);
    });

    res.json({ data: cart, message: 'Đã cập nhật giỏ hàng.' });
  }),
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const cart = await prisma.$transaction(async (tx) => {
      const userCart = await tx.cart.findUnique({
        where: { userId: req.user.id },
      });

      if (!userCart) {
        throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
      }

      const result = await tx.cartItem.deleteMany({
        where: {
          id: req.params.id,
          cartId: userCart.id,
        },
      });

      if (result.count === 0) {
        throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
      }

      return getOrCreateCart(tx, req.user.id);
    });

    res.json({ data: cart, message: 'Đã xóa sản phẩm khỏi giỏ hàng.' });
  }),
);

export default router;
