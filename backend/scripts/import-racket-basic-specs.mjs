import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import prisma from "../src/config/prisma.js";
import { validSpecSource } from "../src/services/productAdvisorService.js";
import { parseCatalogBalance, parseCatalogFlex, readWeightClass } from "../src/services/racketSuitability.js";
import { cleanRacketName } from "../src/utils/productName.js";

const ROOT = new URL("../data/catalog-source/racket-basic-specs/", import.meta.url);
const BATCH = "racket-basic-specs-2026-11-15";
const normalized = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();

export function buildRacketSpecsPlan(records, registry, products) {
  const sources = new Map(registry.map((source) => [source.sourceId, source]));
  assert.equal(sources.size, registry.length, "Duplicate source ID");
  for (const source of registry) assert.ok(validSpecSource(source), `Invalid source: ${source.sourceId}`);
  const skus = new Set();
  const owner = new Map(products.flatMap((p) => p.variants.map((v) => [v.sku, { product: p, variant: v }])));
  const plans = [];
  const issues = [];
  for (const item of records) {
    assert.ok(Array.isArray(item.variants) && item.variants.length);
    assert.deepEqual([...item.dbIdentifiers.skus].sort(), item.variants.map((v) => v.sku).sort(), `SKU list differs: ${item.slug}`);
    for (const variant of item.variants) {
      assert.ok(!skus.has(variant.sku), `Duplicate SKU: ${variant.sku}`);
      skus.add(variant.sku);
    }
    const matches = item.variants.map((v) => owner.get(v.sku));
    if (matches.some((match) => !match) || new Set(matches.map((m) => m.product.id)).size !== 1) {
      issues.push({ slug: item.slug, reason: "SKU_MISSING_OR_DIFFERENT_PRODUCT", skus: item.dbIdentifiers.skus }); continue;
    }
    const product = matches[0].product;
    assert.equal(product.category.slug, "rackets");
    assert.equal(normalized(product.brand.name), normalized(item.brand));
    const plan = { product, name: cleanRacketName(product.name, "rackets"), specs: [...product.specs], variants: [], skipped: false };
    plans.push(plan);
    if (item.sourceMatchStatus !== "EXACT_SOURCE_VARIANT_IDS" || item.autoApplyNonConflictingSpecs !== true) {
      plan.skipped = true;
      issues.push({ slug: product.slug, reason: "LOCAL_SKU_NEEDS_IDENTITY_REVIEW", skus: item.dbIdentifiers.skus }); continue;
    }
    const sourceFor = (id) => {
      assert.ok(item.sourceIds.includes(id), `Undeclared source ${id}: ${item.slug}`);
      const source = sources.get(id);
      assert.ok(source && validSpecSource(source), `Unknown source: ${id}`);
      return { sourceId: id, url: source.url, checkedAt: source.checkedAt, publisher: source.publisher };
    };
    const productIssues = item.reviewIssues ?? [];
    const conflictingGrip = productIssues.some((i) => /GRIP.*CONFLICT|CONFLICT.*GRIP/u.test(i.code));
    const publicItems = item.publicSpecItems.filter((field) => {
      if (field.key === "brand") return false;
      assert.equal(typeof field.label, "string"); assert.equal(typeof field.value, "string");
      sourceFor(field.sourceId);
      if (conflictingGrip && ["gripReported", "weightGripReported", "globalWeightGrip"].includes(field.key)) return false;
      if (field.key === "tension") return false; // Tension is bound to the selected SKU, never copied product-wide.
      return !productIssues.some((issue) => issue.field === field.key && /CONFLICT/u.test(issue.code));
    });
    const controlledLabels = new Set([
      ...item.publicSpecItems.map((i) => i.label), "Độ cứng", "Điểm cân bằng", "Cân bằng",
      "Dải căng hãng công bố", "Giới hạn căng tối đa hãng công bố", "Mức căng tối đa",
    ]);
    const keep = product.specs.filter((line) => !controlledLabels.has(line.split(":")[0].trim()));
    plan.specs = [...new Set([...keep, ...publicItems.map((f) => `${f.label}: ${f.value}`)])];
    for (const sourceVariant of item.variants) {
      const variant = owner.get(sourceVariant.sku).variant;
      if (sourceVariant.matchStatus !== "SOURCE_VARIANT_ID_MATCH" ||
          String(sourceVariant.sourceVariantId) !== variant.sku.split("-").at(-1) ||
          !/^CAT-[A-Z]+-\d+$/u.test(variant.sku) ||
          normalized(variant.name) !== normalized(sourceVariant.sourceVariantTitle)) {
        issues.push({ slug: product.slug, sku: variant.sku, reason: "VARIANT_ID_OR_TITLE_MISMATCH" }); continue;
      }
      const variantSource = sourceFor(sourceVariant.sourceId);
      const weightClass = sourceVariant.attributesCandidate.weightClass;
      if (weightClass !== null) assert.match(weightClass, /^(?:[2-6]|3\.5)U$/u);
      const existingWeight = readWeightClass({ attributes: variant.attributes, variantName: variant.name, productName: product.name });
      if (existingWeight && weightClass && existingWeight !== weightClass) {
        issues.push({ slug: product.slug, sku: variant.sku, reason: "EXISTING_WEIGHT_CONFLICT" }); continue;
      }
      const fields = Object.fromEntries(publicItems.map((field) => [field.key, field]));
      const fieldSources = {};
      const blockedFields = [];
      const shaftFlex = fields.flex ? parseCatalogFlex(fields.flex.value) : null;
      const balanceType = fields.balance ? parseCatalogBalance(fields.balance.value) : null;
      if (shaftFlex) fieldSources.shaftFlex = sourceFor(fields.flex.sourceId);
      else blockedFields.push("shaftFlex");
      if (balanceType) fieldSources.balanceType = sourceFor(fields.balance.sourceId);
      else blockedFields.push("balanceType");
      if (weightClass) fieldSources.weightClass = variantSource;
      let tension = sourceVariant.manufacturerTension;
      const flags = sourceVariant.reviewFlags ?? [];
      if (tension) {
        const forbidden = /CONFLICT|OMITS_TENSION_UNIT|MULTIPLE_WEIGHT|HORIZONTAL_VERTICAL|COLOR_SCOPE/u;
        assert.ok(!flags.some((flag) => forbidden.test(flag)), `Blocked tension present: ${variant.sku}`);
        if (flags.includes("REGIONAL_TENSION_NOT_WEIGHT_SCOPED")) {
          assert.ok(tension.sourceId !== sourceVariant.sourceId && tension.weightClass === weightClass && weightClass,
            `Unresolved regional tension: ${variant.sku}`);
        }
        if (flags.includes("VARIANT_WEIGHT_NOT_SELECTED")) {
          assert.ok(tension.sourceId === sourceVariant.sourceId && tension.weightClass === null && !tension.unboundMultipleRows,
            `Unbound weight-specific tension: ${variant.sku}`);
        }
        assert.equal(tension.unit, "lbf");
        assert.ok(tension.weightClass === null || tension.weightClass === weightClass, `Tension weight differs: ${variant.sku}`);
        assert.ok(Number.isFinite(tension.maxLbf) && tension.maxLbf > 0 && tension.maxLbf <= 50);
        assert.ok(tension.type === "manufacturer_max" && tension.minLbf === null ||
          tension.type === "manufacturer_range" && Number.isFinite(tension.minLbf) && tension.minLbf > 0 && tension.minLbf <= tension.maxLbf);
        for (const bound of ["min", "max"]) if (tension[`${bound}Lbf`] !== null) {
          assert.ok(Math.abs(tension[`${bound}Kgf`] - tension[`${bound}Lbf`] * 0.45359237) <= 0.011, `Invalid kgf: ${variant.sku}`);
        }
        fieldSources.manufacturerTension = sourceFor(tension.sourceId);
      } else blockedFields.push("manufacturerTension");
      const variantItems = publicItems.filter((field) => !["weightGripReported", "globalWeightGrip", "gripReported"].includes(field.key));
      const specifications = [...new Set([...keep, ...variantItems.map((f) => `${f.label}: ${f.value}`)])];
      if (weightClass) specifications.push(`Hạng trọng lượng: ${weightClass}`);
      if (!conflictingGrip && sourceVariant.attributesCandidate.gripCode) specifications.push(`Cán theo nguồn: ${sourceVariant.attributesCandidate.gripCode}`);
      if (tension) specifications.push(tension.type === "manufacturer_range"
        ? `Dải căng hãng công bố: ${tension.minLbf}–${tension.maxLbf} lbs (≈ ${tension.minKgf}–${tension.maxKgf} kgf)`
        : `Giới hạn căng tối đa hãng công bố: ${tension.maxLbf} lbs (≈ ${tension.maxKgf} kgf)`);
      const data = {
        schemaVersion: 1, importBatch: BATCH, identityStatus: "SOURCE_VARIANT_ID_MATCH",
        sku: variant.sku, productSlug: product.slug, sourceVariantId: sourceVariant.sourceVariantId,
        shaftFlex, balanceType, weightClass, manufacturerTension: tension,
        fieldSources, blockedFields, publicSpecs: specifications,
        rawFlex: fields.flex?.value ?? null, rawBalance: fields.balance?.value ?? null,
      };
      plan.variants.push({ variant, attributes: { ...variant.attributes, manufacturerSpecs: data } });
      if (blockedFields.length || flags.length || productIssues.length) issues.push({
        slug: product.slug, sku: variant.sku, reason: "PARTIAL_SPECS",
        blockedFields, reviewFlags: flags, sourceIssues: productIssues.map((i) => i.code),
      });
    }
  }
  return { plans, issues, inputSkus: skus.size };
}

async function main() {
  const input = JSON.parse(await readFile(new URL("data/racket_specs.json", ROOT), "utf8"));
  const registry = JSON.parse(await readFile(new URL("data/sources.json", ROOT), "utf8"));
  const products = await prisma.product.findMany({ where: { category: { slug: "rackets" } }, include: { variants: true, brand: true, category: true } });
  const { plans, issues, inputSkus } = buildRacketSpecsPlan(input.products, registry, products);
  const summary = {
    batch: BATCH, inputProducts: input.products.length, inputSkus,
    productsWithImportedSpecs: plans.filter((p) => !p.skipped && p.variants.length).length,
    variantsWithImportedSpecs: plans.reduce((n, p) => n + p.variants.length, 0),
    namesCleaned: plans.filter((p) => p.name !== p.product.name).length,
    normalizedFlex: plans.flatMap((p) => p.variants).filter((v) => v.attributes.manufacturerSpecs.shaftFlex).length,
    normalizedBalance: plans.flatMap((p) => p.variants).filter((v) => v.attributes.manufacturerSpecs.balanceType).length,
    fullTensionRanges: plans.flatMap((p) => p.variants).filter((v) => v.attributes.manufacturerSpecs.manufacturerTension?.type === "manufacturer_range").length,
    maximumOnly: plans.flatMap((p) => p.variants).filter((v) => v.attributes.manufacturerSpecs.manufacturerTension?.type === "manufacturer_max").length,
  };
  console.log(JSON.stringify(summary, null, 2));
  const report = new URL("../data/racket-basic-specs-import-report.json", import.meta.url);
  await writeFile(report, JSON.stringify({ applied: false, summary, issues }, null, 2) + "\n");
  if (!process.argv.includes("--apply")) return console.log("Dry run: no database writes. Add --apply to import.");
  const backup = new URL(`../data/racket-basic-specs-backup-${Date.now()}.json`, import.meta.url);
  await writeFile(backup, JSON.stringify(products.map((p) => ({ id: p.id, name: p.name, specs: p.specs,
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, attributes: v.attributes })) })), null, 2) + "\n");
  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      // Preserve current edits and fail rather than overwrite concurrent changes.
      const current = await tx.product.findUnique({ where: { id: plan.product.id }, include: { variants: true } });
      assert.equal(current.updatedAt.getTime(), plan.product.updatedAt.getTime(), "Product changed during import");
      await tx.product.update({ where: { id: current.id }, data: {
        name: plan.name, ...(plan.variants.length ? { specs: plan.specs } : {}),
      } });
      for (const entry of plan.variants) {
        const currentVariant = current.variants.find((v) => v.id === entry.variant.id);
        assert.equal(currentVariant.updatedAt.getTime(), entry.variant.updatedAt.getTime(), "Variant changed during import");
        await tx.productVariant.update({ where: { id: entry.variant.id }, data: { attributes: entry.attributes } });
      }
    }
  }, { timeout: 60000, isolationLevel: "Serializable" });
  await writeFile(report, JSON.stringify({ applied: true, summary, issues, backup: fileURLToPath(backup) }, null, 2) + "\n");
  console.log("Imported specifications by SKU; product identities, commercial data and approval flags preserved.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error("Import failed:", error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
