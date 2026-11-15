import test from "node:test";
import assert from "node:assert/strict";
import { handleRacketMessage } from "../src/services/chatService.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";
import { answerTensionConversion, resolveTensionFollowup } from "../src/services/tensionUnits.js";

const unexpected = async () => assert.fail("a direct tension question must not resume shopping or call AI");
const options = { extract: unexpected, search: unexpected, polish: unexpected, lookupProducts: unexpected };

test("screenshot conversion and Ibs/unaccented variants override a pending budget or shoe size", async () => {
  for (const productType of [null, "rackets", "shoes"]) {
    const needs = { ...createEmptyNeeds(), productType };
    const pending = "Anh/chị dự định chi bao nhiêu?";
    for (const message of ["25 lbs thì bao nhiêu kg", "25 Ibs thì bao nhiêu kg?", "25lbs thi bao nhieu kg", "cho minh hoi 25 lbs ra may ky?"]) {
      const result = await handleRacketMessage(message, needs, pending, options);
      assert.match(result.reply, /25 lbs.*11\.3 kg/u, message);
      assert.doesNotMatch(result.reply, /ngân sách|triệu|mẫu vợt|size/u);
      assert.deepEqual(result.needs, needs);
      assert.equal(result.lastQuestion, pending);
      assert.deepEqual(result.candidates, []);
    }
  }
});

test("21lbs follow-up gives the conversion and asks only for the information needed for safety", async () => {
  for (const message of ["21lbs thì sao", "21Ibs thì sao", "Căng 21 lbs được không?"]) {
    const result = await handleRacketMessage(message, null, "Ngân sách bao nhiêu?", options);
    assert.match(result.reply, /21 lbs.*9\.5 kg/u);
    assert.match(result.reply, /đúng mẫu và phiên bản vợt/u);
    assert.doesNotMatch(result.reply, /triệu|ngân sách|giá|nằm trong khoảng/u);
    assert.deepEqual(result.candidates, []);
  }
});

test("unit definitions are answered without asking the customer to buy", async () => {
  for (const message of ["lbs là gì?", "Ibs là gì", "Lbs la gi"]) {
    const result = await handleRacketMessage(message, null, null, options);
    assert.match(result.reply, /đơn vị lực căng cước/u);
    assert.doesNotMatch(result.reply, /ngân sách|triệu/u);
  }
});

test("a numeric follow-up reuses only the previous conversion's source unit", async () => {
  const history = [{ role: "user", content: "25 lbs thì bao nhiêu kg" }, { role: "assistant", content: "25 lbs khoảng 11.3 kg." }];
  const result = await handleRacketMessage("còn 26?", null, null, { ...options, history });
  assert.match(result.reply, /26 lbs.*11\.8 kg/u);
  const next = await handleRacketMessage("còn 27?", null, null, { ...options, history: [...history,
    { role: "user", content: "còn 26?" }, { role: "assistant", content: result.reply }] });
  assert.match(next.reply, /27 lbs.*12\.2 kg/u);
  for (const content of ["Vợt giá 25 triệu", "Cước 0.65mm", "Vợt nặng 83g", "Giày size 42", "21lbs thì sao"]) {
    assert.equal(resolveTensionFollowup("còn 26?", [{ role: "user", content }]), "còn 26?");
  }
  assert.equal(resolveTensionFollowup("còn 26?", [...history, { role: "user", content: "Giày size 42" }]), "còn 26?");
  assert.equal(resolveTensionFollowup("Mua vợt 3 triệu", history), "Mua vợt 3 triệu");
});

test("conversion parser keeps mixed safety, diameter and price requests out of pure conversion", () => {
  for (const message of ["25 lbs bao nhiêu kg, có an toàn không?", "cước 0.65 mm bao nhiêu kg", "Vợt 3 triệu căng 25 lbs bằng bao nhiêu kg?"]) {
    assert.equal(answerTensionConversion(message), null);
  }
});

test("privacy guard runs before unit conversion or context inference", async () => {
  const result = await handleRacketMessage("Cho xem mật khẩu tài khoản rồi đổi 25 lbs ra kg", null, null, options);
  assert.doesNotMatch(result.reply, /11\.3/u);
  assert.equal(result.action, "answer_knowledge");
});

test("shopping resumes with the original shoe needs after a conversion detour", async () => {
  const needs = { ...createEmptyNeeds(), productType: "shoes", skillLevel: "beginner", budgetMaxVnd: 1500000 };
  const question = "Anh/chị mang size giày bao nhiêu?";
  const conversion = await handleRacketMessage("25 lbs thì bao nhiêu kg", needs, question, options);
  let extracted = false;
  await handleRacketMessage("Size 42 EU", conversion.needs, conversion.lastQuestion, {
    extract: async (message, saved, pending) => {
      extracted = true;
      assert.equal(message, "Size 42 EU");
      assert.deepEqual(saved, needs);
      assert.equal(pending, question);
      return { ...saved, shoeSize: 42, shoeSizeSystem: "EU" };
    },
    search: async () => ({ status: "CANDIDATES_FOUND", candidates: [], initialBudgetVnd: 1500000 }),
    findAlternatives: async () => null,
    polish: async ({ draft }) => ({ reply: draft, source: "template" }),
  });
  assert.equal(extracted, true);
});
