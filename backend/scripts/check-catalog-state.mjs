import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      variants: {
        select: {
          sku: true,
          price: true,
          stockQuantity: true,
          isAvailable: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("Tổng sản phẩm:", products.length);

  console.log("\nSẢN PHẨM KHÔNG CÓ SKU CAT-:");
  console.table(
    products
      .filter((p) => !p.variants.some((v) => v.sku.startsWith("CAT-")))
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        variants: p.variants.length,
        prices: p.variants.map((v) => v.price).join(", "),
        available: p.variants.filter((v) => v.isAvailable).length,
      })),
  );

  const variants = products.flatMap((p) => p.variants);

  console.log("\nTHỐNG KÊ BIẾN THỂ:");
  console.log({
    total: variants.length,
    invalidPrice: variants.filter(
      (v) => !Number.isSafeInteger(v.price) || v.price <= 0,
    ).length,
    unavailable: variants.filter((v) => !v.isAvailable).length,
  });
} finally {
  await prisma.$disconnect();
}
