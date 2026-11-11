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
import {
  BRAND_LABELS,
  describeFit,
  describeNeedsChange,
  describeOutOfScope,
  fitPenalty,
  formatVnd,
  polishReply,
} from "./advisorReply.js";

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
    return `Mình chưa có mẫu ${brand} trong tầm giá này, nhưng có mẫu hãng khác phù hợp ngân sách.`;
  }

  if (reason === "brand_and_price") {
    return `Mình chưa có mẫu ${brand} gần mức ${formatVnd(budget)}. Mẫu hãng khác gần nhất ${nearest}.`;
  }

  return `Mình chưa có mẫu đúng mức ${formatVnd(budget)}. Mẫu gần nhất ${nearest}.`;
}

// Gần ngân sách trước; mẫu khó với người mới xuống sau.
function sortCandidates(candidates, needs) {
  const anchor = needs.budgetTargetVnd ?? needs.budgetMaxVnd;
  const distance = (item) =>
    Number.isFinite(item.priceVnd) ? Math.abs(item.priceVnd - anchor) : Infinity;

  return [...candidates].sort(
    (left, right) =>
      fitPenalty(left, needs) - fitPenalty(right, needs) ||
      distance(left) - distance(right) ||
      (left.priceVnd ?? 0) - (right.priceVnd ?? 0),
  );
}

function describeCandidates(needs, candidates) {
  const anchor = needs.budgetTargetVnd ?? needs.budgetMaxVnd;
  const nearest = candidates[0].priceVnd;
  const sentences = [
    candidates.length === 1
      ? "Mình tìm được 1 mẫu theo điều kiện của bạn."
      : `Mình tìm được ${candidates.length} mẫu theo điều kiện của bạn.`,
  ];

  if (needs.budgetTargetVnd == null && Number.isSafeInteger(nearest)) {
    sentences.push(
      `Mẫu gần ngân sách ${formatVnd(anchor)} nhất hiện có giá ${formatVnd(nearest)}.`,
    );
  } else if (Number.isSafeInteger(anchor)) {
    sentences.push(`Các mẫu được xếp theo mức giá gần ${formatVnd(anchor)} nhất.`);
  }

  if (needs.productType === "rackets") {
    const fit = describeFit(candidates[0], needs);

    sentences.push(
      ...(fit.length
        ? fit
        : ["Mình chưa có đủ thông số để đánh giá độ hợp với lối chơi của bạn."]),
    );

    if (needs.budgetIncludesStringing === true) {
      sentences.push(
        "Ngân sách của bạn gồm cước, nên nhớ cộng thêm tiền cước và công căng.",
      );
    }
  } else {
    const sizeUnverified = candidates.some(
      (candidate) => candidate.sizeStatus !== "listed_size_match",
    );

    sentences.push(
      sizeUnverified
        ? "Một số mẫu chưa xác nhận được size bạn yêu cầu."
        : "Các mẫu có size trùng với size bạn cung cấp.",
      "Bạn nên đối chiếu bảng size đúng model và phom chân trước khi chọn.",
    );
  }

  return sentences.join(" ");
}

// Quyết định nội dung trả lời; câu chữ cuối cùng do polishReply xử lý.
async function decideReply(needs, { search, findAlternatives }) {
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
    throw new Error(`Hành động chưa được hỗ trợ: ${decision.action}`);
  }

  const found = await search(needs);

  if (!["CANDIDATES_FOUND", "NO_REVIEWED_MATCH"].includes(found.status)) {
    throw new Error(`Trạng thái tìm kiếm chưa được hỗ trợ: ${found.status}`);
  }

  if (!Array.isArray(found.candidates)) {
    throw new Error("Danh sách sản phẩm trả về không hợp lệ.");
  }

  const common = {
    needs,
    lastQuestion: null,
    requestedField: null,
    pricingNotice:
      needs.productType === "rackets"
        ? "Giá niêm yết riêng cây vợt; chưa cộng tiền cước và công căng."
        : "Giá niêm yết theo từng biến thể sản phẩm.",
    initialBudgetVnd: found.initialBudgetVnd,
    suitabilityAssessed: false,
  };

  if (found.status === "NO_REVIEWED_MATCH" || found.candidates.length === 0) {
    const alternatives = await findAlternatives(needs);

    if (alternatives) {
      const followUp = "Bạn muốn xem mẫu này hay đổi hãng, khoảng giá tìm kiếm?";

      return {
        ...common,
        action: "suggest_alternatives",
        reply: `${describeAlternatives(needs, alternatives)} ${followUp}`,
        lastQuestion: followUp,
        candidates: alternatives.candidates,
      };
    }

    const question = "Bạn muốn đổi hãng hay mở rộng khoảng giá tìm kiếm không?";

    return {
      ...common,
      action: "no_reviewed_match",
      reply:
        "Mình chưa tìm thấy sản phẩm đáp ứng các điều kiện tìm kiếm " +
        `hiện tại trong dữ liệu cửa hàng. ${question}`,
      lastQuestion: question,
      candidates: [],
    };
  }

  const candidates = sortCandidates(found.candidates, needs);

  return {
    ...common,
    action: "review_candidates",
    reply: describeCandidates(needs, candidates),
    candidates,
  };
}

function buildFacts(result) {
  return {
    products: result.candidates.map((candidate) => ({
      name: candidate.name,
      price: formatVnd(candidate.priceVnd),
      notes: describeFit(candidate, result.needs),
    })),
    pricingNotice: result.pricingNotice ?? null,
  };
}

export async function handleRacketMessage(
  message,
  previousNeeds = null,
  lastQuestion = null,
  {
    extract = extractRacketNeeds,
    search = searchAdvisorProducts,
    findAlternatives = findAdvisorAlternatives,
    polish = polishReply,
  } = {},
) {
  const outOfScope = describeOutOfScope(message);
  let needs;

  try {
    needs = await extract(message, previousNeeds, lastQuestion);
  } catch (error) {
    // Lỗi từ model không được làm hỏng cuộc trò chuyện của khách.
    console.error("[chatService] Không đọc được nhu cầu:", error);
    const fallback = buildFallback(error, previousNeeds, lastQuestion);
    const reply = [...outOfScope, fallback.reply].join(" ");

    return { ...fallback, reply, draftReply: reply, replySource: "template" };
  }

  const result = await decideReply(needs, { search, findAlternatives });
  const draft = [
    describeNeedsChange(previousNeeds ?? createEmptyNeeds(), needs),
    result.reply,
  ]
    .filter(Boolean)
    .join(" ");

  const polished = await polish({ message, draft, facts: buildFacts(result) });

  // Câu trả lời ngoài phạm vi giữ nguyên văn, không để model viết lại hay bỏ sót.
  const join = (text) => [...outOfScope, text].join(" ");

  return {
    ...result,
    reply: join(polished.reply),
    draftReply: join(draft),
    replySource: polished.source,
    replyIssue: polished.reason,
  };
}
