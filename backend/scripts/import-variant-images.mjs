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

async function readJson(name) {
  const raw = await fs.readFile(new URL(name, root), "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function validImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function main() {
  const sourceVariants = await readJson("variants.json");
  const sourceImages = await readJson("images.json");
  const sourceProducts = await readJson("products.json");

  const variantBySku = new Map(
    sourceVariants.map((variant) => [
      variant.import_sku,
      variant,
    ]),
  );

  const imagesByVariant = new Map();

  for (const image of sourceImages) {
    if (!validImageUrl(image.source_url)) continue;

    for (const variantId of image.variant_ids ?? []) {
      const key = `${image.catalog_id}:${String(variantId)}`;

      if (!imagesByVariant.has(key)) {
        imagesByVariant.set(key, []);
      }

      imagesByVariant.get(key).push({
        url: image.source_url,
        position: image.position ?? 9999,
      });
    }
  }

  const productsBySlug = new Map(
    sourceProducts.map((product) => [product.slug, product]),
  );

  const variants = await prisma.productVariant.findMany({
    where: {
      product: {
        category: {
          slug: { in: ["rackets", "shoes"] },
        },
      },
    },
    include: {
      product: {
        select: { name: true, slug: true },
      },
    },
  });

  const changes = [];
  const unresolved = [];
  let alreadyMapped = 0;

  for (const variant of variants) {
    const attributes = isObject(variant.attributes)
      ? structuredClone(variant.attributes)
      : null;

    if (!attributes) {
      unresolved.push({
        sku: variant.sku,
        reason: "attributes không phải object.",
      });
      continue;
    }

    if (
      Array.isArray(attributes.imageUrls) &&
      attributes.imageUrls.some(validImageUrl)
    ) {
      alreadyMapped++;
      continue;
    }

    const source = variantBySku.get(variant.sku);

    // Chỉ nối theo SKU/ID nguồn đã xác định, không đoán màu.
    const linked = source
      ? imagesByVariant.get(
          `${source.catalog_id}:${String(source.source_variant_id)}`,
        ) ?? []
      : [];

    const urls = [
      source?.source_image_url,
      ...linked
        .sort((a, b) => a.position - b.position)
        .map((image) => image.url),
    ].filter(validImageUrl);

    const imageUrls = [...new Set(urls)];

    if (!imageUrls.length) {
      unresolved.push({
        product: variant.product.name,
        productSlug: variant.product.slug,
        sku: variant.sku,
        variant: variant.name,
        color: attributes.color ?? null,
        sourceUrl:
          productsBySlug.get(variant.product.slug)?.source_url ?? null,
        reason: source
          ? "Nguồn chưa gắn ảnh với biến thể."
          : "Không có SKU tương ứng trong nguồn.",
      });
      continue;
    }

    changes.push({
      id: variant.id,
      sku: variant.sku,
      product: variant.product.name,
      before: variant.attributes,
      after: {
        ...attributes,
        imageUrls,
        variantImageBasis: "source_variant_id_or_direct_image",
      },
    });
  }

  await fs.mkdir("./migration-repair", { recursive: true });

  const reportPath =
    `./migration-repair/variant-images-${Date.now()}.json`;

  await fs.writeFile(
    reportPath,
    JSON.stringify({
      changes,
      unresolved,
      alreadyMapped,
    }, null, 2),
    "utf8",
  );

  console.table(
    changes.slice(0, 15).map((item) => ({
      product: item.product,
      sku: item.sku,
      images: item.after.imageUrls.length,
    })),
  );

  console.log("Có thể bổ sung ảnh:", changes.length);
  console.log("Đã có ảnh, giữ nguyên:", alreadyMapped);
  console.log("Chưa nối được ảnh:", unresolved.length);
  console.log("Báo cáo:", reportPath);

  if (!apply) {
    console.log("Chỉ xem trước, chưa ghi database.");
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

  console.log(`Đã bổ sung ảnh cho ${changes.length} biến thể.`);
}

main()
  .catch((error) => {
    console.error("Lỗi:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());