import test from "node:test";
import assert from "node:assert/strict";
import { handleRacketMessage } from "../src/services/chatService.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";
import { loadKnowledge, retrieveKnowledge, validateKnowledge } from "../src/services/knowledgeBase.js";
import { findCatalogProductsByModel, isNamedCatalogQuestion } from "../src/services/productSearchService.js";
import { parseCatalogBalance } from "../src/services/racketSuitability.js";
import { checkNaturalReply } from "../src/services/advisorReply.js";

const keepDraft = async ({ draft }) => ({ reply: draft, source: "template" });
const unexpected = async () => assert.fail("A knowledge question must not start a buying questionnaire");
const ask = (message, extra = {}) => handleRacketMessage(message, null, null, {
  polish: keepDraft, extract: unexpected, search: unexpected, lookupProducts: unexpected, ...extra,
});

test("consultation sources and topic identifiers are validated", () => {
  const kb = structuredClone(loadKnowledge());
  assert.equal(kb.consultation_topics.length, 12);
  assert.deepEqual(validateKnowledge(kb), []);
  kb.consultation_topics[0].source_ids = ["unverified"];
  assert.ok(validateKnowledge(kb).some((error) => /Chủ đề tư vấn thiếu nguồn/.test(error)));
  kb.consultation_topics[1].id = kb.consultation_topics[0].id;
  assert.ok(validateKnowledge(kb).some((error) => /trùng mã/.test(error)));
});

test("BP education does not apply universal manufacturer thresholds or classify unknown catalog values", async () => {
  const result = await ask("BP 295 mm là nặng đầu hay cân bằng?");
  assert.match(result.reply, /không được dùng làm chuẩn hãng cho mọi model/);
  assert.match(result.reply, /ranh giới 295/);
  assert.equal(parseCatalogBalance("295 mm"), null);
  assert.equal(parseCatalogBalance("284 mm"), null);
  assert.doesNotMatch(result.reply, /ngân sách|tồn kho|₫/);
});

test("a head-light racket is not described as inevitably weak for smashing", async () => {
  const result = await ask("Vợt nhẹ đầu có đập yếu không?");
  assert.match(result.reply, /nhẹ đầu không đồng nghĩa đập yếu/);
  assert.match(result.reply, /kỹ thuật, tốc độ vung/);
});

test("gauge education does not promise tension retention or a universal durability ranking", async () => {
  const result = await ask("Dây mỏng và dây dày khác nhau thế nào?");
  assert.match(result.reply, /vật liệu, vị trí chạm cầu, mức căng/);
  assert.match(result.reply, /không thể kết luận chỉ từ đường kính/);
  assert.doesNotMatch(result.reply, /ngân sách|công căng|còn \d/);
});

test("conflicting manufacturer specifications for Nanogy 98 are disclosed instead of silently chosen", async () => {
  const result = await ask("Tôi muốn biết về cước Nanogy 98");
  assert.match(result.reply, /0\.66 mm/);
  assert.match(result.reply, /0\.69 mm/);
  assert.match(result.reply, /đối chiếu/);
  assert.doesNotMatch(result.reply, /₫|giá bán|còn hàng/);
});

test("wide-foot education does not prescribe a larger size or switch to racket advice", async () => {
  const result = await ask("Chân bè nên chọn giày như thế nào?");
  assert.match(result.reply, /Wide/);
  assert.match(result.reply, /Không tự tăng size/);
  assert.doesNotMatch(result.reply, /vợt|thân dẻo|ngân sách|₫/);
});

test("shoe cushioning and stability questions retrieve only shoe knowledge", () => {
  for (const message of ["Giày nhẹ hay đệm êm tốt hơn?", "Giày chống lật cổ chân có đảm bảo không?"]) {
    const knowledge = retrieveKnowledge(message);
    assert.ok(knowledge.snippets.length);
    assert.ok(knowledge.snippets.every((item) => item.topic.startsWith("shoe_")));
  }
});

test("beginner tension education respects current lbs rules and labels kgf values as general guidance", async () => {
  const result = await ask("Người mới chơi nên căng bao nhiêu kg?");
  assert.match(result.reply, /18-22 lbs/);
  assert.match(result.reply, /8\.2-10 kgf/);
  assert.match(result.reply, /chưa phải mức chốt/);
  assert.doesNotMatch(result.reply, /ngân sách|mua vợt|tránh chấn thương/);
});

test("higher tension is not promised to increase power or prevent injury", async () => {
  const result = await ask("Căng càng cao càng mạnh phải không?");
  assert.match(result.reply, /không đồng nghĩa đập mạnh hơn/);
  assert.match(result.reply, /không có mức căng nào được hứa ngăn chấn thương/);
});

test("generic buying constraints, shoe sizes and weight classes are not treated as named models", () => {
  assert.equal(isNamedCatalogQuestion("So sánh 3U và 4U"), false);
  assert.equal(isNamedCatalogQuestion("Giày size 42 EU nên chọn như thế nào?"), false);
  assert.equal(isNamedCatalogQuestion("Mua vợt tầm 3 triệu"), false);
  assert.equal(isNamedCatalogQuestion("Astrox 88D Tour giá bao nhiêu?"), true);
  assert.equal(isNamedCatalogQuestion("Giày Yonex 65Z4 giá bao nhiêu?"), true);
});

const publicProduct = (name, slug, category = "rackets") => ({
  id: slug, slug, name, isActive: true, category: { slug: category }, brand: { slug: "yonex" },
  variants: [{ id: slug + "-v", name: "4U", price: 2900000, attributes: { internalNotes: "private" } }],
});

test("named catalog matching distinguishes 88D from 88S and editions, while returning no internal data", async () => {
  const products = [publicProduct("Yonex Astrox 88D Tour", "d-tour"),
    publicProduct("Yonex Astrox 88S Tour", "s-tour"), publicProduct("Yonex Astrox 88D Pro", "d-pro")];
  const rows = await findCatalogProductsByModel("Astrox 88D Tour giá bao nhiêu?", {
    database: { product: { findMany: async () => products } },
  });
  assert.deepEqual(rows.map((p) => p.slug), ["d-tour"]);
  assert.equal(rows[0].variants[0].advisorSpecs, null);
  assert.doesNotMatch(JSON.stringify(rows), /internalNotes|private|stockQuantity/);
});

test("a named price question uses catalog prices without asking for skill, budget or shoe size", async () => {
  const result = await ask("Astrox 88D Tour giá bao nhiêu?", {
    lookupProducts: async () => [{ name: "Yonex Astrox 88D Tour", variants: [{ name: "4U", priceVnd: 2900000 }] }],
  });
  assert.match(result.reply, /2\.900\.000\s₫/);
  assert.doesNotMatch(result.reply, /ngân sách|trình độ|tồn kho|công căng|\?/);
});

test("missing manufacturer specs prevent invented technical comparisons", async () => {
  const result = await ask("So sánh thông số Astrox 88D Pro và Astrox 88D Tour", {
    lookupProducts: async () => [{ name: "Yonex Astrox 88D Tour", variants: [{ priceVnd: 2900000, advisorSpecs: null }] }],
  });
  assert.match(result.reply, /chưa có đủ thông số hãng đã duyệt/);
  assert.doesNotMatch(result.reply, /nặng đầu|nhẹ đầu|thân cứng|thân dẻo/);
});

test("education keeps the stored buying needs and pending question", async () => {
  const needs = { ...createEmptyNeeds(), productType: "shoes", budgetMaxVnd: 1500000 };
  const question = "Bạn mang size bao nhiêu?";
  const result = await handleRacketMessage("Chân bè nên chọn giày như thế nào?", needs, question, {
    extract: unexpected, search: unexpected, polish: keepDraft,
  });
  assert.deepEqual(result.needs, needs);
  assert.equal(result.lastQuestion, question);
});

test("a damaged frame is never cleared for a tension even when a catalog racket could allow it", async () => {
  const result = await ask("Vợt khung nứt căng 24 lbs được không?");
  assert.match(result.reply, /đừng chốt mức căng từ xa/);
  assert.doesNotMatch(result.reply, /nằm trong khoảng|bạn có thể bắt đầu/);
});

test("a named racket tension request uses its exact weight variant rather than an earlier recommendation", async () => {
  const approved = { shaftFlex: "extra_stiff", averageWeightG: 83, stringingMinLbf: 20, stringingMaxLbf: 28 };
  const result = await ask("Nanoflare 1000Z 4U căng 29 lbs được không?", {
    lookupProducts: async () => [{ name: "Yonex Nanoflare 1000Z", variants: [
      { name: "4U / G5", advisorSpecs: approved },
      { name: "3U / G5", advisorSpecs: { ...approved, averageWeightG: 88, stringingMinLbf: 21, stringingMaxLbf: 29 } },
    ] }],
  });
  assert.match(result.reply, /29 lbs vượt giới hạn 28 lbs/);
  assert.match(result.reply, /4U/);
  assert.doesNotMatch(result.reply, /nằm trong khoảng/);
});

test("ambiguous catalog duplicates do not silently supply a tension limit", async () => {
  const result = await ask("Nanoflare 1000Z 4U căng 28 lbs được không?", {
    lookupProducts: async () => [{ name: "Model A", variants: [] }, { name: "Model A again", variants: [] }],
  });
  assert.match(result.reply, /cần xác nhận đúng sản phẩm và biến thể/);
  assert.doesNotMatch(result.reply, /nằm trong khoảng/);
});

test("rewrites cannot remove important fit and tension caveats", () => {
  const examples = [
    ["Không tự tăng size chỉ để bù bề ngang.", "Nên tăng size để bù bề ngang."],
    ["Khoảng này không phải mức của hãng.", "Khoảng này là mức của hãng."],
    ["Mình chưa chốt mức nào.", "Mình chốt mức này."],
    ["Căng cao không đồng nghĩa đập mạnh hơn.", "Căng cao giúp đập mạnh hơn."],
  ];
  for (const [draft, reply] of examples) {
    assert.match(checkNaturalReply(reply, { draft, message: "Tư vấn giúp mình", facts: {} }), /đổi ý nghĩa/);
    assert.equal(checkNaturalReply(draft, { draft, message: "Tư vấn giúp mình", facts: {} }), null);
  }
  assert.match(checkNaturalReply("Dây mảnh cho cảm giác bóng rõ.", {
    draft: "Dây mảnh cho cảm giác tiếp xúc cầu rõ.", message: "Dây mỏng khác gì?", facts: {},
  }), /nhận xét thông số chưa có: bóng/);
});
