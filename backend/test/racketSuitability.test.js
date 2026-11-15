import test from "node:test";
import assert from "node:assert/strict";
import { handleRacketMessage } from "../src/services/chatService.js";
import { loadKnowledge, validateKnowledge } from "../src/services/knowledgeBase.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";
import { searchAdvisorProducts } from "../src/services/productSearchService.js";
import {
  assessRacket,
  parseCatalogSpecs,
  readWeightClass,
  SUITABILITY_TIERS,
} from "../src/services/racketSuitability.js";

process.env.AI_PROVIDER = "ollama";

const needsFor = (overrides = {}) => ({
  ...createEmptyNeeds(),
  productType: "rackets",
  skillLevel: "intermediate",
  playFormat: "singles",
  budgetMaxVnd: 5000000,
  budgetIncludesStringing: false,
  ...overrides,
});

const traits = (overrides = {}) => ({
  weightClass: null,
  shaftFlex: null,
  balanceType: null,
  specSource: null,
  ...overrides,
});

// ---------- Đọc dữ liệu cây vợt ----------

test("the weight class is read from the variant, then its name", () => {
  assert.equal(readWeightClass({ attributes: { weight: "3U" } }), "3U");
  assert.equal(readWeightClass({ variantName: "4U / G5" }), "4U");
  assert.equal(readWeightClass({ variantName: "SILVER/BLACK / 4UG5" }), null);
  assert.equal(readWeightClass({ productName: "Vợt Li-Ning Halbertec 7000 - 4U" }), "4U");
  assert.equal(readWeightClass({ variantName: "3.5U / G5" }), "3.5U");
  assert.equal(readWeightClass({ variantName: "Default Title" }), null);
});

test("flex and balance are read from the shop description, mm-only balance is not guessed", () => {
  assert.deepEqual(
    parseCatalogSpecs(["Trọng lượng: 4U", "Độ cứng: Cứng (Stiff)", "Điểm cân bằng: Nặng đầu (Head Heavy)"]),
    { shaftFlex: "stiff", balanceType: "head_heavy" },
  );
  assert.deepEqual(
    parseCatalogSpecs(["Độ cứng: Rất cứng (Extra Stiff)", "Điểm cân bằng: 300mm"]),
    { shaftFlex: "extra_stiff", balanceType: null },
  );
  assert.deepEqual(
    parseCatalogSpecs(["Độ cứng: Dẻo linh hoạt", "Điểm cân bằng: Nhẹ đầu (Head Light)"]),
    { shaftFlex: "flexible", balanceType: "head_light" },
  );
  assert.deepEqual(parseCatalogSpecs(undefined), { shaftFlex: null, balanceType: null });
});

// ---------- Luật của kho kiến thức ----------

test("a beginner fits a 4U flexible racket and is told why", () => {
  const result = assessRacket(traits({ weightClass: "4U", shaftFlex: "flexible" }), needsFor({ skillLevel: "beginner" }));

  assert.equal(result.tier, SUITABILITY_TIERS.fit);
  assert.equal(result.fitNotes[0], "hạng 4U, thân dẻo — khớp gợi ý cho người mới");
});

test("an extra-stiff racket is excluded for a beginner, a stiff one only gets a caution", () => {
  const beginner = needsFor({ skillLevel: "beginner" });

  assert.equal(assessRacket(traits({ shaftFlex: "extra_stiff" }), beginner).excluded, true);

  const stiff = assessRacket(traits({ shaftFlex: "stiff" }), beginner);
  assert.equal(stiff.excluded, false);
  assert.equal(stiff.tier, SUITABILITY_TIERS.caution);
  assert.equal(stiff.cautionNotes[0], "thân cứng chưa hợp với người mới");
});

test("a 3U racket is a caution for a beginner but fine for an intermediate player", () => {
  assert.equal(assessRacket(traits({ weightClass: "3U" }), needsFor({ skillLevel: "beginner" })).tier, SUITABILITY_TIERS.caution);
  assert.equal(assessRacket(traits({ weightClass: "3U" }), needsFor()).tier, SUITABILITY_TIERS.neutral);
});

test("a racket with no known traits is judged neither fit nor unfit", () => {
  const result = assessRacket(traits(), needsFor({ skillLevel: "beginner", playFormat: "doubles" }));

  assert.equal(result.tier, SUITABILITY_TIERS.neutral);
  assert.deepEqual(result.fitNotes, []);
});

test("doubles prefers 4U/5U and a head-light or even balance", () => {
  const doubles = needsFor({ playFormat: "doubles" });

  assert.equal(assessRacket(traits({ weightClass: "5U", balanceType: "head_light" }), doubles).tier, SUITABILITY_TIERS.fit);
  assert.equal(assessRacket(traits({ weightClass: "3U", balanceType: "head_heavy" }), doubles).tier, SUITABILITY_TIERS.neutral);
});

test("a head-heavy wish fits a head-heavy racket and marks a head-light one as a caution", () => {
  const wish = needsFor({ balancePreference: "head_heavy" });

  assert.equal(assessRacket(traits({ balanceType: "head_heavy", specSource: "catalog_text" }), wish).tier, SUITABILITY_TIERS.fit);
  assert.equal(assessRacket(traits({ balanceType: "head_light" }), wish).tier, SUITABILITY_TIERS.caution);
});

test("a head-light wish still accepts an even-balance racket", () => {
  const wish = needsFor({ balancePreference: "head_light" });

  assert.notEqual(assessRacket(traits({ balanceType: "even" }), wish).tier, SUITABILITY_TIERS.caution);
});

test("an explicit weight wish outweighs the general guidance", () => {
  const light = needsFor({ skillLevel: "advanced", weightPreference: "nhẹ" });

  assert.equal(assessRacket(traits({ weightClass: "5U" }), light).tier, SUITABILITY_TIERS.fit);
  assert.equal(assessRacket(traits({ weightClass: "3U" }), light).tier, SUITABILITY_TIERS.caution);
});

test("notes taken from the shop description do not add a source label", () => {
  const result = assessRacket(
    traits({ shaftFlex: "flexible", specSource: "catalog_text" }),
    needsFor({ skillLevel: "beginner" }),
  );

  assert.match(result.fitNotes[0], /thân dẻo/);
  assert.doesNotMatch(result.fitNotes[0], /theo mô tả của shop/);
});

test("broken suitability rules are rejected when the knowledge base loads", () => {
  const kb = structuredClone(loadKnowledge());
  kb.racquet.suitability_rules.by_skill.beginner.weight_classes.prefer.push("9U");
  kb.racquet.suitability_rules.by_skill.beginner.shaft_flex.avoid.push("flexible");
  kb.racquet.suitability_rules.by_priority.unknown_priority = {};

  const errors = validateKnowledge(kb);
  assert.ok(errors.some((item) => item.includes("giá trị không hợp lệ: 9U")));
  assert.ok(errors.some((item) => item.includes("vừa prefer vừa avoid")));
  assert.ok(errors.some((item) => item.includes("mã không hợp lệ: unknown_priority")));
});

// ---------- Tìm kiếm ----------

function variant(id, price, { weight = "4U", specs = [], name, productName } = {}) {
  return {
    id,
    sku: `SKU-${id}`,
    name: name ?? `${weight} / G5`,
    price,
    stockQuantity: 10,
    isAvailable: true,
    attributes: { weight },
    product: {
      id: `p-${productName ?? id}`,
      name: productName ?? `Vợt ${id}`,
      slug: id,
      imageUrls: [],
      specs,
      isActive: true,
      advisorEnabled: false,
      brand: { name: "Yonex", slug: "yonex" },
    },
  };
}

const database = (variants) => ({
  productVariant: {
    findMany: async ({ where }) =>
      variants.filter((item) => item.price >= where.price.gte && item.price <= where.price.lte),
  },
});

const beginner = needsFor({ skillLevel: "beginner" });
const search = (variants, needs = beginner) =>
  searchAdvisorProducts(needs, { database: database(variants), allowUnreviewedStock: true });

const extraStiff = ["Độ cứng: Rất cứng (Extra Stiff)"];

test("semantic ranking never indexes rackets rejected for suitability or opposite balance", async () => {
  const rows = [
    variant("hard", 3000000, { specs: extraStiff }),
    variant("heavy", 2900000, { specs: ["Điểm cân bằng: Nặng đầu"] }),
    variant("light-a", 2800000, { specs: ["Điểm cân bằng: Nhẹ đầu"] }),
    variant("light-b", 2700000, { specs: ["Điểm cân bằng: Nhẹ đầu"] }),
  ];
  let indexed = [];
  const result = await searchAdvisorProducts({ ...beginner, balancePreference: "head_light" }, {
    database: database(rows), allowUnreviewedStock: true, query: "xoay trở linh hoạt",
    rank: async (_, documents) => { indexed = documents.map((doc) => doc.id); return { hits: [] }; },
  });
  assert.deepEqual(indexed.sort(), ["light-a", "light-b"]);
  assert.ok(result.candidates.every((item) => item.racketTraits.balanceType === "head_light"));
});

test("a racket that does not suit the player is left out and counted", async () => {
  const result = await search([
    variant("hard", 4000000, { specs: extraStiff }),
    variant("a", 3800000),
    variant("b", 3700000),
    variant("c", 3600000),
  ]);

  assert.deepEqual(result.candidates.map((item) => item.name).sort(), ["Vợt a", "Vợt b", "Vợt c"]);
  assert.equal(result.excludedForFit, 1);
});

test("the variant that suits the player represents the product", async () => {
  const result = await search([
    variant("v3", 3500000, { weight: "3U", productName: "Vợt X" }),
    variant("v4", 3600000, { weight: "4U", productName: "Vợt X" }),
  ]);

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].weightClass, "4U");
});

test("suitable rackets come before rackets with no data, whatever their price", async () => {
  const result = await search([
    variant("unknown", 4900000, { weight: "?", name: "Default Title" }),
    variant("fit", 3000000, { weight: "4U" }),
  ]);

  assert.deepEqual(result.candidates.map((item) => item.name), ["Vợt fit", "Vợt unknown"]);
});

test("too few suitable rackets are topped up with cautions, never with excluded ones", async () => {
  const result = await search([
    variant("fit", 3000000, { weight: "4U" }),
    variant("heavy", 3100000, { weight: "3U" }),
    variant("hard", 3200000, { weight: "4U", specs: extraStiff }),
  ]);

  assert.deepEqual(result.candidates.map((item) => item.name), ["Vợt fit", "Vợt heavy"]);
  assert.equal(result.candidates[1].fit.tier, SUITABILITY_TIERS.caution);
  assert.equal(result.excludedForFit, 1);
});

test("enough suitable rackets means cautions are not shown", async () => {
  const result = await search([
    variant("a", 3000000),
    variant("b", 3100000),
    variant("c", 3200000),
    variant("heavy", 3300000, { weight: "3U" }),
  ]);

  assert.equal(result.candidates.some((item) => item.name === "Vợt heavy"), false);
});

test("an intermediate player is not filtered by the beginner rules", async () => {
  const result = await search(
    [variant("hard", 4000000, { specs: extraStiff }), variant("a", 3800000, { weight: "3U" })],
    needsFor({ skillLevel: "intermediate" }),
  );

  assert.equal(result.candidates.length, 2);
  assert.equal(result.excludedForFit, 0);
});

test("shoes are not filtered by racket rules", async () => {
  const shoe = variant("shoe", 2750000, { name: "Size 42" });
  const result = await search([shoe], { ...beginner, productType: "shoes", budgetMaxVnd: 3000000 });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.excludedForFit, 0);
});

// ---------- Câu trả lời ----------

const previous = { ...createEmptyNeeds(), productType: "rackets", budgetMaxVnd: 5000000 };
const keepDraft = async ({ draft }) => ({ reply: draft, source: "template", reason: null });

const chat = (variants, needs = beginner) =>
  handleRacketMessage("Mới chơi", previous, "Bạn mới bắt đầu hay tự đánh giá trình độ hiện tại thế nào?", {
    polish: keepDraft,
    extract: async () => needs,
    search: (n) => searchAdvisorProducts(n, { database: database(variants), allowUnreviewedStock: true }),
    findAlternatives: async () => null,
  });

test("the reply says why the top racket suits the player and how many were left out", async () => {
  const result = await chat([
    variant("fit", 3800000),
    variant("a", 3700000),
    variant("b", 3600000),
    variant("hard", 3900000, { specs: extraStiff }),
  ]);

  assert.match(result.reply, /Vì sao phù hợp: hạng 4U — khớp gợi ý cho người mới/);
  assert.match(result.reply, /Em đã bỏ 1 mẫu trong tầm giá vì chưa hợp/);
});

test("every shown racket carries its own price and the stringing notice", async () => {
  const result = await chat([
    variant("a", 4900000, { weight: "4U" }),
    variant("b", 2000000, { weight: "4U" }),
    variant("c", 3000000, { weight: "4U" }),
    variant("near", 5000000, { weight: "?", name: "Default Title" }),
  ]);

  // Giá được định dạng kiểu vi-VN, có thể dùng khoảng trắng không ngắt trước ₫.
  const reply = result.reply.replaceAll(" ", " ");
  for (const price of ["4.900.000", "2.000.000", "3.000.000", "5.000.000"]) {
    assert.ok(
      reply.includes(`Giá: ${price} ₫ (chưa gồm tiền căng cước)`),
      `thiếu giá ${price} kèm ghi chú chưa gồm tiền căng cước`,
    );
  }
  assert.match(result.reply, /Chưa gồm tiền căng cước\./);
});

test("when everything in range is unsuitable the bot says so instead of claiming nothing exists", async () => {
  const result = await chat([variant("hard", 3900000, { specs: extraStiff })]);

  assert.equal(result.action, "no_reviewed_match");
  assert.match(result.reply, /Trong tầm giá có 1 mẫu nhưng chưa hợp/);
});

test("the draft never attributes flex or balance to a racket whose data has none", async () => {
  const doubles = needsFor({ skillLevel: "beginner", playFormat: "doubles" });
  const result = await chat([variant("a", 3900000, { weight: "4U" })], doubles);

  assert.match(result.draftReply, /hạng 4U — khớp gợi ý cho người mới, đánh đôi/);
  assert.doesNotMatch(result.draftReply, /dẻo|nhẹ đầu|nặng đầu|cân bằng|trung bình|cứng/);
});

test("saying the budget has no stringing, or asking for racket advice, does not trigger string advice", async () => {
  const { retrieveKnowledge } = await import("../src/services/knowledgeBase.js");

  for (const message of [
    "Tư vấn vợt cho mình, mới chơi, đánh đôi, tối đa 4 triệu, chưa gồm cước",
    "Ngân sách này chưa gồm cước nha",
    "Mình đánh đôi, tư vấn giúp mình",
  ]) {
    const result = retrieveKnowledge(message);
    assert.deepEqual(result.snippets, [], message);
    assert.equal(result.stringNotice, null, message);
  }

  assert.equal(retrieveKnowledge("Tư vấn cước giúp mình").snippets[0].topic, "string_choice");
  assert.equal(retrieveKnowledge("Mình nên dùng cước nào?").snippets[0].topic, "string_choice");
});
