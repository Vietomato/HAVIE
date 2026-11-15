import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const slugs = [
  "victor-au-p8500ii-a",
  "victor-au-p8500ii-c",
  "victor-au-p9200tty-nlite",
];

async function main() {
  const products = await prisma.product.findMany({
    where: {
      slug: { in: slugs },
      brand: { slug: "victor" },
      category: { slug: "shoes" },
    },
    include: { variants: true },
  });

  const ids = [];

  for (const product of products) {
    const hasSizedVariant = product.variants.some((variant) => {
      const attributes = variant.attributes;
      return (
        attributes?.sizeSystem === "EU" &&
        Number(attributes.size) > 0 &&
        variant.isAvailable &&
        variant.stockQuantity > 0
      );
    });

    if (!hasSizedVariant) {
      console.log(`Bỏ qua vì chưa có size bán được: ${product.name}`);
      continue;
    }

    for (const variant of product.variants) {
      if (variant.name.trim().toLowerCase() === "default title") {
        ids.push(variant.id);
        console.log("Biến thể cần xóa:", product.name, variant.sku);
      }
    }
  }

  if (!apply) {
    console.log(`Tìm thấy ${ids.length} biến thể Default Title.`);
    console.log("Chỉ xem trước. Thêm --apply để thực hiện.");
    return;
  }

  let deleted = 0;
  let retained = 0;

  for (const id of ids) {
    const result = await prisma.$transaction(async (tx) => {
      // Không xóa bản ghi đang được tham chiếu.
      const removed = await tx.productVariant.deleteMany({
        where: {
          id,
          cartItems: { none: {} },
          orderItems: { none: {} },
          movements: { none: {} },
          advisorNotes: { none: {} },
        },
      });

      if (removed.count) return "deleted";

      await tx.productVariant.updateMany({
        where: { id },
        data: { isAvailable: false },
      });

      return "retained";
    });

    if (result === "deleted") deleted++;
    else retained++;
  }

  console.log("Đã xóa:", deleted);
  console.log("Giữ do có liên kết, đã tắt bán:", retained);
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());