import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  console.log({
    NODE_ENV: process.env.NODE_ENV ?? "(chưa đặt)",
    ADVISOR_CATALOG_PREVIEW:
      process.env.ADVISOR_CATALOG_PREVIEW ?? "(chưa đặt)",
  });

  const products = await prisma.product.findMany({
    where: {
      category: { slug: "rackets" },
      brand: { slug: "victor" },
      variants: {
        some: { price: { gt: 0, lte: 2000000 } },
      },
    },
    select: {
      name: true,
      isActive: true,
      advisorEnabled: true,
      variants: {
        where: { price: { gt: 0, lte: 2000000 } },
        select: {
          sku: true,
          price: true,
          stockQuantity: true,
          isAvailable: true,
          attributes: true,
        },
      },
    },
  });

  console.log("Số sản phẩm Victor có giá không quá 2 triệu:", products.length);

  console.table(
    products.flatMap((product) =>
      product.variants.map((variant) => ({
        name: product.name,
        sku: variant.sku,
        price: variant.price,
        stock: variant.stockQuantity,
        available: variant.isAvailable,
        active: product.isActive,
        advisorEnabled: product.advisorEnabled,
        referenceCurrency:
          variant.attributes?.marketPriceReference?.currency ?? "(thiếu)",
      })),
    ),
  );
} finally {
  await prisma.$disconnect();
}
