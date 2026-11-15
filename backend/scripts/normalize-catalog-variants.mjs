import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const isMissing = (value) =>
  value == null || String(value).trim() === "";

function uniqueMatch(text, regex, transform) {
  const values = [
    ...new Set(
      [...text.matchAll(regex)].map(transform),
    ),
  ];

  return values.length === 1 ? values[0] : null;
}

function readWeight(text) {
  return uniqueMatch(
    text,
    /(?<![\p{L}\p{N}])([2-6](?:[.,]5)?)U(?![\p{L}\p{N}])/giu,
    (match) => `${match[1].replace(",", ".")}U`,
  );
}

function readGrip(text) {
  return uniqueMatch(
    text,
    /(?<![\p{L}\p{N}])G([2-6])(?![\p{L}\p{N}])/giu,
    (match) => `G${match[1]}`,
  );
}

function readExplicitSize(text) {
  const matches = [
    ...text.matchAll(
      /(?<![\p{L}\p{N}])(EU|US|UK|CM)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)(?![\p{L}\p{N}])/giu,
    ),
  ];

  const values = new Map();

  for (const match of matches) {
    const system = match[1].toUpperCase();
    const size = Number(match[2].replace(",", "."));

    if (Number.isFinite(size) && size > 0 && size <= 60) {
      values.set(`${system}:${size}`, { system, size });
    }
  }

  return values.size === 1
    ? [...values.values()][0]
    : null;
}

async function main() {
  const raw = await fs.readFile(
    new URL("../prisma/catalog-priced.json", import.meta.url),
    "utf8",
  );

  const products = JSON.parse(raw.replace(/^\uFEFF/, ""));

  if (!Array.isArray(products)) {
    throw new Error("catalog-priced.json phải chứa mảng sản phẩm.");
  }

  const sourceBySku = new Map();

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variant.sku) continue;

      if (sourceBySku.has(variant.sku)) {
        throw new Error(`SKU trùng trong file: ${variant.sku}`);
      }

      sourceBySku.set(variant.sku, {
        product,
        variant,
      });
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      sku: { in: [...sourceBySku.keys()] },
    },
    include: {
      product: {
        select: {
          name: true,
          category: {
            select: { slug: true },
          },
        },
      },
    },
  });

  const changes = [];
  const unresolved = [];

  for (const variant of variants) {
    const source = sourceBySku.get(variant.sku);

    if (
      variant.attributes !== null &&
      !isObject(variant.attributes)
    ) {
      unresolved.push({
        sku: variant.sku,
        product: variant.product.name,
        missing: "attributes không phải object",
      });
      continue;
    }

    const attributes = structuredClone(variant.attributes ?? {});
    const original = JSON.stringify(attributes);

    const sourceAttributes = isObject(source.variant.attributes)
      ? source.variant.attributes
      : {};

    const category = variant.product.category.slug;

    const variantText = [
      variant.name,
      source.variant.name,
    ].join(" | ");

    const productText = [
      variant.product.name,
      source.product.name,
    ].join(" | ");

    if (category === "rackets") {
      if (isMissing(attributes.weight)) {
        const sourceWeight = String(
          sourceAttributes.weight ?? "",
        ).trim().toUpperCase().replace(",", ".");

        const weight = /^[2-6](?:\.5)?U$/.test(sourceWeight)
          ? sourceWeight
          : readWeight(variantText) ?? readWeight(productText);

        if (weight) attributes.weight = weight;
      }

      if (isMissing(attributes.grip)) {
        const sourceGrip = String(
          sourceAttributes.grip ?? "",
        ).trim().toUpperCase();

        const grip = /^G[2-6]$/.test(sourceGrip)
          ? sourceGrip
          : readGrip(variantText) ?? readGrip(productText);

        if (grip) attributes.grip = grip;
      }
    }

    if (category === "shoes") {
      const validSystems = ["EU", "US", "UK", "CM"];

      const currentSystem = String(
        attributes.sizeSystem ?? "",
      ).trim().toUpperCase();

      const sourceSystem = String(
        sourceAttributes.sizeSystem ?? "",
      ).trim().toUpperCase();

      let system = validSystems.includes(currentSystem)
        ? currentSystem
        : validSystems.includes(sourceSystem)
          ? sourceSystem
          : null;

      // Chỉ dùng size có ghi rõ hệ; không đoán từ số 7, 8, 40.
      const explicit = readExplicitSize(
        [
          variantText,
          attributes.sizeLabel ?? "",
          sourceAttributes.sizeLabel ?? "",
        ].join(" | "),
      );

      if (!system && explicit) {
        system = explicit.system;
      }

      if (system) {
        attributes.sizeSystem = system;

        if (isMissing(attributes.size)) {
          const rawSize =
            attributes.sizeLabel ??
            sourceAttributes.size ??
            sourceAttributes.sizeLabel;

          const numericSize = Number(
            String(rawSize ?? "").trim().replace(",", "."),
          );

          if (
            Number.isFinite(numericSize) &&
            numericSize > 0 &&
            numericSize <= 60
          ) {
            attributes.size = String(numericSize);
          } else if (explicit?.system === system) {
            attributes.size = String(explicit.size);
          }
        }
      }
    }

    const missing = [];

    if (category === "rackets") {
      if (isMissing(attributes.weight)) missing.push("weight");
      if (isMissing(attributes.grip)) missing.push("grip");
    }

    if (category === "shoes") {
      if (isMissing(attributes.size)) missing.push("size");

      if (!["EU", "US", "UK", "CM"].includes(
        attributes.sizeSystem,
      )) {
        missing.push("sizeSystem chưa xác định");
      }
    }

    if (missing.length) {
      unresolved.push({
        sku: variant.sku,
        product: variant.product.name,
        variant: variant.name,
        missing: missing.join(", "),
        attributes,
      });
    }

    if (JSON.stringify(attributes) !== original) {
      changes.push({
        id: variant.id,
        sku: variant.sku,
        product: variant.product.name,
        before: variant.attributes,
        after: attributes,
      });
    }
  }

  await fs.mkdir(
    new URL("../migration-repair/", import.meta.url),
    { recursive: true },
  );

  const report = new URL(
    `../migration-repair/variant-normalization-${Date.now()}.json`,
    import.meta.url,
  );

  // Lưu giá trị trước/sau trước khi cập nhật.
  await fs.writeFile(
    report,
    JSON.stringify({ changes, unresolved }, null, 2),
    "utf8",
  );

  console.log("Biến thể kiểm tra:", variants.length);
  console.log("Có thể chuẩn hóa:", changes.length);
  console.log("Vẫn thiếu thông tin:", unresolved.length);
  console.log("Báo cáo:", report.pathname);

  console.table(
    changes.slice(0, 15).map((item) => ({
      sku: item.sku,
      product: item.product,
      weight: item.after.weight,
      grip: item.after.grip,
      size: item.after.size,
      system: item.after.sizeSystem,
    })),
  );

  if (!apply) {
    console.log("Chỉ xem trước. Chưa cập nhật database.");
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

  console.log(`Đã chuẩn hóa ${changes.length} biến thể.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());