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

test("description retrieval ranks the eligible pool before limiting results and contains no inventory", async () => {
  const rows = Array.from({ length: 7 }, (_, i) => variant(String(i), 2000000 + i * 10000, "yonex"));
  rows.forEach((row) => { row.product.description = "Mô tả vợt công khai"; });
  let indexed;
  const result = await searchAdvisorProducts({ ...needs, budgetMaxVnd: 3000000 }, {
    database: createDatabase(rows), query: "vợt dễ xoay trở",
    rank: async (query, documents) => {
      assert.equal(query, "vợt dễ xoay trở");
      indexed = documents;
      return { mode: "hybrid", hits: [{ document: documents.find((doc) => doc.id === "6"), score: 1 }] };
    },
  });
  assert.equal(indexed.length, 7);
  assert.equal(result.candidates[0].variantId, "6");
  assert.equal(result.candidates.length, 5);
  assert.doesNotMatch(JSON.stringify(indexed), /stockQuantity|isAvailable|supplier|password/u);
});

test("a ceiling accepts every price up to that ceiling", () => {
  assert.deepEqual(getBudgetRange({ ...needs, budgetMaxVnd: 8000000 }), {
    anchor: 8000000,
    lower: 1,
    upper: 8000000,
  });
});

test("a target keeps the tolerance around the price", () => {
  const range = getBudgetRange({ ...needs, budgetTargetVnd: 4500000 });

  assert.equal(range.lower, 4300000);
  assert.equal(range.upper, 4700000);
});

test("a 3 million target includes 2.8 through 3.2 million and excludes both outside edges", async () => {
  const query = { ...needs, budgetTargetVnd: 3000000 };
  assert.deepEqual(getBudgetRange(query), { anchor: 3000000, lower: 2800000, upper: 3200000 });
  const result = await searchAdvisorProducts(query, {
    database: createDatabase([variant("below", 2799999, "yonex"), variant("low", 2800000, "yonex"),
      variant("middle", 3000000, "yonex"), variant("high", 3200000, "yonex"), variant("above", 3200001, "yonex")]),
  });
  assert.deepEqual(result.candidates.map((item) => item.slug).sort(), ["high", "low", "middle"]);
});

test("targets below one million use a narrower 100k margin", () => {
  assert.deepEqual(getBudgetRange({ ...needs, budgetTargetVnd: 500000 }), { anchor: 500000, lower: 400000, upper: 600000 });
  assert.deepEqual(getBudgetRange({ ...needs, budgetTargetVnd: 1000000 }), { anchor: 1000000, lower: 800000, upper: 1200000 });
  assert.equal(getBudgetRange({ ...needs, budgetTargetVnd: 500000, budgetMaxVnd: 550000 }).upper, 550000);
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

test("alternatives do not automatically expand the requested price window", async () => {
  const result = await findAdvisorAlternatives(
    { ...needs, brandPreference: "yonex", budgetTargetVnd: 3600000 },
    { database: createDatabase([variant("nf", 4450000, "yonex")]) },
  );

  assert.equal(result, null);
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
    { ...needs, brandPreference: "victor", budgetTargetVnd: 5000000 },
    {
      database: createDatabase(
        ["a", "b", "c", "d"].map((id, index) =>
          variant(id, 4900000 + index, "yonex"),
        ),
      ),
    },
  );

  assert.equal(result.candidates.length, 3);
});
