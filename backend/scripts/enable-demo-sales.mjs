import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const invalidPrices = await prisma.productVariant.count({
    where: { price: { lte: 0 } },
  });

  if (invalidPrices > 0) {
    throw new Error(
      `Có ${invalidPrices} biến thể chưa có giá hợp lệ. Cần bổ sung giá trước.`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const products = await tx.product.updateMany({
      where: { isActive: false },
      data: { isActive: true },
    });

    const restocked = await tx.productVariant.updateMany({
      where: { stockQuantity: { lte: 0 } },
      data: { stockQuantity: 100 },
    });

    const variants = await tx.productVariant.updateMany({
      where: { isAvailable: false },
      data: { isAvailable: true },
    });

    return {
      productsPublished: products.count,
      variantsRestocked: restocked.count,
      variantsEnabled: variants.count,
    };
  });

  console.log("Đã bật bán dữ liệu demo:");
  console.table(result);

  console.log({
    hiddenProducts: await prisma.product.count({
      where: { isActive: false },
    }),
    unavailableVariants: await prisma.productVariant.count({
      where: { isAvailable: false },
    }),
    outOfStockVariants: await prisma.productVariant.count({
      where: { stockQuantity: { lte: 0 } },
    }),
  });
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
