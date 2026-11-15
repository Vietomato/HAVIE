import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";

const prisma = new PrismaClient();
const file = new URL("../data/shared-catalog.json", import.meta.url);

const productFields = [
  "name",
  "slug",
  "isActive",
  "description",
  "imageUrls",
  "badge",
  "specs",
  "advisorEnabled",
];

const variantFields = [
  "sku",
  "name",
  "attributes",
  "price",
  "oldPrice",
  "stockQuantity",
  "isAvailable",
];

function pick(object, fields) {
  return Object.fromEntries(
    fields.map((field) => [field, object[field]]),
  );
}

function summarize(catalog) {
  return {
    categories: catalog.categories.length,
    brands: catalog.brands.length,
    products: catalog.products.length,
    variants: catalog.products.reduce(
      (total, product) => total + product.variants.length,
      0,
    ),
    advisorNotes: catalog.products.reduce(
      (total, product) => total + product.advisorNotes.length,
      0,
    ),
  };
}

async function exportCatalog() {
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const categories = await tx.category.findMany({
        select: { name: true, slug: true },
        orderBy: { slug: "asc" },
      });

      const brands = await tx.brand.findMany({
        select: { name: true, slug: true },
        orderBy: { slug: "asc" },
      });

      const products = await tx.product.findMany({
        include: {
          category: { select: { slug: true } },
          brand: { select: { slug: true } },
          variants: { orderBy: { sku: "asc" } },
          advisorNotes: {
            include: {
              variant: { select: { sku: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { slug: "asc" },
      });

      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        categories,
        brands,
        products: products.map((product) => ({
          ...pick(product, productFields),
          categorySlug: product.category.slug,
          brandSlug: product.brand.slug,
          variants: product.variants.map((variant) =>
            pick(variant, variantFields)
          ),
          advisorNotes: product.advisorNotes.map((note) => ({
            content: note.content,
            conditions: note.conditions,
            reviewStatus: note.reviewStatus,
            reviewedAt: note.reviewedAt?.toISOString() ?? null,
            variantSku: note.variant?.sku ?? null,
          })),
        })),
      };
    },
    {
      isolationLevel: "RepeatableRead",
      timeout: 120_000,
    },
  );

  await fs.mkdir(new URL("../data/", import.meta.url), {
    recursive: true,
  });

  await fs.writeFile(
    file,
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf8",
  );

  console.table(summarize(snapshot));
  console.log("Đã xuất: backend/data/shared-catalog.json");
  console.log("Không xuất tài khoản, đơn hàng hoặc lịch sử chat.");
}

function validateCatalog(catalog) {
  if (
    catalog?.schemaVersion !== 1 ||
    !Array.isArray(catalog.categories) ||
    !Array.isArray(catalog.brands) ||
    !Array.isArray(catalog.products) ||
    catalog.products.length === 0
  ) {
    throw new Error("File catalog không hợp lệ hoặc không có sản phẩm.");
  }

  const categorySlugs = new Set();
  const brandSlugs = new Set();
  const productSlugs = new Set();
  const skus = new Set();

  for (const [items, seen] of [
    [catalog.categories, categorySlugs],
    [catalog.brands, brandSlugs],
  ]) {
    for (const item of items) {
      if (
        typeof item.slug !== "string" ||
        !item.slug.trim() ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        seen.has(item.slug)
      ) {
        throw new Error("Danh mục hoặc thương hiệu thiếu dữ liệu/trùng slug.");
      }

      seen.add(item.slug);
    }
  }

  for (const product of catalog.products) {
    if (
      typeof product.slug !== "string" ||
      !product.slug.trim() ||
      typeof product.name !== "string" ||
      !product.name.trim() ||
      productSlugs.has(product.slug) ||
      !categorySlugs.has(product.categorySlug) ||
      !brandSlugs.has(product.brandSlug) ||
      !Array.isArray(product.variants) ||
      !Array.isArray(product.advisorNotes)
    ) {
      throw new Error(`Sản phẩm không hợp lệ: ${product.slug}`);
    }

    productSlugs.add(product.slug);
    const localSkus = new Set();

    for (const variant of product.variants) {
      if (
        typeof variant.sku !== "string" ||
        !variant.sku.trim() ||
        skus.has(variant.sku) ||
        !Number.isSafeInteger(variant.price) ||
        variant.price < 0 ||
        !Number.isSafeInteger(variant.stockQuantity) ||
        variant.stockQuantity < 0
      ) {
        throw new Error(`Biến thể không hợp lệ: ${variant.sku}`);
      }

      skus.add(variant.sku);
      localSkus.add(variant.sku);
    }

    for (const note of product.advisorNotes) {
      if (
        typeof note.content !== "string" ||
        !["DRAFT", "APPROVED", "REJECTED"].includes(note.reviewStatus) ||
        (note.variantSku !== null && !localSkus.has(note.variantSku)) ||
        (
          note.reviewedAt !== null &&
          !Number.isFinite(Date.parse(note.reviewedAt))
        )
      ) {
        throw new Error(`Ghi chú không hợp lệ: ${product.slug}`);
      }
    }
  }
}

async function importCatalog(apply) {
  const catalog = JSON.parse(
    (await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""),
  );

  validateCatalog(catalog);
  console.table(summarize(catalog));

  if (!apply) {
    console.log("Chỉ xem trước. Thêm --apply để nhập vào database trống.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Không ghi đè cửa hàng đã có dữ liệu.
      if (await tx.product.count()) {
        throw new Error(
          "Database đã có sản phẩm. Script chỉ nhập vào catalog trống; " +
          "chưa thay đổi dữ liệu.",
        );
      }

      const categoryMap = new Map();
      const brandMap = new Map();

      for (const category of catalog.categories) {
        const saved = await tx.category.upsert({
          where: { slug: category.slug },
          update: {},
          create: {
            name: category.name,
            slug: category.slug,
          },
        });

        categoryMap.set(category.slug, saved.id);
      }

      for (const brand of catalog.brands) {
        const saved = await tx.brand.upsert({
          where: { slug: brand.slug },
          update: {},
          create: {
            name: brand.name,
            slug: brand.slug,
          },
        });

        brandMap.set(brand.slug, saved.id);
      }

      for (const product of catalog.products) {
        const saved = await tx.product.create({
          data: {
            ...pick(product, productFields),
            categoryId: categoryMap.get(product.categorySlug),
            brandId: brandMap.get(product.brandSlug),

            // Không tạo đánh giá khách hàng giả.
            ratingAverage: 0,
            reviewCount: 0,

            variants: {
              create: product.variants.map((variant) => ({
                ...pick(variant, variantFields),
                attributes: variant.attributes ?? {},
              })),
            },
          },
          include: { variants: true },
        });

        const variantMap = new Map(
          saved.variants.map((variant) => [variant.sku, variant.id]),
        );

        for (const note of product.advisorNotes) {
          await tx.productAdvisorNote.create({
            data: {
              productId: saved.id,
              variantId: note.variantSku === null
                ? null
                : variantMap.get(note.variantSku),
              content: note.content,
              conditions: note.conditions ?? {},
              reviewStatus: note.reviewStatus,
              reviewedAt: note.reviewedAt
                ? new Date(note.reviewedAt)
                : null,
            },
          });
        }
      }
    },
    {
      isolationLevel: "Serializable",
      timeout: 120_000,
    },
  );

  console.log("Đã nhập catalog thành công.");
}

try {
  const command = process.argv[2];

  if (command === "export") {
    await exportCatalog();
  } else if (command === "import") {
    await importCatalog(process.argv.includes("--apply"));
  } else {
    throw new Error(
      "Dùng: node scripts/share-catalog.mjs export\n" +
      "Hoặc: node scripts/share-catalog.mjs import [--apply]",
    );
  }
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}