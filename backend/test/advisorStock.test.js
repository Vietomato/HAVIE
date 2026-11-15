import test from "node:test";
import assert from "node:assert/strict";
import { searchAdvisorProducts, searchYonexStrings } from "../src/services/productSearchService.js";

// Giả lập database: chỉ lọc theo giá và hãng như câu truy vấn thật; phần phân loại
// hàng đã duyệt / hàng thật / dữ liệu catalog nằm trong hàm tìm kiếm.
const approved = {
  advisor: {
    schemaVersion: 1,
    modelCode: "NF",
    shaftFlex: "extra_stiff",
    averageWeightG: 83,
    stringingAdvice: { minLbf: 20, maxLbf: 28 },
    sourceUrl: "https://example.com/spec",
    reviewStatus: "APPROVED",
  },
};

function variant(id, price, overrides = {}) {
  const { product = {}, ...rest } = overrides;

  return {
    id,
    sku: `SKU-${id}`,
    name: "4U / G5",
    price,
    stockQuantity: 10,
    isAvailable: true,
    attributes: {},
    product: {
      id: `product-${id}`,
      name: `Vợt ${id}`,
      slug: id,
      imageUrls: [],
      isActive: true,
      advisorEnabled: false,
      brand: { name: "Yonex", slug: "yonex" },
      ...product,
    },
    ...rest,
  };
}

const database = (variants) => ({
  productVariant: {
    findMany: async ({ where }) =>
      variants.filter(
        (item) =>
          item.price >= where.price.gte &&
          item.price <= where.price.lte &&
          (!where.product.brand || item.product.brand.slug === where.product.brand.slug),
      ),
  },
});

const needs = {
  productType: "rackets",
  brandPreference: null,
  budgetTargetVnd: null,
  budgetMaxVnd: 5000000,
};

test("Yonex strings use live variant prices and stock, without requiring racket advisor specs", async () => {
  const string = (id, name, overrides = {}) => variant(id, 173000, {
    name: "White / 10m", ...overrides,
    product: {
      name, category: { slug: "accessories" },
      ...(overrides.product ?? {}),
    },
  });
  const rows = [
    string("bg", "Cước Yonex BG65"),
    string("ti", "Cước Yonex BG65 Titanium", { stockQuantity: 0 }),
    string("ex", "Cước Yonex BGXB63", { isAvailable: false }),
    string("bad", "Cước Yonex BG65", { price: 0, stockQuantity: -1 }),
    string("hidden", "Cước Yonex BG65", { product: { isActive: false } }),
    string("racket", "Vợt tặng BG65", { product: { category: { slug: "rackets" } } }),
    string("brand", "BG65", { product: { brand: { slug: "victor" } } }),
    string("bundle", "BG65 + BG80"),
  ];
  let query;
  const result = await searchYonexStrings(["BG65", "BG65 Titanium", "Exbolt 63"], {
    database: { productVariant: { findMany: async (input) => { query = input; return rows; } } },
  });
  assert.equal(query.where.product.isActive, true);
  assert.equal(query.where.product.brand.slug, "yonex");
  assert.deepEqual(result.map((r) => r.variantId), ["bg", "ti", "ex", "bad"]);
  assert.equal(result[0].priceVnd, 173000);
  assert.equal(result[0].stockQuantity, 10);
  assert.equal(result[1].model, "BG65 Titanium");
  assert.equal(result[1].stockQuantity, 0);
  assert.equal(result[2].model, "Exbolt 63");
  assert.equal(result[2].isAvailable, false);
  assert.equal(result[3].priceVnd, null);
  assert.equal(result[3].stockQuantity, null);
});

test("unknown string models never query the catalog", async () => {
  const result = await searchYonexStrings(["Invented string"], {
    database: { productVariant: { findMany: async () => assert.fail("unexpected query") } },
  });
  assert.deepEqual(result, []);
});

const search = (variants, options = {}, override = {}) =>
  searchAdvisorProducts({ ...needs, ...override }, { database: database(variants), ...options });

test("a racket on sale without approved specs is found, but flagged unverified", async () => {
  const result = await search([variant("a", 3900000)], { allowUnreviewedStock: true });

  assert.equal(result.status, "CANDIDATES_FOUND");
  assert.equal(result.candidates[0].name, "Vợt a");
  assert.equal(result.candidates[0].specsVerified, false);
  assert.equal(result.candidates[0].advisorSpecs, null);
  assert.equal(result.candidates[0].catalogOnly, false);
  assert.equal(result.includesUnreviewedStock, true);
});

test("an approved racket keeps its verified specs", async () => {
  const result = await search(
    [variant("nf", 4450000, { attributes: approved, product: { advisorEnabled: true } })],
    { allowUnreviewedStock: true },
  );

  assert.equal(result.candidates[0].specsVerified, true);
  assert.equal(result.candidates[0].advisorSpecs.stringingMaxLbf, 28);
});

test("strict mode returns only approved rackets", async () => {
  const result = await search(
    [
      variant("nf", 4450000, { attributes: approved, product: { advisorEnabled: true } }),
      variant("a", 3900000),
    ],
    { allowUnreviewedStock: false },
  );

  assert.deepEqual(result.candidates.map((item) => item.name), ["Vợt nf"]);
});

test("out-of-stock, unavailable and hidden products are never returned", async () => {
  const result = await search(
    [
      variant("no-stock", 3000000, { stockQuantity: 0 }),
      variant("unavailable", 3100000, { isAvailable: false }),
      variant("hidden", 3200000, { product: { isActive: false } }),
    ],
    { allowUnreviewedStock: true },
  );

  assert.equal(result.status, "NO_REVIEWED_MATCH");
});

test("catalog-imported products (CAT-) that the storefront sells are found like any other", async () => {
  const items = [
    variant("victor", 2690000, {
      sku: "CAT-VICTOR-1",
      stockQuantity: 20,
      attributes: { marketPriceReference: { currency: "VND", shop: "HVShop" } },
      product: { brand: { name: "Victor", slug: "victor" } },
    }),
  ];

  const result = await search(items, { allowUnreviewedStock: true });

  assert.equal(result.candidates[0].name, "Vợt victor");
  assert.equal(result.candidates[0].brand, "Victor");
  assert.equal(result.candidates[0].specsVerified, false);
});

test("a catalog item with no stock is still not offered", async () => {
  const items = [variant("victor", 2690000, { sku: "CAT-VICTOR-2", stockQuantity: 0 })];

  const result = await search(items, { allowUnreviewedStock: true });

  assert.equal(result.status, "NO_REVIEWED_MATCH");
});

test("a shoe on sale is found and still needs size verification without a size", async () => {
  const shoe = variant("shoe", 2750000, { name: "Size 42", attributes: { size: 42, sizeSystem: "EU" } });

  const result = await search([shoe], { allowUnreviewedStock: true }, { productType: "shoes", budgetMaxVnd: 3000000 });

  assert.equal(result.status, "CANDIDATES_FOUND");
  assert.equal(result.candidates[0].sizeStatus, "needs_size_verification");
});

test("the budget ceiling still applies to unverified stock", async () => {
  const result = await search([variant("a", 5200000)], { allowUnreviewedStock: true });

  assert.equal(result.status, "NO_REVIEWED_MATCH");
});

test("the env switch ADVISOR_ONLY_REVIEWED=true turns the unreviewed stock off", async () => {
  const before = process.env.ADVISOR_ONLY_REVIEWED;
  process.env.ADVISOR_ONLY_REVIEWED = "true";

  try {
    const result = await search([variant("a", 3900000)]);
    assert.equal(result.status, "NO_REVIEWED_MATCH");
    assert.equal(result.includesUnreviewedStock, false);
  } finally {
    if (before === undefined) delete process.env.ADVISOR_ONLY_REVIEWED;
    else process.env.ADVISOR_ONLY_REVIEWED = before;
  }
});
