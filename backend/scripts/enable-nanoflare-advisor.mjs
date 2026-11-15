import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const productId = "47df1bb9-a4c0-4e98-997a-5f3f52be8592";

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm. Chưa thay đổi dữ liệu.");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { advisorEnabled: true },
    select: {
      id: true,
      name: true,
      advisorEnabled: true,
    },
  });

  console.log(JSON.stringify(updated, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
