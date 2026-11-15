import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const root = new URL(
  "../data/catalog-source/HAVIE_Catalog/",
  import.meta.url,
);

// Bảng đối chiếu US nam -> EU của Yonex.
// Chỉ đối chiếu size nguồn đã có, không tạo thêm size.
const euByUsMen = new Map([
  [4, 35],
  [4.5, 36],
  [5, 37],
  [5.5, 37.5],
  [6, 38],
  [6.5, 39],
  [7, 39.5],
  [7.5, 40],
  [8, 40.5],
  [8.5, 41],
  [9, 42],
  [9.5, 43],
  [10, 44],
  [10.5, 44.5],
  [11, 45],
  [11.5, 45.5],
  [12, 46],
  [13, 47],
]);

const chartUrl =
  "https://www.yonex.com/tennis/footwear/men-s/shtaama";

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

async function readJson(url) {
  const raw = await fs.readFile(url, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function readUsMenSize(label, product) {
  // Nhãn nguồn ghi rõ size nam, ví dụ M 5 / W 6.5.
  const explicit = label.match(
    /^M\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*W\s*\d+(?:[.,]\d+)?)?$/i,
  );

  if (explicit) {
    return {
      size: Number(explicit[1].replace(",", ".")),
      basis: "yonex_us_m_label",
    };
  }

  // Nhãn chỉ có số: giới hạn ở sản phẩm nam của Yonex USA.
  const isUsMens =
    product.source_market === "US" &&
    /(?:\(MENS\)|MEN'S|\bMENS\b)/i.test(product.name);

  if (
    isUsMens &&
    /^\d+(?:[.,]\d+)?$/.test(label)
  ) {
    return {
      size: Number(label.replace(",", ".")),
      basis: "yonex_us_mens_product_context",
    };
  }

  return null;
}

async function main() {
  const sourceProducts = await readJson(
    new URL("products.json", root),
  );

  const sourceVariants = await readJson(
    new URL("variants.json", root),
  );

  const productsById = new Map(
    sourceProducts.map((item) => [item.catalog_id, item]),
  );

  const sourcesBySku = new Map(
    sourceVariants
      .filter((item) => item.import_sku)
      .map((item) => [item.import_sku, item]),
  );

  const variants = await prisma.productVariant.findMany({
    where: {
      sku: { startsWith: "CAT-YONEX-" },
      product: {
        category: { slug: "shoes" },
        brand: { slug: "yonex" },
      },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      attributes: true,
    },
  });

  const changes = [];
  const unresolved = [];

  for (const variant of variants) {
    const source = sourcesBySku.get(variant.sku);
    const product = productsById.get(source?.catalog_id);

    if (
      !source ||
      !product ||
      !isObject(variant.attributes)
    ) {
      unresolved.push({
        sku: variant.sku,
        reason: "Thiếu nguồn hoặc attributes không hợp lệ.",
      });
      continue;
    }

    const label = String(
      source.attributes?.sizeLabel ??
      source.options?.["Shoe Size"] ??
      "",
    ).trim();

    const parsed = readUsMenSize(label, product);
    const eu = parsed
      ? euByUsMen.get(parsed.size)
      : undefined;

    if (eu === undefined) {
      unresolved.push({
        sku: variant.sku,
        label,
        reason: "Chưa xác định được hệ size hoặc ngoài bảng đối chiếu.",
      });
      continue;
    }

    const before = variant.attributes;
    const currentSystem = String(
      before.sizeSystem ?? "",
    ).toUpperCase();

    const hasCurrentSize =
      before.size != null &&
      String(before.size).trim() !== "";

    const currentSize = Number(
      String(before.size ?? "").replace(",", "."),
    );

    if (
      hasCurrentSize &&
      !(
        (currentSystem === "EU" && currentSize === eu) ||
        (
          currentSystem === "US" &&
          before.sizeGender === "men" &&
          currentSize === parsed.size
        )
      )
    ) {
      unresolved.push({
        sku: variant.sku,
        label,
        reason: "Size hiện tại khác kết quả đối chiếu; cần kiểm tra.",
      });
      continue;
    }

    const attributes = {
      ...before,
      size: String(eu),
      sizeSystem: "EU",
      sizeLabel: label,
      sizeUSMen: String(parsed.size),
      sizeEU: String(eu),
      sizeSourceUrl: product.source_url,
      sizeChartUrl: chartUrl,
      sizeNormalizationBasis: parsed.basis,
    };

    if (
      JSON.stringify(before) !== JSON.stringify(attributes)
    ) {
      changes.push({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        before,
        after: attributes,
      });
    }
  }

  await fs.mkdir("./migration-repair", { recursive: true });

  const reportPath =
    `./migration-repair/yonex-shoe-sizes-${Date.now()}.json`;

  await fs.writeFile(
    reportPath,
    JSON.stringify({ changes, unresolved }, null, 2),
    "utf8",
  );

  console.log("Biến thể kiểm tra:", variants.length);
  console.log("Có thể cập nhật:", changes.length);
  console.log("Cần kiểm tra riêng:", unresolved.length);
  console.log("Báo cáo:", reportPath);

  console.table(
    changes.slice(0, 20).map((item) => ({
      sku: item.sku,
      variant: item.name,
      sourceSize: item.after.sizeLabel,
      EU: item.after.size,
    })),
  );

  if (!apply) {
    console.log("Chỉ xem trước, chưa cập nhật database.");
    return;
  }

  if (changes.length) {
    await prisma.$transaction(
      changes.map((item) =>
        prisma.productVariant.update({
          where: { id: item.id },
          data: { attributes: item.after },
        }),
      ),
    );
  }

  console.log(`Đã cập nhật ${changes.length} biến thể Yonex.`);
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());