import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { callAI } from "../src/services/aiProvider.js";
import { handleRacketMessage } from "../src/services/chatService.js";
import {
  createEmptyNeeds,
  extractRacketNeeds,
} from "../src/services/needsExtractor.js";

// Chuỗi import nạp .env; test luôn dùng mô hình giả, không gọi Groq thật.
process.env.AI_PROVIDER = "ollama";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const keepDraft = async ({ draft }) => ({ reply: draft, source: "template", reason: null });

const SKILL_Q = "Anh/chị mới bắt đầu hay tự đánh giá trình độ hiện tại thế nào?";
const withBudget = {
  ...createEmptyNeeds(),
  productType: "rackets",
  budgetMaxVnd: 3000000,
};

const noModel = () => {
  globalThis.fetch = async () => {
    throw new Error("không được gọi mô hình");
  };
};

// ---------- Câu trả lời ngắn về trình độ ----------

test("clear short skill answers are read without the model", async () => {
  noModel();

  for (const [answer, expected] of [
    ["mới chơi", "beginner"],
    ["Mình mới tập chơi thôi", "beginner"],
    ["người mới ạ", "beginner"],
    ["trung bình", "intermediate"],
    ["bình thường thôi", "intermediate"],
    ["nâng cao", "advanced"],
  ]) {
    const needs = await extractRacketNeeds(answer, withBudget, SKILL_Q);
    assert.equal(needs.skillLevel, expected, answer);
  }
});

test('recreational play or entering competition does not assign a skill level', async () => {
  noModel();
  for (const message of ['chơi phong trào', 'mình chơi thi đấu', 'đánh giải']) {
    const result = await extractRacketNeeds(message, withBudget, SKILL_Q);
    assert.equal(result.skillLevel, withBudget.skillLevel);
  }
});

test("a skill answer is only read when the skill question was asked", async () => {
  noModel();

  await assert.rejects(
    extractRacketNeeds("trung bình", withBudget, "Anh/chị chủ yếu đánh đơn, đánh đôi hay cả hai?"),
    /Không gọi được AI/,
  );
});

// ---------- Không lặp nguyên văn câu hỏi ----------

const run = (message, previous, lastQuestion, extra = {}) =>
  handleRacketMessage(message, previous, lastQuestion, {
    polish: keepDraft,
    extract: async () => previous,
    search: async () => {
      throw new Error("không được tìm khi chưa đủ thông tin");
    },
    ...extra,
  });

test("an answer the bot could not read is asked again in a different way", async () => {
  const result = await run("khá khá", withBudget, SKILL_Q);

  assert.equal(result.action, "ask_followup");
  assert.equal(result.requestedField, "skillLevel");
  assert.notEqual(result.reply, SKILL_Q);
  assert.match(result.reply, /Em chưa hiểu rõ ý anh\/chị/);
  assert.match(result.reply, /mới chơi, trung bình hay nâng cao/);
  assert.equal(result.lastQuestion, result.clarification);
});

test("a third unreadable answer keeps the clarification, it does not alternate back", async () => {
  const first = await run("khá khá", withBudget, SKILL_Q);
  const second = await run("ừm", withBudget, first.lastQuestion);
  const third = await run("hmm", withBudget, second.lastQuestion);

  assert.equal(second.reply, first.reply);
  assert.equal(third.reply, first.reply);
});

test("a changed profile is not mistaken for a repeated question", async () => {
  const next = { ...withBudget, skillLevel: "beginner" };
  const result = await run("mới chơi", withBudget, SKILL_Q, { extract: async () => next });

  assert.equal(result.requestedField, "playFormat");
  assert.doesNotMatch(result.reply, /Em chưa hiểu rõ ý anh\/chị/);
});

test("clarification wording still lets short answers be read afterwards", async () => {
  noModel();

  const first = await run("khá khá", withBudget, SKILL_Q);
  const needs = await extractRacketNeeds("trung bình", withBudget, first.lastQuestion);

  assert.equal(needs.skillLevel, "intermediate");
});

test("the stringing clarification still accepts a plain 'chưa'", async () => {
  noModel();

  // The bot no longer asks this, but older saved conversations may still carry the question.
  const base = { ...withBudget, skillLevel: "beginner", playFormat: "doubles" };
  const needs = await extractRacketNeeds("chưa", base, "Ngân sách này đã bao gồm tiền cước chưa?");

  assert.equal(needs.budgetIncludesStringing, false);
});

test("an unreadable model answer asks the clarification, not the old wording", async (t) => {
  t.mock.method(console, "error", () => {});

  const result = await run("???", withBudget, SKILL_Q, {
    extract: async () => {
      throw new Error("AI không trả JSON hợp lệ.");
    },
  });

  assert.equal(result.action, "clarify");
  assert.match(result.reply, /mới chơi, trung bình hay nâng cao/);
  assert.notEqual(result.lastQuestion, SKILL_Q);
});

test("a stopped model still says it is unavailable and keeps the pending question", async (t) => {
  t.mock.method(console, "error", () => {});
  const { AdvisorModelUnavailableError } = await import("../src/services/needsExtractor.js");

  const result = await run("mới chơi", withBudget, SKILL_Q, {
    extract: async () => {
      throw new AdvisorModelUnavailableError("fetch failed");
    },
  });

  assert.equal(result.action, "advisor_unavailable");
  assert.equal(result.lastQuestion, SKILL_Q);
});

// ---------- Không lặp lại cả danh sách ----------

const full = {
  ...withBudget,
  skillLevel: "beginner",
  playFormat: "doubles",
  budgetIncludesStringing: false,
};

const found = async () => ({
  status: "CANDIDATES_FOUND",
  initialBudgetVnd: 3000000,
  candidates: [{ name: "Vợt A", priceVnd: 2900000, advisorSpecs: null }],
});

test("a message that changes nothing does not re-list the same rackets", async () => {
  const result = await run("ok", full, null, { search: found });

  assert.match(result.reply, /vẫn đang đúng với điều kiện của anh\/chị/);
  assert.doesNotMatch(result.reply, /Em tìm được/);
  assert.equal(result.lastQuestion, null);
  // Khách chỉ nhắn thêm, không đổi gì: không đưa lại danh sách vợt.
  assert.equal(result.candidates.length, 0);
});

test("the answer that completes the profile does list the rackets", async () => {
  const before = { ...full, budgetIncludesStringing: null };
  const result = await run("chưa", before, "Ngân sách này đã bao gồm tiền cước chưa?", {
    extract: async () => full,
    search: found,
  });

  assert.match(result.reply, /em chọn được 1 mẫu phù hợp/);
  assert.match(result.reply, /Vợt A/);
  assert.equal(result.candidates.length, 1);
});

test("an alternatives question that gets an unchanged profile is not repeated", async () => {
  const question = "Anh/chị muốn xem mẫu này hay đổi hãng, khoảng giá tìm kiếm?";
  const result = await run("xem mẫu này", full, question, {
    search: async () => ({ status: "NO_REVIEWED_MATCH", initialBudgetVnd: 3000000, candidates: [] }),
    findAlternatives: async () => ({
      reason: "price",
      candidates: [{ name: "Vợt B", priceVnd: 3300000, advisorSpecs: null }],
    }),
  });

  assert.doesNotMatch(result.reply, /Anh\/chị muốn xem mẫu này hay đổi hãng/);
  assert.match(result.reply, /vẫn đang đúng với điều kiện của anh\/chị/);
  assert.equal(result.lastQuestion, null);
});

// ---------- Lỗi mạng ----------

const groqEnv = { AI_PROVIDER: "groq", GROQ_API_KEY: "test-key" };
const okBody = JSON.stringify({ choices: [{ message: { content: "{}" } }] });

test("a transient network error is retried and the answer is not lost", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
    return new Response(okBody, { status: 200 });
  };

  const result = await callAI({ messages: [], fetchImpl, env: groqEnv });

  assert.equal(calls, 3);
  assert.equal(result.provider, "groq");
});

test("a persistent network error reports the cause after three attempts", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
  };

  await assert.rejects(
    callAI({ messages: [], fetchImpl, env: groqEnv }),
    /groq lỗi kết nối: fetch failed \(ECONNRESET\)/,
  );
  assert.equal(calls, 3);
});

test("a timeout is not retried", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new DOMException("The operation timed out.", "TimeoutError");
  };

  await assert.rejects(callAI({ messages: [], fetchImpl, env: groqEnv }), /groq lỗi kết nối/);
  assert.equal(calls, 1);
});

// ---------- Không suy ra hãng từ tên cước ----------

test("asking about a string does not set a racket brand", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: { content: JSON.stringify({ updates: { brandPreference: "yonex" }, clearFields: [] }) },
      }),
      { status: 200 },
    );

  const needs = await extractRacketNeeds("BG65 khác BG80 thế nào?", withBudget);
  assert.equal(needs.brandPreference, null);

  const named = await extractRacketNeeds("Mình muốn vợt Yonex", withBudget);
  assert.equal(named.brandPreference, "yonex");
});

// ---------- Model riêng cho từng việc ----------

test("each role can use its own Groq model, falling back to GROQ_MODEL", async () => {
  const seen = [];
  const fetchImpl = async (_url, options) => {
    seen.push(JSON.parse(options.body));
    return new Response(okBody, { status: 200 });
  };

  const env = { ...groqEnv, GROQ_MODEL: "qwen/qwen3.8-27b", GROQ_EXTRACT_MODEL: "openai/gpt-oss-20b" };

  await callAI({ messages: [], role: "extract", fetchImpl, env });
  await callAI({ messages: [], role: "write", fetchImpl, env });

  assert.equal(seen[0].model, "openai/gpt-oss-20b");
  assert.equal(seen[0].reasoning_effort, "low");
  assert.equal(seen[0].include_reasoning, false);
  assert.equal("reasoning_format" in seen[0], false);

  assert.equal(seen[1].model, "qwen/qwen3.8-27b");
  assert.equal(seen[1].reasoning_effort, "none");
  assert.equal(seen[1].reasoning_format, "hidden");
});
