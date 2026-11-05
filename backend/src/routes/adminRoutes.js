import { Router } from "express";
import multer from "multer";
import prisma from "../config/prisma.js";
import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import {
  validateAdminOrderTransition,
  validateProductPayload,
} from "../utils/adminValidation.js";
import { MAX_IMAGE_BYTES, saveImage } from "../services/imageStorage.js";

const router = Router();

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  variants: { orderBy: { createdAt: "asc" } },
};

const parseImageField = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single("image");

router.use(authMiddleware, requireAdmin);

function receiveImage(req, res, next) {
  parseImageField(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(
        new HttpError(413, "IMAGE_TOO_LARGE", "Ảnh không được vượt quá 5MB."),
      );
    }
    next(new HttpError(400, "INVALID_IMAGE", "Dữ liệu ảnh tải lên không hợp lệ."));
  });
}

function handleUniqueConflict(error) {
  if (error?.code === "P2002") {
    throw new HttpError(
      409,
      "DUPLICATE_PRODUCT_DATA",
      "Slug hoặc SKU đã được sử dụng.",
    );
  }
  throw error;
}

async function validateRelations(tx, product) {
  const [category, brand] = await Promise.all([
    product.categoryId
      ? tx.category.findUnique({ where: { id: product.categoryId } })
      : true,
    product.brandId
      ? tx.brand.findUnique({ where: { id: product.brandId } })
      : true,
  ]);
  if (!category)
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục.");
  if (!brand)
    throw new HttpError(404, "BRAND_NOT_FOUND", "Không tìm thấy thương hiệu.");
}

router.post(
  "/uploads",
  receiveImage,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "INVALID_IMAGE", "Vui lòng chọn một ảnh.");
    }
    const url = await saveImage(req.file.buffer);
    res.status(201).json({ data: { url }, message: "Đã tải ảnh lên." });
  }),
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      include: productInclude,
      orderBy: { updatedAt: "desc" },
    });
    res.json({ data: products });
  }),
);

router.post(
  "/products",
  asyncHandler(async (req, res) => {
    const product = validateProductPayload(req.body);
    try {
      const created = await prisma.$transaction(async (tx) => {
        await validateRelations(tx, product);
        const { variants, ...fields } = product;
        const result = await tx.product.create({
          data: {
            ...fields,
            variants: {
              create: variants,
            },
          },
          include: productInclude,
        });
        const initialMovements = result.variants
          .filter(({ stockQuantity }) => stockQuantity > 0)
          .map(({ id, stockQuantity }) => ({
            variantId: id,
            type: "IN",
            quantity: stockQuantity,
            reason: "PRODUCT_CREATED",
          }));
        if (initialMovements.length) {
          await tx.stockMovement.createMany({ data: initialMovements });
        }
        return result;
      });
      res.status(201).json({ data: created, message: "Đã thêm sản phẩm." });
    } catch (error) {
      handleUniqueConflict(error);
    }
  }),
);

router.patch(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = validateProductPayload(req.body, { partial: true });
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({
          where: { id: req.params.id },
          include: { variants: true },
        });
        if (!current)
          throw new HttpError(
            404,
            "PRODUCT_NOT_FOUND",
            "Không tìm thấy sản phẩm.",
          );
        await validateRelations(tx, product);

        const { variants, ...fields } = product;
        if (Object.keys(fields).length) {
          await tx.product.update({ where: { id: current.id }, data: fields });
        }

        if (variants) {
          const currentVariants = new Map(
            current.variants.map((variant) => [variant.id, variant]),
          );
          for (const variant of variants) {
            const { id, ...variantFields } = variant;
            if (id && !currentVariants.has(id)) {
              throw new HttpError(
                400,
                "INVALID_VARIANT",
                "Biến thể không thuộc sản phẩm đang sửa.",
              );
            }

            const skuOwner = await tx.productVariant.findUnique({
              where: { sku: variant.sku },
              select: { id: true },
            });
            if (skuOwner && skuOwner.id !== id) {
              throw new HttpError(409, "DUPLICATE_SKU", "SKU đã được sử dụng.");
            }

            if (id) {
              const previous = currentVariants.get(id);
              const result = await tx.productVariant.updateMany({
                where: {
                  id,
                  productId: current.id,
                  stockQuantity: previous.stockQuantity,
                },
                data: variantFields,
              });
              if (result.count !== 1) {
                throw new HttpError(
                  409,
                  "STOCK_CHANGED",
                  "Tồn kho vừa được cập nhật. Tải lại sản phẩm rồi thử lại.",
                );
              }
              const difference = variant.stockQuantity - previous.stockQuantity;
              if (difference !== 0) {
                await tx.stockMovement.create({
                  data: {
                    variantId: id,
                    type: difference > 0 ? "IN" : "OUT",
                    quantity: Math.abs(difference),
                    reason: "PRODUCT_STOCK_ADJUSTMENT",
                  },
                });
              }
            } else {
              const created = await tx.productVariant.create({
                data: { ...variantFields, productId: current.id },
              });
              if (created.stockQuantity > 0) {
                await tx.stockMovement.create({
                  data: {
                    variantId: created.id,
                    type: "IN",
                    quantity: created.stockQuantity,
                    reason: "PRODUCT_VARIANT_CREATED",
                  },
                });
              }
            }
          }

          const retainedIds = variants.flatMap(({ id }) => (id ? [id] : []));
          await tx.productVariant.updateMany({
            where: {
              productId: current.id,
              ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
            },
            data: { isAvailable: false },
          });
        }

        return tx.product.findUnique({
          where: { id: current.id },
          include: productInclude,
        });
      });
      res.json({ data: updated, message: "Đã cập nhật sản phẩm." });
    } catch (error) {
      handleUniqueConflict(error);
    }
  }),
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      include: {
        items: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: orders });
  }),
);

router.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const { status, reason } = req.body ?? {};
    if (typeof status !== "string") {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Trạng thái đơn hàng không hợp lệ.",
      );
    }
    if (
      status === "CANCELLED" &&
      (typeof reason !== "string" || !reason.trim())
    ) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Vui lòng nhập lý do hủy đơn.",
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!current)
        throw new HttpError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
      validateAdminOrderTransition(current.status, status);

      const paymentStatus =
        status === "CANCELLED" && current.paymentStatus === "PAID"
          ? "REFUND_PENDING"
          : status === "COMPLETED" && current.paymentMethod === "COD"
            ? "PAID"
            : current.paymentStatus;
      const updateData = {
        status,
        paymentStatus,
        ...(status === "CANCELLED" ? { cancelReason: reason.trim() } : {}),
        ...(status === "COMPLETED" && current.paymentMethod === "COD"
          ? { paidAt: new Date() }
          : {}),
      };
      const claim = await tx.order.updateMany({
        where: { id: current.id, status: current.status },
        data: updateData,
      });
      if (claim.count !== 1) {
        throw new HttpError(
          409,
          "ORDER_UPDATED",
          "Đơn hàng vừa được cập nhật; vui lòng tải lại.",
        );
      }

      if (status === "CANCELLED") {
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
      }

      return tx.order.findUnique({
        where: { id: current.id },
        include: {
          items: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      });
    });

    res.json({ data: order, message: "Đã cập nhật trạng thái đơn hàng." });
  }),
);

export default router;
