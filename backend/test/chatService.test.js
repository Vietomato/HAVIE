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

test("an unreadable model answer keeps the conversation going", async (t) => {
  t.mock.method(console, "error", () => {});

  const result = await handleRacketMessage("???", needs, "Câu hỏi trước?", {
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
