import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const result = await prisma.product.updateMany({
    where: {
      isActive: false,
      variants: {
        some: {
          sku: { startsWith: "CAT-" },
          price: { gt: 0 },
        },
      },
    },
    data: {
      isActive: true,
    },
  });

  console.log(`Đã bật hiển thị ${result.count} sản phẩm catalog.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
