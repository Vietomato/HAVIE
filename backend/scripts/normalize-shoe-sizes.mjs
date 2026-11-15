import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const root = new URL(
  "../data/catalog-source/HAVIE_Catalog/",
  import.meta.url,
);

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

async function readJson(url) {
  const raw = await fs.readFile(url, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function main() {
  const sourceProducts = await readJson(
    new URL("products.json", root),
  );

  const sourceVariants = await readJson(
    new URL("variants.json", root),
  );

  const productsById = new Map(
    sourceProducts.map((product) => [
      product.catalog_id,
      product,
    ]),
  );

  const sourcesBySku = new Map(
    sourceVariants
      .filter((variant) => variant.import_sku)
      .map((variant) => [variant.import_sku, variant]),
  );

  const variants = await prisma.productVariant.findMany({
    where: {
      sku: { startsWith: "CAT-" },
      product: {
        category: { slug: "shoes" },
        brand: { slug: "mizuno" },
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

    if (!source || !product) {
      unresolved.push({
        sku: variant.sku,
        reason: "Không tìm thấy biến thể nguồn.",
      });
      continue;
    }

    if (!isObject(variant.attributes)) {
      unresolved.push({
        sku: variant.sku,
        reason: "attributes không phải object.",
      });
      continue;
    }

    const label = String(
      source.attributes?.sizeLabel ??
      source.options?.["Kích cỡ"] ??
      source.options?.Size ??
      "",
    ).trim();

    // Chỉ nhận nhãn có đủ UK và số EU trong ngoặc.
    // C12/C13 là size trẻ em: chưa xử lý tự động.
    const match = label.match(
      /^UK\s*(\d+(?:[.,]\d+)?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)$/i,
    );

    if (!match) {
      unresolved.push({
        sku: variant.sku,
        label,
        reason: "Nhãn chưa có cặp UK/EU rõ ràng.",
      });
      continue;
    }

    const uk = Number(match[1].replace(",", "."));
    const eu = Number(match[2].replace(",", "."));

    if (
      !Number.isFinite(uk) ||
      !Number.isFinite(eu) ||
      uk <= 0 ||
      eu <= 0
    ) {
      continue;
    }

    const before = variant.attributes;

    // Không ghi đè thông tin chuẩn hóa khác đang có.
    const existingSystem = String(
      before.sizeSystem ?? "",
    ).toUpperCase();

    const existingSize = Number(
      String(before.size ?? "").replace(",", "."),
    );

    const hasExistingSize =
      before.size != null &&
      String(before.size).trim() !== "";

    if (
      hasExistingSize &&
      (
        !["EU", "UK"].includes(existingSystem) ||
        existingSize !== (existingSystem === "EU" ? eu : uk)
      )
    ) {
      unresolved.push({
        sku: variant.sku,
        label,
        reason: "Thông tin size hiện tại khác nguồn; cần kiểm tra.",
      });
      continue;
    }

    const attributes = {
      ...before,
      size: String(eu),
      sizeSystem: "EU",
      sizeLabel: label,
      sizeUK: String(uk),
      sizeEU: String(eu),
      sizeSourceUrl: product.source_url,
      sizeNormalizationBasis: "source_variant_explicit_uk_eu_label",
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
    `./migration-repair/shoe-sizes-${Date.now()}.json`;

  await fs.writeFile(
    reportPath,
    JSON.stringify({ changes, unresolved }, null, 2),
    "utf8",
  );

  console.log("Biến thể Mizuno kiểm tra:", variants.length);
  console.log("Có thể cập nhật:", changes.length);
  console.log("Cần kiểm tra riêng:", unresolved.length);
  console.log("Báo cáo và dữ liệu trước/sau:", reportPath);

  console.table(
    changes.slice(0, 15).map((item) => ({
      sku: item.sku,
      variant: item.name,
      EU: item.after.size,
      UK: item.after.sizeUK,
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

  console.log(`Đã cập nhật ${changes.length} biến thể.`);
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());