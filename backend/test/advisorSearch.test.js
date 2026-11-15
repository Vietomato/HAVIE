import test from "node:test";
import assert from "node:assert/strict";
import {
  findAdvisorAlternatives,
  getBudgetRange,
  searchAdvisorProducts,
} from "../src/services/productSearchService.js";

const approvedAttributes = {
  advisor: {
    schemaVersion: 1,
    modelCode: "TEST",
    shaftFlex: "stiff",
    averageWeightG: 83,
    stringingAdvice: { minLbf: 20, maxLbf: 28 },
    sourceUrl: "https://example.com/spec",
    reviewStatus: "APPROVED",
  },
};

function variant(id, price, brandSlug) {
  return {
    id,
    sku: "SKU-" + id,
    name: "4U",
    price,
    stockQuantity: 3,
    isAvailable: true,
    attributes: approvedAttributes,
    product: {
      id: "product-" + id,
      name: "Vợt " + id,
      slug: id,
      imageUrls: [],
      isActive: true,
      advisorEnabled: true,
      brand: { name: brandSlug, slug: brandSlug },
    },
  };
}

function createDatabase(variants) {
  return {
    productVariant: {
      findMany: async ({ where }) =>
        variants.filter(
          (item) =>
            item.price >= where.price.gte &&
            item.price <= where.price.lte &&
            (!where.product.brand ||
              item.product.brand.slug === where.product.brand.slug),
        ),
    },
  };
}

const needs = {
  productType: "rackets",
  brandPreference: null,
  budgetTargetVnd: null,
  budgetMaxVnd: null,
};

test("a ceiling accepts every price up to that ceiling", () => {
  assert.deepEqual(getBudgetRange({ ...needs, budgetMaxVnd: 8000000 }), {
    anchor: 8000000,
    lower: 1,
    upper: 8000000,
  });
});

test("a target keeps the tolerance around the price", () => {
  const range = getBudgetRange({ ...needs, budgetTargetVnd: 4500000 });

  assert.equal(range.lower, 4200000);
  assert.equal(range.upper, 4800000);
});

test("a target never searches above the stated maximum", () => {
  const range = getBudgetRange({
    ...needs,
    budgetTargetVnd: 4500000,
    budgetMaxVnd: 4600000,
  });

  assert.equal(range.upper, 4600000);
});

test("a budget of 8 million finds a 4.45 million racket", async () => {
  const result = await searchAdvisorProducts(
    { ...needs, budgetMaxVnd: 8000000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result.status, "CANDIDATES_FOUND");
  assert.equal(result.candidates[0].priceVnd, 4450000);
});

test("the closest price under the ceiling comes first", async () => {
  const result = await searchAdvisorProducts(
    { ...needs, budgetMaxVnd: 5000000 },
    {
      database: createDatabase([
        variant("cheap", 1000000, "yonex"),
        variant("near", 4900000, "yonex"),
        variant("over", 5100000, "yonex"),
      ]),
    },
  );

  assert.deepEqual(
    result.candidates.map((item) => item.slug),
    ["near", "cheap"],
  );
});

test("alternatives relax the brand before the price", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, brandPreference: "victor", budgetTargetVnd: 4500000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result.reason, "brand");
  assert.equal(result.candidates[0].slug, "nf");
});

test("alternatives relax the price when the brand has stock", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, brandPreference: "yonex", budgetTargetVnd: 3600000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result.reason, "price");
});

test("alternatives never exceed a stated maximum", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, budgetMaxVnd: 4000000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result, null);
});

test("alternatives skip products far above a target", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, budgetTargetVnd: 500000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result, null);
});

test("alternatives stay limited to three products", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, budgetTargetVnd: 5000000 },
    {
      database: createDatabase(
        ["a", "b", "c", "d"].map((id, index) =>
          variant(id, 1000000 + index, "yonex"),
        ),
      ),
    },
  );

  assert.equal(result.candidates.length, 3);
});
