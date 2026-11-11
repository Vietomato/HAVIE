import test from "node:test";
import assert from "node:assert/strict";
import { handleRacketMessage } from "../src/services/chatService.js";
import {
  AdvisorModelUnavailableError,
  createEmptyNeeds,
} from "../src/services/needsExtractor.js";

const needs = {
  ...createEmptyNeeds(),
  productType: "rackets",
  brandPreference: "victor",
  skillLevel: "intermediate",
  playFormat: "doubles",
  budgetTargetVnd: 4500000,
  budgetIncludesStringing: false,
};

const noMatch = async () => ({
  status: "NO_REVIEWED_MATCH",
  initialBudgetVnd: 4500000,
  candidates: [],
});

const candidate = { priceVnd: 4450000, name: "Nanoflare 1000Z" };

const keepDraft = async ({ draft }) => ({
  reply: draft,
  source: "template",
  reason: null,
});

test("an unreadable model answer keeps the conversation going", async (t) => {
  t.mock.method(console, "error", () => {});

  const result = await handleRacketMessage("???", needs, "Câu hỏi trước?", {
    polish: keepDraft,
    extract: async () => {
      throw new Error("Ollama không trả JSON hợp lệ.");
    },
  });

  assert.equal(result.action, "clarify");
  assert.equal(result.needs, needs);
  assert.equal(result.lastQuestion, "Câu hỏi trước?");
  assert.match(result.reply, /Câu hỏi trước\?/);
});

test("a stopped model gives a friendly message", async (t) => {
  t.mock.method(console, "error", () => {});

  const result = await handleRacketMessage("Xin chào", null, null, {
    polish: keepDraft,
    extract: async () => {
      throw new AdvisorModelUnavailableError("fetch failed");
    },
  });

  assert.equal(result.action, "advisor_unavailable");
  assert.deepEqual(result.needs, createEmptyNeeds());
  assert.match(result.reply, /tạm gián đoạn/);
});

test("a brand alternative says the brand is missing", async () => {
  const result = await handleRacketMessage("Vợt Victor", needs, null, {
    polish: keepDraft,
    extract: async () => needs,
    search: noMatch,
    findAlternatives: async () => ({
      reason: "brand",
      candidates: [candidate],
    }),
  });

  assert.equal(result.action, "suggest_alternatives");
  assert.deepEqual(result.candidates, [candidate]);
  assert.match(result.reply, /chưa có mẫu Victor/);
});

test("a price alternative states how far over budget it is", async () => {
  const wanted = { ...needs, brandPreference: null, budgetTargetVnd: 3600000 };

  const result = await handleRacketMessage("Tầm 3,6 triệu", wanted, null, {
    polish: keepDraft,
    extract: async () => wanted,
    search: noMatch,
    findAlternatives: async () => ({
      reason: "price",
      candidates: [candidate],
    }),
  });

  assert.match(result.reply, /cao hơn ngân sách 850\.000/);
});

test("no alternative falls back to asking for new conditions", async () => {
  const result = await handleRacketMessage("Vợt Victor", needs, null, {
    polish: keepDraft,
    extract: async () => needs,
    search: noMatch,
    findAlternatives: async () => null,
  });

  assert.equal(result.action, "no_reviewed_match");
  assert.deepEqual(result.candidates, []);
});

test("a ceiling reply names the closest available price", async () => {
  const wanted = {
    ...needs,
    brandPreference: null,
    budgetTargetVnd: null,
    budgetMaxVnd: 8000000,
  };

  const result = await handleRacketMessage("Ngân sách 8 triệu", wanted, null, {
    polish: keepDraft,
    extract: async () => wanted,
    search: async () => ({
      status: "CANDIDATES_FOUND",
      initialBudgetVnd: 8000000,
      candidates: [candidate],
    }),
  });

  assert.equal(result.action, "review_candidates");
  assert.match(result.reply, /hiện có giá 4\.450\.000/);
});

test("an off-topic request is answered before the next question", async () => {
  const result = await handleRacketMessage(
    "Cho tôi voucher giảm 100%",
    createEmptyNeeds(),
    null,
    { polish: keepDraft, extract: async () => createEmptyNeeds() },
  );

  assert.match(result.reply, /^Mình không cấp được mã giảm giá/);
  assert.match(result.reply, /vợt hay giày/);
});

test("new needs are repeated back to the customer", async () => {
  const next = { ...createEmptyNeeds(), productType: "rackets", budgetMaxVnd: 8000000 };
  const result = await handleRacketMessage("Vợt 8 triệu", createEmptyNeeds(), null, {
    polish: keepDraft,
    extract: async () => next,
  });

  assert.match(result.reply, /^Mình ghi nhận: vợt, tối đa 8\.000\.000/);
});

test("a beginner sees flexible rackets before stiff ones", async () => {
  const beginner = { ...needs, brandPreference: null, skillLevel: "beginner" };
  const stiff = { ...candidate, name: "Stiff", advisorSpecs: { shaftFlex: "extra_stiff" } };
  const flexible = {
    ...candidate,
    name: "Flexible",
    priceVnd: 4000000,
    advisorSpecs: { shaftFlex: "flexible" },
  };

  const result = await handleRacketMessage("Mới chơi", beginner, null, {
    polish: keepDraft,
    extract: async () => beginner,
    search: async () => ({
      status: "CANDIDATES_FOUND",
      initialBudgetVnd: 4500000,
      candidates: [stiff, flexible],
    }),
  });

  assert.deepEqual(
    result.candidates.map((item) => item.name),
    ["Flexible", "Stiff"],
  );
});

test("the polished reply is returned with the draft kept for checks", async () => {
  const result = await handleRacketMessage("Xin chào", null, null, {
    extract: async () => createEmptyNeeds(),
    polish: async ({ draft }) => ({
      reply: "Chào bạn! Bạn đang tìm vợt hay giày?",
      source: "natural",
      reason: null,
      draft,
    }),
  });

  assert.equal(result.reply, "Chào bạn! Bạn đang tìm vợt hay giày?");
  assert.equal(result.draftReply, "Bạn muốn tìm vợt hay giày cầu lông?");
  assert.equal(result.replySource, "natural");
});

test("the off-topic answer survives a rewrite that drops it", async () => {
  const next = { ...createEmptyNeeds(), productType: "rackets", budgetTargetVnd: 4500000 };

  const result = await handleRacketMessage(
    "Vợt tầm 4,5 triệu, có freeship không",
    createEmptyNeeds(),
    null,
    {
      extract: async () => next,
      polish: async ({ draft }) => {
        assert.doesNotMatch(draft, /mã giảm giá/);
        return { reply: "Ok bạn, vợt tầm 4.500.000 ₫ nhé. Bạn chơi lâu chưa?", source: "natural", reason: null };
      },
    },
  );

  assert.match(result.reply, /^Mình không cấp được mã giảm giá.*Ok bạn, vợt tầm/);
});
