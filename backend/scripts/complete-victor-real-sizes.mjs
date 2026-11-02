import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const tiara = "https://www.tiarasporting.com/products/";

const configs = [
  {
    model: "p9200chp-ag",
    system: "EU",
    sizes: [40, 40.5, 41],
    source:
      "https://canproshop.com/products/victor-p9200chp-badminton-shoes",
  },
  {
    model: "p8500nlite-at",
    system: "EU",
    sizes: [39, 40, 41, 42, 43, 44, 45],
    source:
      "https://shopvnb.com/giay-cau-long-victor-p8500nlite-at.html",
  },
  {
    model: "p8500nlite-bm",
    system: "EU",
    sizes: [39, 40, 41, 42, 43, 44],
    source:
      "https://shopvnb.com/giay-cau-long-victor-p8500-nl-bm.html",
  },
  {
    model: "a970nitrolite-cps-i",
    system: "EU",
    sizes: [39.5, 40.5, 42, 43, 44, 45, 46],
    source:
      tiara + "victor-a970nitrolite-cps-i-badminton-shoes-pink",
  },
  {
    model: "a970nitrolite-cps-j",
    system: "EU",
    sizes: [39.5, 40.5, 42, 44, 45, 46],
    source:
      tiara + "victor-a970nitrolite-cps-j-badminton-shoes-purple",
  },
  {
    model: "a970nitrolite-cps-l",
    system: "EU",
    sizes: [
      37, 37.5, 38, 39, 39.5, 40, 40.5,
      41, 42, 43, 44, 44.5, 45, 45.5, 46,
    ],
    source:
      "https://badmintonmart.com.au/products/" +
      "victor-capsule-collection-a970nitrolite-cps-badminton-shoes-white-unisex",
  },
  {
    model: "a970nitrolite-cps-m",
    system: "EU",
    sizes: [40, 41, 43, 44.5, 45.5],
    source:
      tiara + "victor-a970nitrolite-cps-m-badminton-shoes-iceberg",
  },
  {
    model: "s82iiinitrolite-l",
    system: "EU",
    sizes: [
      37, 37.5, 38, 39, 39.5, 40, 40.5,
      41, 42, 43, 44, 44.5, 45, 45.5,
    ],
    source:
      tiara + "victor-s82iiinitrolite-l-badminton-shoes-lunar-white",
  },
  {
    model: "a970ace-u",
    system: "EU",
    sizes: [35, 36, 37, 37.5, 38, 39, 39.5, 40, 40.5],
    source:
      "https://t1sports.net/products/victor-a970ace-u-blue-court-shoes",
  },
  {
    model: "a970ace-m",
    system: "CM",
    sizes: [
      25, 25.5, 26, 26.5, 27, 27.5,
      28, 28.5, 29, 29.5, 30,
    ],
    source:
      "https://www.victorsports.my/product/" +
      "victor-a970ace-lee-zii-jia-badminton-shoes",
  },
  {
    model: "a970ace-c",
    system: "EU",
    sizes: [37, 38, 39, 40, 41, 42, 43, 44, 45],
    source:
      "https://shopvnb.com/giay-cau-long-victor-a970ace.html",
  },
];

const DEMO_STOCK = 20;

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isPlaceholder(variant) {
  return /^default title$/i.test(variant.name.trim());
}

function sizeKey(system, size) {
  return `${String(system).toUpperCase()}:${Number(size)}`;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: configs.map((config) => `victor-au-${config.model}`),
      },
      brand: { slug: "victor" },
      category: { slug: "shoes" },
    },
    include: { variants: true },
  });

  const additions = [];
  const retireIds = [];
  const summary = [];

  for (const config of configs) {
    const slug = `victor-au-${config.model}`;
    const product = products.find((item) => item.slug === slug);

    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm: ${slug}`);
    }

    // Ưu tiên giá từ bản ghi catalog gốc.
    const priced = product.variants.filter(
      (variant) =>
        Number.isSafeInteger(variant.price) &&
        variant.price > 0,
    );

    const base =
      priced.find(isPlaceholder) ||
      priced.find((variant) => variant.sku.startsWith("CAT-")) ||
      priced[0];

    if (!base) {
      throw new Error(`Sản phẩm chưa có giá hợp lệ: ${product.name}`);
    }

    const existingSizes = new Set();

    for (const variant of product.variants) {
      const attributes = isObject(variant.attributes)
        ? variant.attributes
        : {};

      if (
        attributes.size != null &&
        ["EU", "US", "UK", "CM"].includes(
          String(attributes.sizeSystem).toUpperCase(),
        )
      ) {
        existingSizes.add(
          sizeKey(attributes.sizeSystem, attributes.size),
        );
      }
    }

    const baseAttributes = isObject(base.attributes)
      ? structuredClone(base.attributes)
      : {};

    // Không cấp thông số tư vấn đã duyệt cho size mới.
    delete baseAttributes.advisor;

    // Xóa các trường size kế thừa; sẽ điền theo nguồn mới.
    for (const key of [
      "size", "sizeSystem", "sizeLabel",
      "sizeEU", "sizeUK", "sizeUSMen",
      "sizeUSWomen", "sizeCM", "sizeGender",
      "sizeSourceUrl", "sizeChartUrl",
      "sizeNormalizationBasis", "demoData",
    ]) {
      delete baseAttributes[key];
    }

    let newCount = 0;

    for (const size of config.sizes) {
      const key = sizeKey(config.system, size);

      if (existingSizes.has(key)) continue;

      const sku =
        `CAT-VICTOR-REAL-${product.id}-${config.system}-${size}`;

      if (product.variants.some((variant) => variant.sku === sku)) {
        throw new Error(`SKU đã tồn tại nhưng size không khớp: ${sku}`);
      }

      additions.push({
        productName: product.name,
        data: {
          productId: product.id,
          sku,
          name: `${config.system} ${size}`,
          price: base.price,
          oldPrice: base.oldPrice,
          stockQuantity: DEMO_STOCK,
          isAvailable: true,
          attributes: {
            ...baseAttributes,
            size: String(size),
            sizeSystem: config.system,
            sizeLabel: `${config.system} ${size}`,
            sizeSourceUrl: config.source,
            sizeNormalizationBasis:
              "exact_model_listed_size_options",
            sizeSourceCheckedOn: "2026-11-02",
            inventorySource: "project_demo",
            priceBasis: "copied_from_existing_product_variant",
          },
        },
      });

      existingSizes.add(key);
      newCount++;
    }

    // Không xóa ID cũ vì có thể đang được đơn hàng tham chiếu.
    // Sau khi có size thay thế, ngừng bán bản ghi không có size.
    for (const variant of product.variants) {
      if (isPlaceholder(variant)) {
        retireIds.push(variant.id);
      }
    }

    summary.push({
      product: product.name,
      system: config.system,
      listedSizes: config.sizes.join(", "),
      newVariants: newCount,
      price: base.price,
    });
  }

  // Kiểm tra SKU trên toàn database trước khi ghi.
  if (additions.length) {
    const collisions = await prisma.productVariant.count({
      where: {
        sku: { in: additions.map((item) => item.data.sku) },
      },
    });

    if (collisions) {
      throw new Error("Có SKU bị trùng. Chưa cập nhật database.");
    }
  }

  console.table(summary);
  console.log("Sản phẩm đã kiểm tra:", summary.length);
  console.log("Biến thể cần thêm:", additions.length);

  if (!apply) {
    console.log("Chỉ xem trước. Chưa ghi database.");
    return;
  }

  await fs.mkdir("./migration-repair", { recursive: true });

  const backupPath =
    `./migration-repair/before-victor-completion-${Date.now()}.json`;

  await fs.writeFile(
    backupPath,
    JSON.stringify({ products, additions, configs }, null, 2),
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

    const retired = await tx.productVariant.updateMany({
      where: {
        id: { in: retireIds },
        isAvailable: true,
      },
      data: { isAvailable: false },
    });

    return {
      created,
      placeholdersRetired: retired.count,
    };
  });

  console.log("Đã cập nhật:", result);
  console.log("Bản chụp trước thay đổi:", backupPath);
  console.log("Giá và tồn kho của biến thể cũ được giữ nguyên.");
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());