import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import prisma from "../src/config/prisma.js";
import { detectImageExtension, saveImage, UPLOADS_DIR } from "../src/services/imageStorage.js";
import { findStringModels, loadKnowledge } from "../src/services/knowledgeBase.js";

// Package documents are reference data. Commerce values below are the user's request.
const commerce = {
  "yonex-bg65": 120000,
  "yonex-bg66-ultimax": 195000,
  "yonex-bg80": 200000,
  "yonex-exbolt-63": 205000,
  "yonex-exbolt-65": 200000,
  "yonex-exbolt-68": 215000,
  "yonex-aerobite": 220000,
};
const batch = "yonex-strings-2026-11-14";
const root = new URL("../data/catalog-source/yonex-strings/", import.meta.url);
const apply = process.argv.includes("--apply");

async function main() {
  const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("image_manifest.json", root), "utf8"));
  assert.equal(catalog.products.length, 7);
  const knowledge = loadKnowledge();
  const existing = await prisma.product.findMany({
    where: { brand: { slug: "yonex" } },
    include: { variants: true, category: true },
  });
  const skuOwners = await prisma.productVariant.findMany({
    where: { sku: { in: catalog.products.flatMap((p) => p.variantCandidates.map((v) => v.proposedStoreSku)) } },
  });
  const slugs = new Set();
  const plans = [];

  for (const item of catalog.products) {
    assert.ok(Object.hasOwn(commerce, item.slug), `Unexpected product: ${item.slug}`);
    assert.ok(!slugs.has(item.slug), `Duplicate product: ${item.slug}`);
    slugs.add(item.slug);
    assert.equal(item.brandSlug, "yonex");
    assert.equal(item.variantCandidates.length, 1);
    const variant = item.variantCandidates[0];
    const models = findStringModels(item.name);
    assert.equal(models.length, 1, `Unknown or ambiguous string: ${item.name}`);
    const model = knowledge.stringing.models.find((m) => m.name === models[0]);
    assert.ok(model);
    if (typeof model.gauge_mm === "number") assert.equal(variant.attributes.gaugeMm, model.gauge_mm);
    else {
      assert.equal(variant.attributes.mainGaugeMm, model.gauge_mm.main);
      assert.equal(variant.attributes.crossGaugeMm, model.gauge_mm.cross);
    }
    assert.equal(variant.attributes.packaging, "SET");
    assert.ok([10, 10.5].includes(variant.attributes.lengthM));
    const image = manifest.find((m) => m.slug === item.slug);
    assert.equal(image?.local_path, `images/${item.slug}.png`);
    const buffer = await readFile(new URL(image.local_path, root));
    assert.equal(detectImageExtension(buffer), "png");
    assert.equal(createHash("sha256").update(buffer).digest("hex"), image.sha256);
    const matches = existing.filter((p) => p.slug === item.slug ||
      (["accessories", "strings"].includes(p.category.slug) &&
        findStringModels(p.name).length === 1 && findStringModels(p.name)[0] === model.name));
    assert.ok(matches.length <= 1, `Multiple existing products match ${item.name}`);
    const product = matches[0];
    const skuOwner = skuOwners.find((v) => v.sku === variant.proposedStoreSku);
    assert.ok(!skuOwner || skuOwner.productId === product?.id, `SKU collision: ${variant.proposedStoreSku}`);
    const sameSet = product?.variants.filter((v) => v.sku === variant.proposedStoreSku ||
      (v.attributes?.packaging === "SET" && v.attributes?.lengthM === variant.attributes.lengthM)) ?? [];
    assert.ok(sameSet.length <= 1, `Ambiguous existing variant: ${item.name}`);
    assert.ok(!product?.variants.length || sameSet.length === 1, `Existing variants need reconciliation: ${item.name}`);
    const oldVariant = sameSet[0];
    const alreadyImported = oldVariant?.attributes?.importBatch === batch;
    plans.push({ item, variant, model, product, oldVariant, buffer, image, alreadyImported });
  }

  console.table(plans.map((p) => ({
    product: p.item.name,
    sku: p.oldVariant?.sku ?? p.variant.proposedStoreSku,
    priceVnd: p.alreadyImported ? p.oldVariant.price : commerce[p.item.slug],
    quantity: p.alreadyImported ? p.oldVariant.stockQuantity : 30,
    action: p.alreadyImported ? "Keep imported stock/prices" : p.product ? "Update" : "Create",
  })));
  if (!apply) return console.log("Dry run passed: 7 images verified; no database writes. Use --apply to import.");

  // Use the existing configured image storage; retain existing product images.
  for (const plan of plans) {
    if (plan.product?.imageUrls.length) plan.imageUrls = plan.product.imageUrls;
    else if (process.argv.includes("--local-images")) {
      const directory = path.join(UPLOADS_DIR, "yonex-strings");
      await mkdir(directory, { recursive: true });
      const filename = `${plan.item.slug}-${plan.image.sha256.slice(0, 12)}.png`;
      await writeFile(path.join(directory, filename), plan.buffer, { flag: "wx" }).catch(async (error) => {
        if (error.code !== "EEXIST") throw error;
        assert.deepEqual(await readFile(path.join(directory, filename)), plan.buffer);
      });
      plan.imageUrls = [`/uploads/yonex-strings/${filename}`];
    } else plan.imageUrls = [await saveImage(plan.buffer)];
  }
  const imported = await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.upsert({ where: { slug: "yonex" }, update: {}, create: { slug: "yonex", name: "Yonex" } });
    const category = await tx.category.upsert({ where: { slug: "strings" }, update: { name: "Cước" }, create: { slug: "strings", name: "Cước" } });
    const result = [];
    for (const plan of plans) {
      const { item, variant, model, product: oldProduct, oldVariant, alreadyImported } = plan;
      const productData = {
        categoryId: category.id,
        name: oldProduct?.name ?? item.name,
        description: oldProduct?.description || item.description,
        specs: [...new Set([...(oldProduct?.specs ?? []), ...item.specs, "Giá bộ cước, chưa gồm công căng."])],
        imageUrls: plan.imageUrls,
        isActive: true,
      };
      const product = oldProduct
        ? await tx.product.update({ where: { id: oldProduct.id }, data: productData })
        : await tx.product.create({ data: { ...productData, slug: item.slug, brandId: brand.id, categoryId: category.id, advisorEnabled: false } });
      const variantData = {
        name: oldVariant?.name ?? variant.name,
        price: alreadyImported ? oldVariant.price : commerce[item.slug],
        stockQuantity: alreadyImported ? oldVariant.stockQuantity : 30,
        isAvailable: true,
        attributes: {
          ...variant.attributes, ...(oldVariant?.attributes ?? {}),
          stringModel: model.name, productKind: "badminton_string",
          priceIncludesStringingLabor: false,
          importBatch: batch,
          source: item.source,
          imageSource: { url: plan.image.original_url, sha256: plan.image.sha256 },
        },
      };
      const savedVariant = oldVariant
        ? await tx.productVariant.update({ where: { id: oldVariant.id }, data: variantData })
        : await tx.productVariant.create({ data: { ...variantData, sku: variant.proposedStoreSku, productId: product.id } });
      const difference = savedVariant.stockQuantity - (oldVariant?.stockQuantity ?? 0);
      if (difference) await tx.stockMovement.create({ data: {
        variantId: savedVariant.id, type: difference > 0 ? "IN" : "OUT",
        quantity: Math.abs(difference), reason: "YONEX_STRINGS_IMPORT_2026_11_14",
      } });
      result.push({ productId: product.id, variantId: savedVariant.id, slug: product.slug,
        name: product.name, sku: savedVariant.sku, priceVnd: savedVariant.price,
        stockQuantity: savedVariant.stockQuantity, imageUrls: product.imageUrls,
        created: !oldProduct, unchangedCommerce: alreadyImported });
    }
    return result;
  }, { timeout: 60000, isolationLevel: "Serializable" });
  await writeFile(new URL("../data/yonex-strings-import-result.json", import.meta.url), JSON.stringify({ batch, imported }, null, 2) + "\n");
  console.log(`Imported ${imported.length} products. Repeat runs preserve this batch's current stock and prices.`);
}

main().catch((error) => { console.error("Import failed:", error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
