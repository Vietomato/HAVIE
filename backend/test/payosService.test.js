import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_WINDOW_MINUTES,
  cancelUnpaidOrder,
  createPaymentLink,
  createPayosClient,
  expireStalePayosOrders,
  fromPayosOrderCode,
  getFrontendBaseUrl,
  handlePayosWebhook,
  markOrderPaid,
  syncPayosOrder,
  toPayosOrderCode,
  toPublicPayment,
} from "../src/services/payosService.js";
import { validateAdminOrderTransition } from "../src/utils/adminValidation.js";

const createdAt = new Date("2026-11-15T10:00:00Z");
const minutes = (value) => new Date(createdAt.getTime() + value * 60_000);
const ORDER_CODE = "HV-20261115-ABCD1234";

const order = (overrides = {}) => ({
  id: "o1",
  orderCode: ORDER_CODE,
  userId: "u1",
  paymentMethod: "PAYOS",
  status: "PENDING_PAYMENT",
  paymentStatus: "PENDING",
  totalAmount: 3_200_000,
  recipientName: "An",
  recipientPhone: "0901234567",
  createdAt,
  items: [{ variantId: "v1", productName: "Vợt A", quantity: 2, price: 1_600_000 }],
  ...overrides,
});

// Database giả: ghi lại các lệnh cập nhật và trả về đơn theo ý từng test.
function fakeDatabase(current, { claim = 1 } = {}) {
  const log = { updates: [], stock: [], moves: [], vouchers: [] };
  const tx = {
    order: { updateMany: async (args) => { log.updates.push(args); return { count: claim }; } },
    orderItem: { findMany: async () => current?.items ?? [] },
    productVariant: { update: async (args) => { log.stock.push(args); } },
    stockMovement: { create: async (args) => { log.moves.push(args); } },
    voucher: { updateMany: async (args) => { log.vouchers.push(args); return { count: 1 }; } },
  };
  return {
    log,
    order: {
      findFirst: async () => current,
      findUnique: async () => current,
      findMany: async () => (current ? [current] : []),
      updateMany: async (args) => { log.updates.push(args); return { count: claim }; },
    },
    $transaction: async (work) => work(tx),
  };
}

// ---------- Mã đơn ----------

test("a shop order code maps to a payOS integer and back", () => {
  const number = toPayosOrderCode(ORDER_CODE);

  assert.ok(Number.isSafeInteger(number));
  assert.equal(fromPayosOrderCode(number), ORDER_CODE);
});

test("different order codes never share a payOS number, and every code stays within the safe range", () => {
  const codes = ["HV-20261115-00000000", "HV-20261115-FFFFFFFF", "HV-20261116-00000000", "HV-20991231-FFFFFFFF"];
  const numbers = codes.map(toPayosOrderCode);

  assert.equal(new Set(numbers).size, codes.length);
  numbers.forEach((number, index) => {
    assert.ok(number < Number.MAX_SAFE_INTEGER);
    assert.equal(fromPayosOrderCode(number), codes[index]);
  });
});

test("an invalid order code is rejected instead of producing a wrong number", () => {
  assert.throws(() => toPayosOrderCode("ABC"));
  assert.equal(fromPayosOrderCode(-5), null);
  assert.equal(fromPayosOrderCode(1.5), null);
});

// ---------- Cấu hình ----------

test("the payOS client exists only when all three keys are configured", () => {
  assert.equal(createPayosClient({}), null);
  assert.equal(createPayosClient({ PAYOS_CLIENT_ID: "a", PAYOS_API_KEY: "b" }), null);
  assert.ok(createPayosClient({ PAYOS_CLIENT_ID: "a", PAYOS_API_KEY: "b", PAYOS_CHECKSUM_KEY: "c" }));
});

test("the return address follows FRONTEND_URL, then the first CORS origin, then the dev default", () => {
  assert.equal(getFrontendBaseUrl({ FRONTEND_URL: "https://havie.vn/" }), "https://havie.vn");
  assert.equal(getFrontendBaseUrl({ CORS_ORIGIN: "http://localhost:5174, http://x" }), "http://localhost:5174");
  assert.equal(getFrontendBaseUrl({}), "http://localhost:5174");
});

// ---------- Tạo link ----------

test("a payment link is created for the exact amount with the order code and a 15-minute expiry", async () => {
  let request;
  const payos = {
    paymentRequests: {
      create: async (data) => {
        request = data;
        return { paymentLinkId: "pl1", checkoutUrl: "https://pay.example/pl1", qrCode: "000201..." };
      },
    },
  };

  const link = await createPaymentLink({ payos, order: order(), items: order().items, returnBase: "http://localhost:5174" });

  assert.equal(request.orderCode, toPayosOrderCode(ORDER_CODE));
  assert.equal(request.amount, 3_200_000);
  assert.equal(request.description, ORDER_CODE);
  assert.ok(request.description.length <= 25);
  assert.equal(request.returnUrl, "http://localhost:5174/account/orders/o1/pay");
  assert.equal(request.expiredAt, Math.floor(minutes(PAYMENT_WINDOW_MINUTES).getTime() / 1000));
  assert.deepEqual(request.items, [{ name: "Vợt A", quantity: 2, price: 1_600_000 }]);
  assert.deepEqual(
    [link.paymentLinkId, link.checkoutUrl, link.qrCode],
    ["pl1", "https://pay.example/pl1", "000201..."],
  );
  assert.equal(link.paymentExpiresAt.toISOString(), minutes(PAYMENT_WINDOW_MINUTES).toISOString());
});

test("the public payment info exposes only what the customer needs", () => {
  const info = toPublicPayment(
    order({ checkoutUrl: "https://pay.example/pl1", qrCode: "000201...", paymentLinkId: "secret-id" }),
    minutes(1),
  );

  assert.deepEqual(Object.keys(info).sort(), ["amount", "checkoutUrl", "expired", "expiresAt", "method", "qrCode", "transferContent"]);
  assert.equal(info.expired, false);
  assert.equal(toPublicPayment(order(), minutes(20)).expired, true);
});

// ---------- Ghi nhận thanh toán ----------

test("a paid order moves to awaiting confirmation, and the update is conditional on the waiting state", async () => {
  const database = fakeDatabase(order());
  const result = await markOrderPaid(database, { orderId: "o1", amount: 3_200_000, now: minutes(3) });

  assert.equal(result.ok, true);
  assert.deepEqual(database.log.updates[0].where, { id: "o1", status: "PENDING_PAYMENT", paymentStatus: "PENDING" });
  assert.equal(database.log.updates[0].data.status, "PENDING_CONFIRMATION");
  assert.equal(database.log.updates[0].data.paymentStatus, "PAID");
});

test("a payment with a different amount is refused", async () => {
  const database = fakeDatabase(order());
  const result = await markOrderPaid(database, { orderId: "o1", amount: 1000 });

  assert.equal(result.code, "AMOUNT_MISMATCH");
  assert.deepEqual(database.log.updates, []);
});

test("paying twice, paying a COD order or a cancelled order changes nothing", async () => {
  const run = async (current) => {
    const database = fakeDatabase(current);
    const result = await markOrderPaid(database, { orderId: "o1" });
    return { result, updates: database.log.updates };
  };

  const twice = await run(order({ status: "PENDING_CONFIRMATION", paymentStatus: "PAID" }));
  assert.equal(twice.result.ok, true);
  assert.equal(twice.result.alreadyPaid, true);
  assert.equal((await run(order({ paymentMethod: "COD" }))).result.code, "NOT_PAYOS_ORDER");
  assert.equal((await run(order({ status: "CANCELLED", paymentStatus: "EXPIRED" }))).result.code, "ORDER_NOT_PAYABLE");
  assert.equal((await run(null)).result.code, "ORDER_NOT_FOUND");
  for (const { updates } of [twice]) assert.deepEqual(updates, []);
});

test("cancelling an unpaid order returns its stock once, and a lost race restocks nothing", async () => {
  const database = fakeDatabase(order());
  assert.equal(await cancelUnpaidOrder(database, order(), { paymentStatus: "EXPIRED", reason: "x" }), true);
  assert.deepEqual(database.log.stock[0].data, { stockQuantity: { increment: 2 } });
  assert.equal(database.log.moves[0].data.reason, "ORDER_CANCELLED");

  const raced = fakeDatabase(order(), { claim: 0 });
  assert.equal(await cancelUnpaidOrder(raced, order(), { paymentStatus: "EXPIRED", reason: "x" }), false);
  assert.deepEqual(raced.log.stock, []);
});

test("cancelling an unpaid order gives back its voucher use, but only when the cancel wins", async () => {
  const database = fakeDatabase(order({ voucherId: "vc1" }));
  await cancelUnpaidOrder(database, order({ voucherId: "vc1" }), { paymentStatus: "EXPIRED", reason: "x" });
  assert.deepEqual(database.log.vouchers, [
    { where: { id: "vc1", usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } },
  ]);

  const raced = fakeDatabase(order({ voucherId: "vc1" }), { claim: 0 });
  await cancelUnpaidOrder(raced, order({ voucherId: "vc1" }), { paymentStatus: "EXPIRED", reason: "x" });
  assert.deepEqual(raced.log.vouchers, []);

  const noVoucher = fakeDatabase(order());
  await cancelUnpaidOrder(noVoucher, order(), { paymentStatus: "EXPIRED", reason: "x" });
  assert.deepEqual(noVoucher.log.vouchers, []);
});

// ---------- Đồng bộ với payOS ----------

const payosReturning = (remote, { cancels = [] } = {}) => ({
  paymentRequests: {
    get: async () => remote,
    cancel: async (...args) => { cancels.push(args); return {}; },
  },
});

test("opening the payment page picks up a payment that payOS already confirmed", async () => {
  const database = fakeDatabase(order());
  const payos = payosReturning({ status: "PAID", amountPaid: 3_200_000 });

  await syncPayosOrder({ database, payos, order: order(), now: minutes(2) });

  assert.equal(database.log.updates[0].data.paymentStatus, "PAID");
});

test("a link payOS reports as expired or cancelled cancels the order and restocks", async () => {
  for (const status of ["EXPIRED", "CANCELLED"]) {
    const database = fakeDatabase(order());
    await syncPayosOrder({ database, payos: payosReturning({ status }), order: order(), now: minutes(2) });

    assert.equal(database.log.updates[0].data.status, "CANCELLED", status);
    assert.equal(database.log.updates[0].data.paymentStatus, status === "EXPIRED" ? "EXPIRED" : "FAILED");
    assert.equal(database.log.stock.length, 1, status);
  }
});

test("a pending link inside the window is left alone, and one past the window is cancelled on both sides", async () => {
  const waiting = fakeDatabase(order());
  await syncPayosOrder({ database: waiting, payos: payosReturning({ status: "PENDING" }), order: order(), now: minutes(5) });
  assert.deepEqual(waiting.log.updates, []);

  const cancels = [];
  const late = fakeDatabase(order());
  await syncPayosOrder({ database: late, payos: payosReturning({ status: "PENDING" }, { cancels }), order: order(), now: minutes(PAYMENT_WINDOW_MINUTES + 1) });
  assert.equal(late.log.updates[0].data.paymentStatus, "EXPIRED");
  assert.equal(cancels[0][0], toPayosOrderCode(ORDER_CODE));
});

test("when payOS cannot be reached nothing is changed", async () => {
  const database = fakeDatabase(order());
  const payos = { paymentRequests: { get: async () => { throw new Error("network"); } } };
  const originalError = console.error;
  console.error = () => {};
  try {
    await syncPayosOrder({ database, payos, order: order(), now: minutes(5) });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(database.log.updates, []);
});

test("COD and already-processed orders are not synced", async () => {
  const database = fakeDatabase(order());
  const payos = { paymentRequests: { get: async () => assert.fail("must not call payOS") } };

  await syncPayosOrder({ database, payos, order: order({ paymentMethod: "COD" }) });
  await syncPayosOrder({ database, payos, order: order({ status: "CONFIRMED" }) });
  await syncPayosOrder({ database, payos: null, order: order() });
});

test("stale payOS orders are swept without touching fresh ones", async () => {
  const database = fakeDatabase(order());
  const payos = payosReturning({ status: "EXPIRED" });

  assert.equal(await expireStalePayosOrders({ database, payos, now: minutes(30) }), 1);
  assert.equal(database.log.updates[0].data.status, "CANCELLED");
});

// ---------- Webhook ----------

const webhook = (overrides = {}) => ({
  code: "00",
  desc: "success",
  success: true,
  data: { orderCode: toPayosOrderCode(ORDER_CODE), amount: 3_200_000, code: "00", ...overrides.data },
  signature: "sig",
  ...overrides.envelope,
});

const verifier = (data) => ({ webhooks: { verify: async () => data } });

test("a verified successful webhook marks the right order as paid", async () => {
  const database = fakeDatabase(order());
  const body = webhook();
  const result = await handlePayosWebhook({ database, payos: verifier(body.data), body, now: minutes(2) });

  assert.equal(result.handled, true);
  assert.equal(database.log.updates[0].data.paymentStatus, "PAID");
});

test("a webhook with a bad signature is rejected and changes nothing", async () => {
  const database = fakeDatabase(order());
  const payos = { webhooks: { verify: async () => { throw new Error("Invalid signature"); } } };

  await assert.rejects(handlePayosWebhook({ database, payos, body: webhook() }));
  assert.deepEqual(database.log.updates, []);
});

test("webhooks for unknown orders, failed payments or wrong amounts are ignored safely", async () => {
  const run = async (body, current = order()) => {
    const database = fakeDatabase(current);
    const result = await handlePayosWebhook({ database, payos: verifier(body.data), body });
    return { result, updates: database.log.updates };
  };

  // payOS gửi đơn thử orderCode = 123 khi đăng ký URL webhook.
  const test123 = await run(webhook({ data: { orderCode: 123 } }), null);
  assert.equal(test123.result.handled, false);

  const failed = await run(webhook({ envelope: { success: false }, data: { code: "01" } }));
  assert.equal(failed.result.reason, "NOT_A_SUCCESS");

  const wrongAmount = await run(webhook({ data: { amount: 1 } }));
  assert.equal(wrongAmount.result.reason, "AMOUNT_MISMATCH");

  for (const item of [test123, failed, wrongAmount]) assert.deepEqual(item.updates, []);
});

test("a webhook arriving when payOS is not configured is not handled", async () => {
  const result = await handlePayosWebhook({ database: fakeDatabase(order()), payos: null, body: webhook() });
  assert.equal(result.handled, false);
});

// ---------- Admin ----------

test("admin can cancel an order waiting for payment but cannot push it forward", () => {
  assert.doesNotThrow(() => validateAdminOrderTransition("PENDING_PAYMENT", "CANCELLED"));
  assert.throws(() => validateAdminOrderTransition("PENDING_PAYMENT", "CONFIRMED"));
  assert.throws(() => validateAdminOrderTransition("PENDING_PAYMENT", "SHIPPING"));
});
