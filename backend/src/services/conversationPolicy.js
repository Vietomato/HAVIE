export function decideNextAction(needs) {
  function ask(field, question) {
    return {
      action: "ask_followup",
      field,
      question,
    };
  }

  if (!needs.productType) {
    return ask(
      "productType",
      "Bạn muốn tìm vợt hay giày cầu lông?",
    );
  }

  const isShoes = needs.productType === "shoes";

  if (
    needs.budgetTargetVnd == null &&
    needs.budgetMaxVnd == null
  ) {
    return ask(
      "budget",
      isShoes
        ? "Bạn dự định chi khoảng bao nhiêu cho đôi giày?"
        : "Bạn dự định chi khoảng bao nhiêu cho cây vợt?",
    );
  }

  if (isShoes) {
    if (needs.shoeSize == null) {
      return ask(
        "shoeSize",
        "Bạn đang mang size giày bao nhiêu, theo hệ EU, US, UK hay CM?",
      );
    }

    if (needs.shoeSizeSystem == null) {
      return ask(
        "shoeSizeSystem",
        `Size ${needs.shoeSize} bạn nói thuộc hệ EU, US, UK hay CM?`,
      );
    }
  } else {
    if (needs.skillLevel == null) {
      return ask(
        "skillLevel",
        "Bạn mới bắt đầu hay tự đánh giá trình độ hiện tại thế nào?",
      );
    }

    if (needs.playFormat == null) {
      return ask(
        "playFormat",
        "Bạn chủ yếu đánh đơn, đánh đôi hay cả hai?",
      );
    }

    if (needs.budgetIncludesStringing == null) {
      return ask(
        "budgetIncludesStringing",
        "Ngân sách này đã bao gồm tiền cước chưa?",
      );
    }
  }

  return {
    action: "search_products",
    question: null,
    needs,
  };
}