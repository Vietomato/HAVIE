import test from "node:test";
import assert from "node:assert/strict";
import {
  assertVoucherConsistent,
  calculateVoucherDiscount,
  normalizeVoucherCode,
  validateVoucherPayload,
} from "../src/utils/voucher.js";

const NOW = new Date("2026-11-14T12:00:00Z");

const voucher = (overrides = {}) => ({
  code: "SALE10",
  discountType: "PERCENT",
  discountValue: 10,
  maxDiscount: null,
  minOrderAmount: 0,
  usageLimit: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...overrides,
});

const rejectsWith = (fn, code) => assert.throws(fn, (error) => error.code === code);

test("percent voucher rounds down and respects the cap", () => {
  assert.equal(calculateVoucherDiscount(voucher(), 1_234_567, NOW), 123_456);
  assert.equal(
    calculateVoucherDiscount(voucher({ maxDiscount: 100_000 }), 2_000_000, NOW),
    100_000,
  );
});

test("fixed voucher never exceeds the subtotal", () => {
  const fixed = voucher({ discountType: "FIXED", discountValue: 200_000 });
  assert.equal(calculateVoucherDiscount(fixed, 1_000_000, NOW), 200_000);
  assert.equal(calculateVoucherDiscount(fixed, 150_000, NOW), 150_000);
});

test("minimum order is inclusive", () => {
  const v = voucher({ minOrderAmount: 500_000 });
  assert.equal(calculateVoucherDiscount(v, 500_000, NOW), 50_000);
  rejectsWith(() => calculateVoucherDiscount(v, 499_999, NOW), "VOUCHER_MIN_ORDER");
});

test("unusable vouchers are rejected with a specific code", () => {
  rejectsWith(() => calculateVoucherDiscount(null, 1, NOW), "VOUCHER_NOT_FOUND");
  rejectsWith(() => calculateVoucherDiscount(voucher({ isActive: false }), 1, NOW), "VOUCHER_NOT_FOUND");
  rejectsWith(
    () => calculateVoucherDiscount(voucher({ startsAt: new Date("2026-11-15T00:00:00Z") }), 1, NOW),
    "VOUCHER_NOT_STARTED",
  );
  rejectsWith(
    () => calculateVoucherDiscount(voucher({ endsAt: new Date("2026-11-14T11:59:59Z") }), 1, NOW),
    "VOUCHER_EXPIRED",
  );
  rejectsWith(
    () => calculateVoucherDiscount(voucher({ usageLimit: 5, usedCount: 5 }), 1, NOW),
    "VOUCHER_USED_UP",
  );
});

test("codes are trimmed and upper-cased", () => {
  assert.equal(normalizeVoucherCode("  sale10 "), "SALE10");
  assert.equal(normalizeVoucherCode(42), "");
});

test("payload validation normalizes a full voucher", () => {
  assert.deepEqual(
    validateVoucherPayload({
      code: " havie-50k ",
      description: "  Giảm 50k  ",
      discountType: "FIXED",
      discountValue: 50_000,
      maxDiscount: null,
      minOrderAmount: 300_000,
      usageLimit: 100,
      startsAt: "2026-11-01T00:00:00.000Z",
      endsAt: "",
      isActive: true,
    }),
    {
      code: "HAVIE-50K",
      description: "Giảm 50k",
      discountType: "FIXED",
      discountValue: 50_000,
      maxDiscount: null,
      minOrderAmount: 300_000,
      usageLimit: 100,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: null,
      isActive: true,
    },
  );
});

test("optional fields get defaults on create", () => {
  assert.deepEqual(
    validateVoucherPayload({ code: "min10", discountType: "PERCENT", discountValue: 10 }),
    {
      code: "MIN10",
      description: null,
      discountType: "PERCENT",
      discountValue: 10,
      maxDiscount: null,
      minOrderAmount: 0,
      usageLimit: null,
      startsAt: null,
      endsAt: null,
      isActive: true,
    },
  );
});

test("partial payload only returns the fields sent", () => {
  assert.deepEqual(validateVoucherPayload({ isActive: false }, { partial: true }), {
    isActive: false,
  });
});

test("payload validation rejects bad values", () => {
  const base = { code: "OK10", discountType: "PERCENT", discountValue: 10 };
  for (const bad of [
    { code: "a b" },
    { code: "AB" },
    { discountType: "FREE" },
    { discountValue: 0 },
    { discountValue: 1.5 },
    { maxDiscount: -1 },
    { minOrderAmount: -1 },
    { usageLimit: 0 },
    { startsAt: "not a date" },
    { isActive: "yes" },
  ]) {
    rejectsWith(() => validateVoucherPayload({ ...base, ...bad }), "VALIDATION_ERROR");
  }
});

test("cross-field rules", () => {
  rejectsWith(() => assertVoucherConsistent(voucher({ discountValue: 101 })), "VALIDATION_ERROR");
  rejectsWith(
    () =>
      assertVoucherConsistent(
        voucher({ startsAt: new Date("2026-12-01"), endsAt: new Date("2026-11-01") }),
      ),
    "VALIDATION_ERROR",
  );
  rejectsWith(
    () => assertVoucherConsistent(voucher({ usageLimit: 2, usedCount: 3 })),
    "VALIDATION_ERROR",
  );
  assert.doesNotThrow(() =>
    assertVoucherConsistent(voucher({ discountType: "FIXED", discountValue: 500_000 })),
  );
});
