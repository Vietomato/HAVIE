import {
  AdvisorModelUnavailableError,
  createEmptyNeeds,
  extractRacketNeeds,
} from "./needsExtractor.js";
import { decideNextAction } from "./conversationPolicy.js";
import {
  findAdvisorAlternatives,
  searchAdvisorProducts,
} from "./productSearchService.js";

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const BRAND_LABELS = {
  yonex: "Yonex",
  lining: "Li-Ning",
  mizuno: "Mizuno",
  victor: "Victor",
};

function buildFallback(error, previousNeeds, lastQuestion) {
  const unavailable = error instanceof AdvisorModelUnavailableError;
  const reply = unavailable
    ? "Trợ lý tư vấn đang tạm gián đoạn. Bạn thử lại sau ít phút nhé."
    : "Mình chưa hiểu rõ ý bạn." +
      (lastQuestion ? ` ${lastQuestion}` : " Bạn nói rõ hơn giúp mình nhé.");

  return {
    action: unavailable ? "advisor_unavailable" : "clarify",
    needs: previousNeeds ?? createEmptyNeeds(),
    reply,
    lastQuestion,
    requestedField: null,
    suitabilityAssessed: false,
    candidates: [],
  };
}

function describeAlternatives(needs, { reason, candidates }) {
  const brand =
    BRAND_LABELS[needs.brandPreference] ?? needs.brandPreference;
  const budget = needs.budgetTargetVnd ?? needs.budgetMaxVnd;
  const price = candidates[0].priceVnd;
  const nearest =
    `có giá ${formatVnd(price)}` +
    (price > budget
      ? `, cao hơn ngân sách ${formatVnd(price - budget)}`
      : "");

  if (reason === "brand") {
    return `Mình chưa có mẫu ${brand} trong tầm giá này, nhưng có mẫu hãng khác phù hợp ngân sách. `;
  }

  if (reason === "brand_and_price") {
    return `Mình chưa có mẫu ${brand} gần mức ${formatVnd(budget)}. Mẫu hãng khác gần nhất ${nearest}. `;
  }

  return `Mình chưa có mẫu đúng mức ${formatVnd(budget)}. Mẫu gần nhất ${nearest}. `;
}

export async function handleRacketMessage(
  message,
  previousNeeds = null,
  lastQuestion = null,
  {
    extract = extractRacketNeeds,
    search = searchAdvisorProducts,
    findAlternatives = findAdvisorAlternatives,
  } = {},
) {
  let needs;

  try {
    needs = await extract(message, previousNeeds, lastQuestion);
  } catch (error) {
    // Lỗi từ model không được làm hỏng cuộc trò chuyện của khách.
    console.error("[chatService] Không đọc được nhu cầu:", error);
    return buildFallback(error, previousNeeds, lastQuestion);
  }

  const decision = decideNextAction(needs);

  if (decision.action === "ask_followup") {
    return {
      action: "ask_followup",
      needs,
      reply: decision.question,
      lastQuestion: decision.question,
      requestedField: decision.field,
      suitabilityAssessed: false,
      candidates: [],
    };
  }

  if (decision.action !== "search_products") {
    throw new Error(
      `Hành động chưa được hỗ trợ: ${decision.action}`,
    );
  }

  const found = await search(needs);

  if (
    !["CANDIDATES_FOUND", "NO_REVIEWED_MATCH"].includes(
      found.status,
    )
  ) {
    throw new Error(
      `Trạng thái tìm kiếm chưa được hỗ trợ: ${found.status}`,
    );
  }

  if (!Array.isArray(found.candidates)) {
    throw new Error("Danh sách sản phẩm trả về không hợp lệ.");
  }

  const isRacket = needs.productType === "rackets";

  const pricingNotice = isRacket
    ? "Giá niêm yết riêng cây vợt; chưa cộng tiền cước và công căng."
    : "Giá niêm yết theo từng biến thể sản phẩm.";

  const common = {
    needs,
    lastQuestion: null,
    requestedField: null,
    pricingNotice,
    initialBudgetVnd: found.initialBudgetVnd,
    suitabilityAssessed: false,
  };

  if (
    found.status === "NO_REVIEWED_MATCH" ||
    found.candidates.length === 0
  ) {
    const alternatives = await findAlternatives(needs);

    if (alternatives) {
      const followUp =
        "Bạn muốn xem mẫu này hay đổi hãng, khoảng giá tìm kiếm?";

      return {
        ...common,
        action: "suggest_alternatives",
        reply: describeAlternatives(needs, alternatives) + followUp,
        lastQuestion: followUp,
        candidates: alternatives.candidates,
      };
    }

    const question =
      "Bạn muốn đổi hãng hay mở rộng khoảng giá tìm kiếm không?";

    return {
      ...common,
      action: "no_reviewed_match",
      reply:
        "Mình chưa tìm thấy sản phẩm đáp ứng các điều kiện " +
        "tìm kiếm hiện tại trong dữ liệu cửa hàng. " +
        question,
      lastQuestion: question,
      candidates: [],
    };
  }

  // Chỉ sắp xếp các ứng viên mà dịch vụ tìm kiếm đã trả về.
  // Không tự thêm sản phẩm hoặc mở rộng ngân sách tại đây.
  const budgetAnchor =
    needs.budgetTargetVnd ?? needs.budgetMaxVnd;

  const candidates = [...found.candidates];

  if (
    Number.isSafeInteger(budgetAnchor) &&
    budgetAnchor >= 0
  ) {
    candidates.sort((left, right) => {
      const leftPrice =
        left.priceVnd ?? left.racketPriceVnd;

      const rightPrice =
        right.priceVnd ?? right.racketPriceVnd;

      const leftDistance = Number.isFinite(leftPrice)
        ? Math.abs(leftPrice - budgetAnchor)
        : Infinity;

      const rightDistance = Number.isFinite(rightPrice)
        ? Math.abs(rightPrice - budgetAnchor)
        : Infinity;

      if (leftDistance !== rightDistance) {
        return leftDistance < rightDistance ? -1 : 1;
      }

      // Cùng độ lệch: ưu tiên giá thấp hơn.
      if (
        Number.isFinite(leftPrice) &&
        Number.isFinite(rightPrice)
      ) {
        return leftPrice - rightPrice;
      }

      return 0;
    });
  }

  let reply =
    "Mình tìm được các sản phẩm theo điều kiện tìm kiếm của bạn. ";

  const nearestPrice = candidates[0]?.priceVnd;

  if (
    needs.budgetTargetVnd == null &&
    Number.isSafeInteger(nearestPrice)
  ) {
    reply +=
      `Mẫu gần ngân sách ${formatVnd(budgetAnchor)} nhất ` +
      `hiện có giá ${formatVnd(nearestPrice)}. `;
  } else if (
    Number.isSafeInteger(budgetAnchor) &&
    budgetAnchor >= 0
  ) {
    reply +=
      `Các mẫu trong danh sách được xếp theo mức giá gần ` +
      `${formatVnd(budgetAnchor)} nhất. `;
  }

  if (isRacket) {
    reply +=
      "Cần đối chiếu thêm thông số để đánh giá mức độ phù hợp " +
      "với trình độ, trọng lượng mong muốn và lối chơi.";

    if (needs.budgetIncludesStringing === true) {
      reply +=
        " Ngân sách của bạn gồm cước, nên cần cộng tiền cước " +
        "và công căng trước khi xác nhận tổng chi phí.";
    }
  } else {
    const sizeUnverified = candidates.some(
      (candidate) =>
        candidate.sizeStatus !== "listed_size_match",
    );

    reply += sizeUnverified
      ? "Một số mẫu chưa xác nhận được size bạn yêu cầu. "
      : "Các biến thể có size ghi nhận trùng với size bạn cung cấp. ";

    reply +=
      "Bạn nên đối chiếu bảng size đúng model và phom chân " +
      "trước khi chọn.";
  }

  return {
    ...common,
    action: "review_candidates",
    reply,
    candidates,
  };
}