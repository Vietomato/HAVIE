import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Chỉ những model có danh sách size cụ thể đã đối chiếu.
const confirmed = [
  {
    slug: "victor-au-p8500ii-a",
    sizes: [38, 39, 40, 41, 42, 43, 44],
    color: "Trắng",
    sourceUrl:
      "https://shopvnb.com/giay-cau-long-victor-p8500ii-a.html",
  },
  {
    slug: "victor-au-p8500ii-c",
    sizes: [38, 39, 40, 41, 42, 43, 44],
    color: "Đen",
    sourceUrl:
      "https://shopvnb.com/giay-cau-long-victor-p8500ii-c.html",
  },
  {
    slug: "victor-au-p9200tty-nlite",
    sizes: [40, 41, 42, 43, 44],
    sourceUrl:
      "https://hvshop.vn/giay-cau-long-victor-p9200tty-nlite/",
  },
];

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      slug: { in: confirmed.map((item) => item.slug) },
      brand: { slug: "victor" },
      category: { slug: "shoes" },
    },
    include: { variants: true },
  });

  const additions = [];
  const placeholders = [];
  const skipped = [];

  for (const config of confirmed) {
    const product = products.find(
      (item) => item.slug === config.slug,
    );

    if (!product) {
      skipped.push({
        slug: config.slug,
        reason: "Không tìm thấy sản phẩm theo slug.",
      });
      continue;
    }

    // Lấy giá hiện tại của bản ghi catalog gốc.
    const base = product.variants.find(
      (variant) =>
        variant.sku.startsWith("CAT-") &&
        variant.name.trim().toLowerCase() === "default title" &&
        Number.isSafeInteger(variant.price) &&
        variant.price > 0,
    );

    if (!base) {
      skipped.push({
        slug: config.slug,
        reason: "Không có biến thể catalog gốc với giá hợp lệ.",
      });
      continue;
    }

    const baseAttributes = isObject(base.attributes)
      ? base.attributes
      : {};

    let conflict = false;
    const productAdditions = [];

    for (const size of config.sizes) {
      const existing = product.variants.some((variant) => {
        const attributes = isObject(variant.attributes)
          ? variant.attributes
          : {};

        return (
          String(attributes.sizeSystem).toUpperCase() === "EU" &&
          Number(attributes.size) === size
        );
      });

      if (existing) continue;

      const sku = `CAT-VICTOR-SIZE-${product.id}-EU-${size}`;

      if (product.variants.some((variant) => variant.sku === sku)) {
        skipped.push({
          slug: config.slug,
          reason: `SKU ${sku} đã tồn tại nhưng size không khớp.`,
        });
        conflict = true;
        break;
      }

      const attributes = {
        ...baseAttributes,
        size: String(size),
        sizeSystem: "EU",
        sizeLabel: `EU ${size}`,
        sizeSourceUrl: config.sourceUrl,
        sizeNormalizationBasis: "exact_product_listed_sizes",
        inventorySource: "project_demo",
      };

      // Không kế thừa thông số tư vấn của một biến thể khác.
      delete attributes.advisor;

      if (config.color) {
        attributes.color = config.color;
      }

      productAdditions.push({
        productName: product.name,
        data: {
          productId: product.id,
          sku,
          name: config.color
            ? `EU ${size} / ${config.color}`
            : `EU ${size}`,
          price: base.price,
          oldPrice: base.oldPrice,
          attributes,
          stockQuantity: 20,
          isAvailable: true,
        },
      });
    }

    if (conflict) continue;

    additions.push(...productAdditions);

    // Giữ ID cũ cho giỏ/đơn hàng, nhưng không bán bản ghi thiếu size.
    placeholders.push(base.id);
  }

  console.table(
    additions.map((item) => ({
      product: item.productName,
      variant: item.data.name,
      price: item.data.price,
      demoStock: item.data.stockQuantity,
    })),
  );

  console.log("Biến thể cần thêm:", additions.length);
  console.log("Bản ghi Default Title cần ngừng dùng:", placeholders.length);

  if (skipped.length) {
    console.table(skipped);
  }

  if (!apply) {
    console.log("Chỉ xem trước, chưa ghi database.");
    return;
  }

  await fs.mkdir("./migration-repair", { recursive: true });

  const backupPath =
    `./migration-repair/before-victor-sizes-${Date.now()}.json`;

  await fs.writeFile(
    backupPath,
    JSON.stringify({ products, additions }, null, 2),
    "utf8",
  );

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;

    if (additions.length) {
      const inserted = await tx.productVariant.createMany({
        data: additions.map((item) => item.data),
      });
      created = inserted.count;
    }

    let retired = 0;

    if (placeholders.length) {
      const updated = await tx.productVariant.updateMany({
        where: {
          id: { in: placeholders },
          isAvailable: true,
        },
        data: { isAvailable: false },
      });
      retired = updated.count;
    }

    return { created, retired };
  });

  console.log("Kết quả:", result);
  console.log("Bản chụp trước thay đổi:", backupPath);
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());