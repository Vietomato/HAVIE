import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyNeeds,
  extractRacketNeeds,
} from "../src/services/needsExtractor.js";

const realFetch = globalThis.fetch;

function mockModelPatch(patch) {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ message: { content: JSON.stringify(patch) } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

const racketNeeds = {
  ...createEmptyNeeds(),
  productType: "rackets",
  brandPreference: "yonex",
  skillLevel: "intermediate",
  playFormat: "doubles",
  budgetTargetVnd: 4500000,
  budgetIncludesStringing: false,
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("switching to shoes survives the model clearing productType", async () => {
  mockModelPatch({
    updates: {
      productType: "shoes",
      shoeSize: 42,
      shoeSizeSystem: "EU",
      budgetTargetVnd: 2000000,
    },
    clearFields: ["productType", "brandPreference", "skillLevel", "priorities"],
  });

  const needs = await extractRacketNeeds(
    "Giày size 42 EU tầm 2 triệu thì sao",
    racketNeeds,
  );

  assert.equal(needs.productType, "shoes");
  assert.equal(needs.shoeSize, 42);
  assert.equal(needs.shoeSizeSystem, "EU");
  assert.equal(needs.budgetTargetVnd, 2000000);
  assert.equal(needs.brandPreference, null);
  assert.equal(needs.skillLevel, null);
  assert.equal(needs.budgetIncludesStringing, null);
});

test("an updated value wins over clearing the same field", async () => {
  mockModelPatch({
    updates: { budgetMaxVnd: 6000000 },
    clearFields: ["budgetMaxVnd"],
  });

  const needs = await extractRacketNeeds("Tối đa 6 triệu", racketNeeds);

  assert.equal(needs.budgetMaxVnd, 6000000);
});

test("fields the model did not update are still cleared", async () => {
  mockModelPatch({
    updates: { playFormat: "singles" },
    clearFields: ["brandPreference"],
  });

  const needs = await extractRacketNeeds("Hãng nào cũng được", racketNeeds);

  assert.equal(needs.brandPreference, null);
  assert.equal(needs.playFormat, "singles");
});

test("clearing an unknown field is still rejected", async () => {
  mockModelPatch({ updates: {}, clearFields: ["notAField"] });

  await assert.rejects(
    extractRacketNeeds("Bỏ đi", racketNeeds),
    /xóa trường không hợp lệ/,
  );
});

test("a plain budget becomes a ceiling", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 8000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds(
    "Mình có ngân sách 8 triệu",
    { ...createEmptyNeeds(), productType: "rackets" },
  );

  assert.equal(needs.budgetMaxVnd, 8000000);
  assert.equal(needs.budgetTargetVnd, null);
});

test("a plain budget replaces the earlier target", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 8000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("8 triệu nhé", racketNeeds);

  assert.equal(needs.budgetMaxVnd, 8000000);
  assert.equal(needs.budgetTargetVnd, null);
});

test("an approximate budget stays a target", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 3000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Tầm 3 triệu thôi", racketNeeds);

  assert.equal(needs.budgetTargetVnd, 3000000);
  assert.equal(needs.budgetMaxVnd, null);
});

test("a lower maximum drops the conflicting target", async () => {
  mockModelPatch({
    updates: { budgetMaxVnd: 3000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Tối đa 3 triệu thôi", racketNeeds);

  assert.equal(needs.budgetMaxVnd, 3000000);
  assert.equal(needs.budgetTargetVnd, null);
});

test("a higher target drops the conflicting maximum", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 6000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Tăng lên tầm 6 triệu", {
    ...racketNeeds,
    budgetTargetVnd: null,
    budgetMaxVnd: 3000000,
  });

  assert.equal(needs.budgetTargetVnd, 6000000);
  assert.equal(needs.budgetMaxVnd, null);
});

test("a target above the maximum in one message keeps the maximum", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 5000000, budgetMaxVnd: 4000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Tầm 5, tối đa 4 triệu", racketNeeds);

  assert.equal(needs.budgetMaxVnd, 4000000);
});

test("a stopped model raises the unavailable error", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    extractRacketNeeds("Xin chào", racketNeeds),
    { name: "AdvisorModelUnavailableError" },
  );
});

test("one amount in both budget fields becomes a ceiling", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 8000000, budgetMaxVnd: 8000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Ngân sách 8 triệu", racketNeeds);

  assert.equal(needs.budgetMaxVnd, 8000000);
  assert.equal(needs.budgetTargetVnd, null);
});

test("one approximate amount in both fields stays a target", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 2000000, budgetMaxVnd: 2000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Tầm 2 triệu", racketNeeds);

  assert.equal(needs.budgetTargetVnd, 2000000);
  assert.equal(needs.budgetMaxVnd, null);
});

test("the product type comes from the message when the model misses it", async () => {
  mockModelPatch({
    updates: { budgetTargetVnd: 2000000 },
    clearFields: [],
  });

  const needs = await extractRacketNeeds(
    "Mình cần vợt tầm 2 triệu",
    createEmptyNeeds(),
  );

  assert.equal(needs.productType, "rackets");
});

test("a message naming both products does not pick one", async () => {
  mockModelPatch({ updates: {}, clearFields: [] });

  const needs = await extractRacketNeeds(
    "Mình cần vợt và giày",
    createEmptyNeeds(),
  );

  assert.equal(needs.productType, null);
});

test("the message does not change an existing product type", async () => {
  mockModelPatch({ updates: {}, clearFields: [] });

  const needs = await extractRacketNeeds("Giày thì để sau", racketNeeds);

  assert.equal(needs.productType, "rackets");
});

test("priorities the customer never mentioned are dropped", async () => {
  mockModelPatch({
    updates: {
      priorities: ["easy_to_use", "fast_handling", "attack_support"],
    },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Mình cần vợt dễ đánh", racketNeeds);

  assert.deepEqual(needs.priorities, ["easy_to_use"]);
});

test("earlier priorities stay when the model repeats them", async () => {
  mockModelPatch({
    updates: { priorities: ["easy_to_use", "attack_support"] },
    clearFields: [],
  });

  const needs = await extractRacketNeeds("Thêm tấn công nữa", {
    ...racketNeeds,
    priorities: ["easy_to_use"],
  });

  assert.deepEqual(needs.priorities, ["easy_to_use", "attack_support"]);
});

test("stringing is ignored when nobody mentioned it", async () => {
  mockModelPatch({
    updates: { budgetMaxVnd: 8000000, budgetIncludesStringing: false },
    clearFields: [],
  });

  const needs = await extractRacketNeeds(
    "Mình có ngân sách 8 triệu, muốn mua vợt",
    createEmptyNeeds(),
  );

  assert.equal(needs.budgetIncludesStringing, null);
});

test("a short answer to the stringing question is kept", async () => {
  mockModelPatch({
    updates: { budgetIncludesStringing: false },
    clearFields: [],
  });

  const needs = await extractRacketNeeds(
    "Chưa",
    { ...racketNeeds, budgetIncludesStringing: null },
    "Ngân sách này đã bao gồm tiền cước chưa?",
  );

  assert.equal(needs.budgetIncludesStringing, false);
});

test("a budget the model missed is read from the message", async () => {
  mockModelPatch({
    updates: { productType: "rackets", priorities: ["easy_to_use"] },
    clearFields: [],
  });

  const needs = await extractRacketNeeds(
    "Mình cần vợt dễ đánh tầm 2 triệu",
    createEmptyNeeds(),
  );

  assert.equal(needs.budgetTargetVnd, 2000000);
});

for (const [message, field, amount] of [
  ["Vợt dưới 500k", "budgetMaxVnd", 500000],
  ["Tầm 2 triệu rưỡi", "budgetTargetVnd", 2500000],
  ["Có 4tr5 thôi", "budgetMaxVnd", 4500000],
  ["Khoảng 3,5 triệu", "budgetTargetVnd", 3500000],
]) {
  test(`reads "${message}" as ${field}`, async () => {
    mockModelPatch({ updates: {}, clearFields: [] });

    const needs = await extractRacketNeeds(message, {
      ...createEmptyNeeds(),
      productType: "rackets",
    });

    assert.equal(needs[field], amount);
  });
}

test("sizes and weights are not read as money", async () => {
  mockModelPatch({ updates: {}, clearFields: [] });

  const needs = await extractRacketNeeds("Size 42, vợt 4U", {
    ...createEmptyNeeds(),
    productType: "rackets",
  });

  assert.equal(needs.budgetTargetVnd, null);
  assert.equal(needs.budgetMaxVnd, null);
});

test("two different amounts are left to the model", async () => {
  mockModelPatch({ updates: {}, clearFields: [] });

  const needs = await extractRacketNeeds("Từ 2 triệu đến 3 triệu", {
    ...createEmptyNeeds(),
    productType: "rackets",
  });

  assert.equal(needs.budgetTargetVnd, null);
  assert.equal(needs.budgetMaxVnd, null);
});
