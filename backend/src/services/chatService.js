import { extractRacketNeeds } from "./needsExtractor.js";
import { decideNextAction } from "./conversationPolicy.js";
import { searchAdvisorProducts } from "./productSearchService.js";

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export async function handleRacketMessage(
  message,
  previousNeeds = null,
  lastQuestion = null,
) {
  const needs = await extractRacketNeeds(
    message,
    previousNeeds,
    lastQuestion,
  );

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

  const search = await searchAdvisorProducts(needs);

  if (
    !["CANDIDATES_FOUND", "NO_REVIEWED_MATCH"].includes(
      search.status,
    )
  ) {
    throw new Error(
      `Trạng thái tìm kiếm chưa được hỗ trợ: ${search.status}`,
    );
  }

  if (!Array.isArray(search.candidates)) {
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
    initialBudgetVnd: search.initialBudgetVnd,
    suitabilityAssessed: false,
  };

  if (
    search.status === "NO_REVIEWED_MATCH" ||
    search.candidates.length === 0
  ) {
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

  const candidates = [...search.candidates];

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

  if (
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