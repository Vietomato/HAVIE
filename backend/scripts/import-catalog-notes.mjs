import "dotenv/config";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const file = new URL(
    "../data/catalog-source/HAVIE_Catalog/products.json",
    import.meta.url,
  );

  const products = JSON.parse(
    (await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""),
  );

  let added = 0;
  let existingNotes = 0;
  let skipped = 0;

  for (const item of products) {
    const excerpts = Array.isArray(item.specification_excerpts)
      ? item.specification_excerpts
          .filter((text) => typeof text === "string" && text.trim())
          .map((text) => text.trim())
      : [];

    if (!(item.havie_price_vnd > 0) || excerpts.length === 0) {
      skipped++;
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { slug: item.slug },
      select: { id: true },
    });

    if (!product) {
      skipped++;
      continue;
    }

    // ID ổn định để chạy lại không tạo trùng nhận xét.
    const id = "catalog-source-" + createHash("sha256")
      .update(item.catalog_id)
      .digest("hex");

    const existing = await prisma.productAdvisorNote.findUnique({
      where: { id },
      select: { id: true },
    });

    if (existing) {
      existingNotes++;
      continue;
    }

    if (apply) {
      await prisma.productAdvisorNote.create({
        data: {
          id,
          productId: product.id,
          variantId: null,
          content: excerpts.join("\n\n"),
          conditions: {
            sourceType: "catalog_source_excerpt",
            catalogId: item.catalog_id,
            sourceUrl: item.source_url,
            collectedOn: item.collected_on,
            originalLanguage: "not_verified",
            limitations: [
              "Mô tả từ nguồn, chưa được shop kiểm chứng",
              "Không mặc định áp dụng cho mọi biến thể",
              "Chưa đủ để kết luận phù hợp hoặc chọn size",
            ],
          },
          reviewStatus: "DRAFT",
          reviewedAt: null,
        },
      });
    }

    added++;
  }

  console.log(
    `${apply ? "Đã thêm" : "Có thể thêm"}: ${added} nhận xét nháp`,
  );
  console.log(`Nhận xét đã tồn tại, giữ nguyên: ${existingNotes}`);
  console.log(`Mục bỏ qua: ${skipped}`);

  if (!apply) console.log("Chỉ xem trước, chưa ghi database.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });