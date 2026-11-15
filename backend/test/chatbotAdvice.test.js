import test from "node:test";
import assert from "node:assert/strict";
import { decideNextAction } from "../src/services/conversationPolicy.js";
import { describeRacketRecommendations } from "../src/services/racketRecommendation.js";
import {
  answerTensionConversion,
  formatLbsRangeWithKg,
  formatLbsWithKg,
  kgToLbs,
  lbsToKg,
} from "../src/services/tensionUnits.js";
import { formatReplyParagraphs } from "../src/utils/replyFormat.js";
import { handleRacketMessage } from "../src/services/chatService.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";

const nbsp = (text) => text.replaceAll(" ", " ");

// ---------- Không hỏi "ngân sách đã gồm cước chưa" ----------

test("the bot searches once budget, level and format are known, without asking about stringing", () => {
  const needs = {
    ...createEmptyNeeds(),
    productType: "rackets",
    skillLevel: "beginner",
    playFormat: "doubles",
    budgetTargetVnd: 3000000,
    budgetIncludesStringing: null,
  };

  assert.equal(decideNextAction(needs).action, "search_products");
});

// ---------- Quy đổi lbs <-> kg ----------

test("lbs and kg convert with the documented factor and round to one decimal", () => {
  assert.equal(lbsToKg(24), 10.9);
  assert.equal(lbsToKg(26), 11.8);
  assert.equal(kgToLbs(11), 24.3);
  assert.equal(formatLbsWithKg(24), "24 lbs (khoảng 10.9 kg)");
  assert.equal(formatLbsRangeWithKg(24, 28), "24-28 lbs (khoảng 10.9-12.7 kg)");
  assert.equal(formatLbsRangeWithKg(26, 26), "26 lbs (khoảng 11.8 kg)");
});

test("short and loose conversion questions are answered, in both directions and for ranges", () => {
  assert.equal(answerTensionConversion("26 lbs bao nhiêu kg"), "26 lbs khoảng 11.8 kg.");
  assert.equal(answerTensionConversion("26lbs mấy ký?"), "26 lbs khoảng 11.8 kg.");
  assert.equal(answerTensionConversion("26 lbs = ? kg"), "26 lbs khoảng 11.8 kg.");
  assert.equal(answerTensionConversion("Đổi 11 kg sang lbs"), "11 kg khoảng 24.3 lbs.");
  assert.equal(answerTensionConversion("24-28 lbs là bao nhiêu kg"), "24-28 lbs khoảng 10.9-12.7 kg.");
});

test("a conversion table is available and built from the same factor", () => {
  const table = answerTensionConversion("bảng quy đổi lbs sang kg");

  assert.match(table, /^Quy đổi nhanh/);
  assert.match(table, /24 lbs ≈ 10\.9 kg/);
  assert.match(table, /\n/);
});

test("conversion detection ignores questions that are not plain conversions", () => {
  for (const message of [
    "Vợt này căng 28 lbs được không?",
    "BG65 là gì?",
    "cước 0.7 mm bao nhiêu kg",
    "26 lbs",
    "11 kg bằng 11 kg",
  ]) assert.equal(answerTensionConversion(message), null, message);
});

test("an unusual number is still converted but the unit is double-checked", () => {
  assert.match(answerTensionConversion("60 lbs bao nhiêu kg"), /kiểm tra lại đơn vị/);
});

test("a plain conversion question in chat gets the conversion and no racket list", async () => {
  const needs = { ...createEmptyNeeds(), productType: "rackets", skillLevel: "beginner", playFormat: "doubles", budgetTargetVnd: 3000000 };
  const fail = async () => assert.fail("a unit conversion must not call AI or search");
  const result = await handleRacketMessage("26 lbs bao nhiêu kg vậy", needs, null, {
    extract: fail, search: fail, findAlternatives: fail, polish: fail,
  });

  assert.equal(result.reply, "26 lbs khoảng 11.8 kg.");
  assert.deepEqual(result.candidates, []);
});

// ---------- Định dạng đoạn ----------

test("a long one-block reply is split into short paragraphs with the question last", () => {
  const text =
    "Mình hiểu nhu cầu của bạn. Vợt nhẹ đầu hợp lối đánh đôi. Bạn nên thử thực tế trước khi mua. " +
    "Giá tham khảo khoảng 3.000.000 ₫. Bạn thích đánh đơn hay đôi?";
  const formatted = formatReplyParagraphs(text);

  assert.match(formatted, /\n\n/);
  assert.ok(formatted.endsWith("Bạn thích đánh đơn hay đôi?"));
  assert.ok(formatted.endsWith("\n\nBạn thích đánh đơn hay đôi?"));
  // Số tiền và số thập phân không bị tách thành câu.
  assert.ok(formatted.includes("3.000.000 ₫"));
});

test("short or already structured replies are left alone", () => {
  assert.equal(formatReplyParagraphs("Mình hiểu rồi. Cảm ơn bạn."), "Mình hiểu rồi. Cảm ơn bạn.");
  assert.equal(formatReplyParagraphs("Dòng 1.\nDòng 2. Dòng 3. Dòng 4."), "Dòng 1.\nDòng 2. Dòng 3. Dòng 4.");
  assert.equal(formatReplyParagraphs(""), "");
});

// ---------- Câu tư vấn vợt ----------

const needs = {
  ...createEmptyNeeds(),
  productType: "rackets",
  skillLevel: "beginner",
  playFormat: "doubles",
  budgetTargetVnd: 3000000,
};

const specs = (overrides = {}) => ({
  weightClass: "4U",
  averageWeightG: 83,
  shaftFlex: "flexible",
  balanceType: "head_light",
  stringingMinLbf: 20,
  stringingMaxLbf: 28,
  sourceKind: "manufacturer",
  ...overrides,
});

const racket = (name, priceVnd, extra = {}) => ({
  name,
  variantName: "4U / G5",
  priceVnd,
  description: "Vợt nhẹ, xoay trở nhanh cho lối đánh đôi. Thân vợt mảnh.",
  advisorSpecs: specs(),
  racketTraits: { weightClass: "4U", shaftFlex: "flexible", balanceType: "head_light", specSource: "manufacturer" },
  fit: { tier: 2, score: 2, fitNotes: ["hạng 4U, thân dẻo — khớp gợi ý cho người mới"], cautionNotes: [] },
  ...extra,
});

test("a recommendation lists each racket with specs, a reason, its description and the stringing notice", () => {
  const text = nbsp(describeRacketRecommendations(needs, [
    racket("Vợt cầu lông Yonex A", 2900000),
    racket("Vợt cầu lông Yonex B", 3100000),
    racket("Vợt cầu lông Yonex C", 3300000),
  ]));

  assert.match(text, /em gợi ý 3 mẫu vợt/);
  for (const letter of ["A", "B", "C"]) assert.match(text, new RegExp(`Yonex ${letter} \\(4U / G5\\)`));
  assert.equal((text.match(/chưa gồm tiền căng cước\)/g) ?? []).length, 3);
  assert.match(text, /Chưa gồm tiền căng cước\./);
  assert.match(text, /Thông số: hạng 4U \(khoảng 83 g\), thân dẻo, nhẹ đầu\./);
  assert.match(text, /Hãng khuyến nghị căng 20-28 lbs \(khoảng 9\.1-12\.7 kg\)/);
  assert.match(text, /Vì sao phù hợp: hạng 4U, thân dẻo — khớp gợi ý cho người mới/);
  assert.match(text, /Đặc tính: Vợt nhẹ, xoay trở nhanh cho lối đánh đôi\./);
  assert.doesNotMatch(text, /Thân vợt mảnh/);
  // Có xuống dòng, mỗi mẫu một khối.
  assert.ok(text.split("\n\n").length >= 6);
});

test("a recommendation never shows more than five rackets", () => {
  const many = Array.from({ length: 7 }, (_, index) => racket(`Vợt ${index + 1}`, 3000000 + index));
  const text = describeRacketRecommendations(needs, many);

  assert.match(text, /em gợi ý 5 mẫu vợt/);
  assert.doesNotMatch(text, /6\. Vợt/);
});

test("specs missing from the data are not invented and the gap is admitted", () => {
  const bare = {
    name: "Vợt X",
    variantName: "Default Title",
    priceVnd: 2800000,
    description: null,
    advisorSpecs: null,
    racketTraits: { weightClass: null, shaftFlex: null, balanceType: null, specSource: null },
    fit: { tier: 1, score: 0, fitNotes: [], cautionNotes: [] },
  };
  const text = describeRacketRecommendations(needs, [bare]);

  assert.match(text, /1\. Vợt X\n/);
  assert.doesNotMatch(text, /Default Title/);
  assert.doesNotMatch(text, /Thông số:/);
  assert.doesNotMatch(text, /Đặc tính:/);
  assert.match(text, /chưa có đủ thông số hãng đã duyệt/);
  assert.doesNotMatch(text, /nhẹ đầu|nặng đầu|thân dẻo|thân cứng/);
});

test("specs taken from the shop's own text are shown without a source label", () => {
  const fromShop = racket("Vợt Y", 2900000, {
    advisorSpecs: null,
    racketTraits: { weightClass: "4U", shaftFlex: "stiff", balanceType: "head_heavy", specSource: "catalog_text" },
  });
  const text = describeRacketRecommendations({ ...needs, skillLevel: "advanced" }, [fromShop]);

  assert.match(text, /thân cứng/);
  assert.match(text, /nặng đầu/);
  assert.doesNotMatch(text, /theo mô tả của shop/);
});

test("a stiff racket gets an honest caution for a beginner", () => {
  const stiff = racket("Vợt Z", 2900000, {
    advisorSpecs: specs({ shaftFlex: "stiff" }),
    racketTraits: { weightClass: "4U", shaftFlex: "stiff", balanceType: "head_light", specSource: "manufacturer" },
    fit: { tier: 1, score: 0, fitNotes: [], cautionNotes: [] },
  });
  const text = describeRacketRecommendations(needs, [stiff]);

  assert.match(text, /Lưu ý: .*khó đánh hơn/);
});

test("a tension suggestion for the player's level is given in both units", () => {
  const text = nbsp(describeRacketRecommendations(needs, [racket("Vợt A", 2900000)]));

  assert.match(text, /anh\/chị có thể bắt đầu ở khoảng 20-22 lbs \(khoảng 9\.1-10 kg\)/);
});

// ---------- Hỏi tiếp thì không đưa lại vợt ----------

const full = { ...needs };

test("a conversion or knowledge question after a recommendation brings no rackets back", async () => {
  const candidates = [racket("Vợt A", 2900000)];
  const search = async () => ({ status: "CANDIDATES_FOUND", initialBudgetVnd: 3000000, candidates });
  const polish = async ({ draft }) => ({ reply: draft, source: "template", reason: null });

  const first = await handleRacketMessage("Mình đánh đôi", { ...full, playFormat: null }, "Bạn chủ yếu đánh đơn, đánh đôi hay cả hai?", {
    extract: async () => full, search, polish, searchStrings: async () => [],
  });
  assert.equal(first.candidates.length, 1);
  assert.match(first.reply, /Chưa gồm tiền căng cước\./);

  for (const message of ["Vợt nặng đầu với nhẹ đầu khác nhau thế nào?", "26 lbs bao nhiêu kg"]) {
    const next = await handleRacketMessage(message, first.needs, first.lastQuestion, {
      extract: async () => full, search, polish, searchStrings: async () => [],
    });

    assert.deepEqual(next.candidates, [], message);
    assert.doesNotMatch(next.reply, /em gợi ý|Vợt A/, message);
  }
});
