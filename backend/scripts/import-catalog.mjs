import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = {
  rackets: "Vợt cầu lông",
  shoes: "Giày cầu lông",
  apparel: "Trang phục",
  accessories: "Phụ kiện",
};

const brands = {
  yonex: "Yonex",
  lining: "Li-Ning",
  victor: "Victor",
  mizuno: "Mizuno",
  havie: "HAVIE",
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const file = args.find((arg) => !arg.startsWith("--"));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function main() {
  check(file, "Cần truyền đường dẫn file JSON.");

  const raw = await fs.readFile(path.resolve(file), "utf8");
  const products = JSON.parse(raw.replace(/^\uFEFF/, ""));

  check(Array.isArray(products), "File phải chứa mảng sản phẩm.");

  const slugs = new Set();
  const skus = new Set();

  // Kiểm tra toàn bộ file trước khi ghi database.
  for (const item of products) {
    check(isText(item.name), "Thiếu tên sản phẩm.");
    check(isText(item.slug), `Thiếu slug: ${item.name}`);
    check(!slugs.has(item.slug), `Trùng slug: ${item.slug}`);
    slugs.add(item.slug);

    check(
      Object.hasOwn(categories, item.categorySlug),
      `Danh mục không hợp lệ: ${item.name}`,
    );

    check(
      Object.hasOwn(brands, item.brandSlug),
      `Hãng không hợp lệ: ${item.name}`,
    );

    check(
      Array.isArray(item.variants) && item.variants.length > 0,
      `Thiếu biến thể: ${item.name}`,
    );

    for (const field of ["imageUrls", "specs"]) {
      check(
        item[field] === undefined ||
          (
            Array.isArray(item[field]) &&
            item[field].every((value) => typeof value === "string")
          ),
        `${field} phải là mảng chuỗi: ${item.name}`,
      );
    }

    for (const variant of item.variants) {
      check(isText(variant.sku), `Thiếu SKU: ${item.name}`);
      check(isText(variant.name), `Thiếu tên biến thể: ${item.name}`);
      check(!skus.has(variant.sku), `Trùng SKU: ${variant.sku}`);
      skus.add(variant.sku);

      check(
        Number.isSafeInteger(variant.price) && variant.price > 0,
        `Giá phải là số nguyên VND dương: ${variant.sku}`,
      );

      check(
        variant.oldPrice == null ||
          (
            Number.isSafeInteger(variant.oldPrice) &&
            variant.oldPrice >= 0
          ),
        `Giá cũ không hợp lệ: ${variant.sku}`,
      );

      check(
        variant.stockQuantity === undefined ||
          (
            Number.isSafeInteger(variant.stockQuantity) &&
            variant.stockQuantity >= 0
          ),
        `Tồn kho không hợp lệ: ${variant.sku}`,
      );

      check(
        variant.attributes === undefined ||
          (
            variant.attributes !== null &&
            typeof variant.attributes === "object" &&
            !Array.isArray(variant.attributes)
          ),
        `attributes phải là object: ${variant.sku}`,
      );
    }
  }

  const existing = await prisma.product.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true },
  });

  const existingSlugs = new Set(existing.map((item) => item.slug));
  const additions = products.filter(
    (item) => !existingSlugs.has(item.slug),
  );

  // Không cho SKU của sản phẩm mới trùng SKU đang có.
  const collisions = await prisma.productVariant.findMany({
    where: {
      sku: {
        in: additions.flatMap((item) =>
          item.variants.map((variant) => variant.sku),
        ),
      },
    },
    select: { sku: true },
  });

  check(
    collisions.length === 0,
    `SKU đã tồn tại: ${collisions.map((item) => item.sku).join(", ")}`,
  );

  console.table(products.map((item) => ({
    ten: item.name,
    loai: item.categorySlug,
    hang: item.brandSlug,
    xuLy: existingSlugs.has(item.slug)
      ? "Giữ nguyên sản phẩm cũ"
      : "Thêm sản phẩm mới",
  })));

  console.log(`Sản phẩm mới: ${additions.length}`);
  console.log(`Sản phẩm cũ giữ nguyên: ${existingSlugs.size}`);

  if (!apply) {
    console.log("Đang xem trước. Chưa ghi dữ liệu.");
    console.log("Thêm --apply vào lệnh để nhập.");
    return;
  }

  if (additions.length === 0) {
    console.log("Không có sản phẩm mới để nhập.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of additions) {
      const category = await tx.category.upsert({
        where: { slug: item.categorySlug },
        update: {},
        create: {
          slug: item.categorySlug,
          name: categories[item.categorySlug],
        },
      });

      const brand = await tx.brand.upsert({
        where: { slug: item.brandSlug },
        update: {},
        create: {
          slug: item.brandSlug,
          name: brands[item.brandSlug],
        },
      });

      await tx.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          categoryId: category.id,
          brandId: brand.id,
          imageUrls: item.imageUrls ?? [],
          specs: item.specs ?? [],
          badge: item.badge ?? null,

          // Sản phẩm mới cần được kiểm duyệt trước khi tư vấn.
        isActive: false,
          advisorEnabled: false,

          variants: {
            create: item.variants.map((variant) => {
              const attributes = structuredClone(
                variant.attributes ?? {},
              );

              // File nhập không tự cấp trạng thái duyệt.
              delete attributes.advisor;

              return {
                sku: variant.sku,
                name: variant.name,
                attributes,
                price: variant.price,
                oldPrice: variant.oldPrice ?? null,
                stockQuantity: variant.stockQuantity ?? 0,
                isAvailable: variant.isAvailable === true,
              };
            }),
          },
        },
      });
    }
  }, {
    maxWait: 5000,
    timeout: 60000,
  });

  console.log(`Đã thêm ${additions.length} sản phẩm.`);
  console.log("Sản phẩm mới chưa bật tư vấn.");
}

main()
  .catch((error) => {
    console.error("Nhập thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });