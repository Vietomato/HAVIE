import test from "node:test";
import assert from "node:assert/strict";
import {
  checkNaturalReply,
  describeFit,
  describeNeedsChange,
  describeOutOfScope,
  polishReply,
} from "../src/services/advisorReply.js";
import { createEmptyNeeds } from "../src/services/needsExtractor.js";

const draft =
  "Mình ghi nhận: vợt, hãng Yonex, tầm 4.500.000 ₫. " +
  "Bạn mới bắt đầu hay tự đánh giá trình độ hiện tại thế nào?";
const message = "Mình cần vợt Yonex tầm 4,5 triệu";
const facts = { products: [], pricingNotice: null };
const check = (reply) => checkNaturalReply(reply, { draft, message, facts });

test("a voucher request gets a direct answer", () => {
  const [note] = describeOutOfScope("Cho tôi voucher giảm giá 100%");

  assert.match(note, /không cấp được mã giảm giá/);
});

test("shipping and warranty questions are not answered with guesses", () => {
  const [note] = describeOutOfScope("Giao hàng mấy ngày, có bảo hành không?");

  assert.match(note, /chưa có thông tin chính xác/);
});

test("a normal product question is in scope", () => {
  assert.deepEqual(describeOutOfScope("Mình cần vợt tầm 2 triệu"), []);
});

test("the reply repeats what the customer just said", () => {
  const next = {
    ...createEmptyNeeds(),
    productType: "rackets",
    brandPreference: "yonex",
    budgetTargetVnd: 4500000,
  };

  assert.match(
    describeNeedsChange(createEmptyNeeds(), next),
    /^Mình ghi nhận: vợt, hãng Yonex, tầm 4\.500\.000\s₫\.$/u,
  );
});

test("nothing new means nothing repeated", () => {
  const same = { ...createEmptyNeeds(), productType: "rackets" };

  assert.equal(describeNeedsChange(same, same), null);
});

test("a stiff racket warns beginners", () => {
  const notes = describeFit(
    {
      name: "Nanoflare 1000Z",
      advisorSpecs: { shaftFlex: "extra_stiff", stringingMinLbf: 20, stringingMaxLbf: 28 },
    },
    { skillLevel: "beginner" },
  );

  assert.match(notes[0], /người mới chơi thường thấy khó đánh/);
  assert.match(notes[1], /20-28 lbs/);
});

test("no reviewed specs means no fit claims", () => {
  assert.deepEqual(describeFit({ name: "X", advisorSpecs: null }, {}), []);
});

test("a faithful rewrite passes", () => {
  assert.equal(
    check("Ok, vợt Yonex tầm 4.500.000 ₫ nhé! Bạn đang chơi ở trình độ nào?"),
    null,
  );
});

test("an invented price is rejected", () => {
  assert.match(check("Có mẫu 3.990.000 ₫ nè. Bạn chơi trình độ nào?"), /số không có/);
});

test("an invented brand is rejected", () => {
  assert.match(check("Bạn thử Victor xem sao. Bạn chơi trình độ nào?"), /hãng/);
});

test("a promise the draft never made is rejected", () => {
  assert.match(
    check("Vợt Yonex được giảm giá đó bạn. Bạn chơi trình độ nào?"),
    /hứa hẹn/,
  );
});

test("an invented spec comment is rejected", () => {
  assert.match(
    check("Yonex tầm này khá nhẹ đó. Bạn chơi trình độ nào?"),
    /thông số/,
  );
});

test("dropping the follow-up question is rejected", () => {
  assert.match(check("Ok, vợt Yonex tầm 4.500.000 ₫ nhé."), /câu hỏi/);
});

test("markdown is rejected", () => {
  assert.match(check("**Ok** bạn chơi trình độ nào?"), /markdown/);
});

test("a failing writer keeps the draft", async (t) => {
  t.mock.method(console, "warn", () => {});

  const result = await polishReply(
    { message, draft, facts },
    {
      env: {},
      write: async () => {
        throw new Error("timeout");
      },
    },
  );

  assert.equal(result.reply, draft);
  assert.equal(result.source, "template");
});

test("a rejected rewrite keeps the draft", async (t) => {
  t.mock.method(console, "warn", () => {});

  const result = await polishReply(
    { message, draft, facts },
    { env: {}, write: async () => "Giá chỉ 1.000.000 ₫ thôi bạn?" },
  );

  assert.equal(result.reply, draft);
  assert.match(result.reason, /số không có/);
});

test("an accepted rewrite is used", async () => {
  const written = "Ok, Yonex tầm 4.500.000 ₫ nhé! Bạn chơi trình độ nào?";
  const result = await polishReply(
    { message, draft, facts },
    { env: {}, write: async () => written },
  );

  assert.equal(result.reply, written);
  assert.equal(result.source, "natural");
});

test("natural replies can be turned off", async () => {
  const result = await polishReply(
    { message, draft, facts },
    {
      env: { ADVISOR_NATURAL_REPLIES: "false" },
      write: async () => {
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(result.reply, draft);
});

test("claiming stock the draft never found is rejected", () => {
  assert.match(
    check("Ok, mình tìm được vài cây Yonex tầm 4.500.000 ₫. Bạn chơi trình độ nào?"),
    /hứa hẹn/,
  );
});

test("turning a maximum into a target is rejected", () => {
  const ceilingDraft = "Mình ghi nhận: vợt, tối đa 3.000.000 ₫. Bạn chơi trình độ nào?";

  assert.match(
    checkNaturalReply("Ok, vợt tầm 3.000.000 ₫ nhé. Bạn chơi trình độ nào?", {
      draft: ceilingDraft,
      message: "Vợt tối đa 3 triệu",
      facts,
    }),
    /đổi ý nghĩa/,
  );
});

test("flipping the stringing answer is rejected", () => {
  const stringingDraft = "Mình ghi nhận: ngân sách chưa gồm cước. Bạn đánh đơn hay đôi?";

  assert.match(
    checkNaturalReply("Ok, ngân sách đã gồm cước nhé. Bạn đánh đơn hay đôi?", {
      draft: stringingDraft,
      message: "Chưa gồm cước",
      facts,
    }),
    /đổi ý nghĩa/,
  );
});

test("speaking as the customer is rejected", () => {
  assert.match(
    checkNaturalReply("Mình cần vợt Yonex tầm 4.500.000 ₫ nhé. Bạn chơi trình độ nào?", {
      draft,
      message,
      facts,
    }),
    /nhầm vai/,
  );
});

test("a rejected rewrite gets one retry with the reason", async (t) => {
  t.mock.method(console, "warn", () => {});
  const calls = [];
  const good = "Ok, Yonex tầm 4.500.000 ₫ nhé! Bạn chơi trình độ nào?";

  const result = await polishReply(
    { message, draft, facts },
    {
      env: {},
      write: async (input) => {
        calls.push(input.previousProblem);
        return calls.length === 1 ? "Giá chỉ 1.000.000 ₫ thôi bạn?" : good;
      },
    },
  );

  assert.equal(result.reply, good);
  assert.equal(calls[0], null);
  assert.match(calls[1], /số không có/);
});

test("a writer error is not retried", async (t) => {
  t.mock.method(console, "warn", () => {});
  let calls = 0;

  const result = await polishReply(
    { message, draft, facts },
    {
      env: {},
      write: async () => {
        calls += 1;
        throw new Error("timeout");
      },
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.reply, draft);
});

test("adding a sales question the draft never asked is rejected", () => {
  const statement = "Mình tìm được 1 mẫu theo điều kiện của bạn.";

  assert.match(
    checkNaturalReply("Mình tìm được 1 mẫu cho bạn. Bạn có mua không?", {
      draft: statement,
      message: "Đánh đôi",
      facts,
    }),
    /thêm câu hỏi/,
  );
});

test("echoing the customer's question back is rejected", () => {
  const shippingDraft =
    "Mình chưa có thông tin chính xác về giao hàng. Bạn muốn tìm vợt hay giày cầu lông?";

  assert.match(
    checkNaturalReply(
      "Mình chưa có thông tin chính xác về giao hàng. Bạn giao hàng mất mấy ngày vậy shop?",
      { draft: shippingDraft, message: "Giao hàng mấy ngày vậy shop", facts },
    ),
    /lặp lại câu khách/,
  );
});

test("repeating a phrase the draft already has is allowed", () => {
  const formatDraft = "Mình ghi nhận: cả đơn và đôi. Ngân sách này đã bao gồm tiền cước chưa?";

  assert.equal(
    checkNaturalReply("Ok bạn, cả đơn và đôi nhé. Ngân sách này đã gồm cước chưa?", {
      draft: formatDraft,
      message: "Cả đơn và đôi",
      facts,
    }),
    null,
  );
});

test("a second question the draft never asked is rejected", () => {
  assert.match(
    check("Ok, vợt Yonex tầm 4.500.000 ₫ nhé. Bạn chơi trình độ nào? Mình giúp gì thêm không?"),
    /thêm câu hỏi/,
  );
});
