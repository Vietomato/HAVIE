import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRacketSpecsPlan } from "../scripts/import-racket-basic-specs.mjs";
import { readRacketSpecs } from "../src/services/productAdvisorService.js";
import { parseCatalogBalance, parseCatalogFlex } from "../src/services/racketSuitability.js";
import { adviseTension, describeTensionAnswer, describeTensionSuggestion } from "../src/services/tensionAdvisor.js";
import { searchAdvisorProducts } from "../src/services/productSearchService.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";
import { cleanRacketName } from "../src/utils/productName.js";
import { getProductSpecifications } from "../../frontend/src/utils/product.js";

const root = new URL("../data/catalog-source/racket-basic-specs/", import.meta.url);
const records = JSON.parse(readFileSync(new URL("data/racket_specs.json", root))).products;
const sources = JSON.parse(readFileSync(new URL("data/sources.json", root)));
const record = (slug) => structuredClone(records.find((p) => p.slug === slug));
const product = (entry) => ({
  id: entry.slug, slug: entry.slug, name: entry.catalogName, brand: { name: entry.brand, slug: "yonex" },
  category: { slug: "rackets" }, isActive: true, advisorEnabled: false, imageUrls: [],
  specs: ["Độ cứng: Cứng", "Điểm cân bằng: Nặng đầu", "Mức căng tối đa: 99 lbs", "Ghi chú cửa hàng: Giữ nguyên"],
  variants: entry.variants.map((v) => ({ id: v.sku, sku: v.sku, name: v.name,
    attributes: { imageUrls: ["/uploads/keep.png"], custom: "preserved" }, price: 1234567, stockQuantity: 30, isAvailable: true })),
});
const planned = (entry) => buildRacketSpecsPlan([entry], sources, [product(entry)]);
const read = (entry) => {
  const plan = planned(entry).plans[0];
  const v = plan.variants[0];
  return readRacketSpecs(v.attributes, { sku: v.variant.sku, productSlug: plan.product.slug, legacyEnabled: false });
};

test("the supplied package matches 163 products and 228 source-bound SKU candidates", () => {
  const result = buildRacketSpecsPlan(records, sources, records.map(product));
  assert.equal(result.inputSkus, 244);
  assert.equal(result.plans.filter((p) => !p.skipped).length, 163);
  assert.equal(result.plans.reduce((n, p) => n + p.variants.length, 0), 228);
  assert.equal(result.plans.filter((p) => p.skipped).length, 10);
});

test("partial, sourced flex is usable without average grams, full tension or a global approval switch", () => {
  const specs = read(record("lining-sg-axforce-10-4u"));
  assert.equal(specs.shaftFlex, "flexible");
  assert.equal(specs.balanceType, "head_heavy");
  assert.equal(specs.weightClass, "4U");
  assert.equal(specs.averageWeightG, null);
  assert.equal(specs.stringingMinLbf, null);
  assert.equal(specs.stringingMaxLbf, 29);
});

test("conflicting flex stays unknown while valid balance and tension survive", () => {
  const specs = read(record("yonex-us-nanoflare-800-tour"));
  assert.equal(specs.shaftFlex, null);
  assert.equal(specs.balanceType, "head_light");
  assert.equal(specs.stringingMinLbf, 20);
  assert.equal(specs.stringingMaxLbf, 28);
});

test("manufacturer scales are retained as raw text and never guessed from the endpoint words", () => {
  assert.equal(parseCatalogFlex("Cứng □□□■□ Mềm (thang hãng)"), null);
  assert.equal(parseCatalogFlex("Hard Flexible"), null);
  assert.equal(parseCatalogBalance("Nặng đầu ■□□□□ Nhẹ đầu (thang hãng)"), null);
  assert.equal(parseCatalogBalance("295 mm"), null);
  const entry = record("mizuno-vn-bdss-altius-sonic-73jtb309-2025ss");
  const plan = planned(entry).plans[0];
  assert.equal(read(entry).shaftFlex, null);
  assert.equal(read(entry).balanceType, null);
  assert.ok(plan.specs.some((s) => s.includes("□□□■□")));
});

test("unknown local SKUs and mismatched source variant titles do not import facts", () => {
  assert.equal(planned(record("yonex-nanoflare-1000z")).plans[0].variants.length, 0);
  const entry = record("yonex-us-astrox-77-play");
  const db = product(entry); db.variants[0].name = "Different edition";
  assert.equal(buildRacketSpecsPlan([entry], sources, [db]).plans[0].variants.length, 0);
});

test("source URLs, SKU provenance and weight bindings are enforced", () => {
  const entry = record("yonex-us-astrox-77-play");
  const plan = planned(entry).plans[0]; const v = plan.variants[0];
  assert.ok(readRacketSpecs(v.attributes, { sku: v.variant.sku, productSlug: plan.product.slug }));
  assert.equal(readRacketSpecs(v.attributes, { sku: "CAT-YONEX-0", productSlug: plan.product.slug }), null);
  const bad = structuredClone(v.attributes);
  bad.manufacturerSpecs.fieldSources.shaftFlex.url = "https://untrusted.example/spec";
  bad.manufacturerSpecs.manufacturerTension.weightClass = "3U";
  const checked = readRacketSpecs(bad, { sku: v.variant.sku, productSlug: plan.product.slug });
  assert.equal(checked.shaftFlex, null);
  assert.equal(checked.stringingMaxLbf, null);
});

test("missing or conflicted tension is not revived from raw source or old shop text", () => {
  const entry = record("yonex-us-astrox-77-pro");
  const plan = planned(entry).plans[0];
  assert.equal(read(entry).stringingMaxLbf, null);
  assert.ok(plan.specs.every((line) => !/99 lbs|Dải căng/.test(line)));
  assert.ok(plan.variants.every((v) => v.attributes.manufacturerSpecs.publicSpecs.every((line) => !/99 lbs/.test(line))));
});

test("maximum-only limits block exceedance without inventing a lower limit or confirming suitability", () => {
  const specs = { stringingMinLbf: null, stringingMaxLbf: 29 };
  const within = adviseTension({ skillLevel: "beginner", specs, requestedLbf: 24 });
  assert.equal(within.requested.status, "maximum_only");
  assert.equal(within.suggested, null);
  assert.equal(describeTensionSuggestion(within), null);
  assert.match(describeTensionAnswer(within, "AxForce 10 4U"), /chưa xác nhận 24 lbs/);
  const over = adviseTension({ skillLevel: "beginner", specs, requestedLbf: 30 });
  assert.equal(over.requested.status, "above_limit");
});

test("selected-SKU specifications keep 3U and 4U tension separate on the product page", () => {
  const entry = record("yonex-us-astrox-88d-tour"); const plan = planned(entry).plans[0];
  const rows = plan.variants.map((v) => getProductSpecifications(plan.product, { ...v.variant, attributes: v.attributes }));
  assert.ok(rows.some((items) => items.some((s) => s.includes("21–29 lbs"))));
  assert.ok(rows.some((items) => items.some((s) => s.includes("20–28 lbs"))));
  const wrongVariant = { ...plan.variants[0].variant, sku: "WRONG", attributes: plan.variants[0].attributes };
  assert.deepEqual(getProductSpecifications(plan.product, wrongVariant), plan.product.specs);
});

test("import planning preserves prices, quantities, identities and unrelated attributes", () => {
  const entry = record("yonex-us-astrox-77-play"); const db = product(entry); const before = structuredClone(db);
  const plan = buildRacketSpecsPlan([entry], sources, [db]).plans[0];
  assert.deepEqual(db, before);
  assert.equal(plan.variants[0].attributes.custom, "preserved");
  assert.deepEqual(plan.variants[0].attributes.imageUrls, ["/uploads/keep.png"]);
  assert.equal(plan.variants[0].variant.price, before.variants[0].price);
  assert.equal(plan.product.advisorEnabled, false);
});

test("repeating the same import is idempotent for sourced fields and public specifications", () => {
  const entry = record("yonex-us-astrox-77-play");
  const db = product(entry);
  const first = buildRacketSpecsPlan([entry], sources, [db]).plans[0];
  const after = { ...db, name: first.name, specs: first.specs,
    variants: first.variants.map((v) => ({ ...v.variant, attributes: v.attributes })) };
  const second = buildRacketSpecsPlan([entry], sources, [after]).plans[0];
  assert.deepEqual(second.specs, first.specs);
  assert.deepEqual(second.variants[0].attributes, first.variants[0].attributes);
});

test("head-light preference is not outweighed by price or generic weight/skill scores", async () => {
  const lightEntry = record("yonex-us-nanoflare-700-game");
  const heavyEntry = record("yonex-us-astrox-77-play");
  const variants = [lightEntry, heavyEntry].flatMap((entry) => {
    const plan = planned(entry).plans[0];
    return plan.variants.map((v) => ({ ...v.variant, attributes: v.attributes,
      price: entry.slug === lightEntry.slug ? 1500000 : 1999999,
      product: { ...plan.product, specs: plan.specs } }));
  });
  const needs = { ...createEmptyNeeds(), productType: "rackets", balancePreference: "head_light",
    skillLevel: "beginner", playFormat: "doubles", priorities: ["easy_to_use"], budgetMaxVnd: 2000000 };
  const result = await searchAdvisorProducts(needs, { database: { productVariant: { findMany: async () => variants } }, allowUnreviewedStock: true });
  assert.ok(result.candidates.length);
  assert.ok(result.candidates.every((candidate) => candidate.advisorSpecs.balanceType === "head_light"));
});

test("stringing labels are removed without changing model names or other product categories", () => {
  assert.equal(cleanRacketName("Vợt Yonex ASTROX 77 PLAY (Đã căng dây)", "rackets"), "Vợt Yonex ASTROX 77 PLAY");
  assert.equal(cleanRacketName("Vợt Mizuno FORTIUS 10 (Chưa căng dây)", "rackets"), "Vợt Mizuno FORTIUS 10");
  assert.equal(cleanRacketName("Yonex PLAY (STRUNG)", "rackets"), "Yonex PLAY");
  assert.equal(cleanRacketName("Cước (Đã căng dây)", "strings"), "Cước (Đã căng dây)");
});
