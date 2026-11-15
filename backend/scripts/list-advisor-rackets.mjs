import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const products = await prisma.product.findMany({
    where: {
      category: { slug: "rackets" },
    },
    select: {
      id: true,
      name: true,
      advisorEnabled: true,
      variants: {
        select: {
          id: true,
          name: true,
          attributes: true,
          price: true,
          stockQuantity: true,
          isAvailable: true,
        },
        orderBy: { sku: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  console.log(JSON.stringify(products, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
