export function decideNextAction(needs) {
  // clarification: cách hỏi khác, nêu rõ các lựa chọn. Dùng khi khách đã trả lời
  // mà bot vẫn chưa đọc được, để không lặp lại nguyên câu hỏi cũ.
  function ask(field, question, clarification) {
    return {
      action: "ask_followup",
      field,
      question,
      clarification,
    };
  }

  if (!needs.productType) {
    return ask(
      "productType",
      "Anh/chị muốn tìm vợt hay giày cầu lông?",
      "Anh/chị trả lời giúp em \"vợt\" hay \"giày\" nhé?",
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
        ? "Anh/chị dự định chi khoảng bao nhiêu cho đôi giày?"
        : "Anh/chị dự định chi khoảng bao nhiêu cho cây vợt?",
      "Anh/chị cho em một mức cụ thể, ví dụ \"khoảng 3 triệu\" hoặc \"tối đa 2 triệu\" nhé?",
    );
  }

  if (isShoes) {
    if (needs.shoeSize == null) {
      return ask(
        "shoeSize",
        "Anh/chị đang mang size giày bao nhiêu, theo hệ EU, US, UK hay CM?",
        "Anh/chị cho em số size, ví dụ \"size 42 EU\" nhé?",
      );
    }

    if (needs.shoeSizeSystem == null) {
      return ask(
        "shoeSizeSystem",
        `Size ${needs.shoeSize} anh/chị nói thuộc hệ EU, US, UK hay CM?`,
        `Anh/chị chọn giúp em một hệ cho size ${needs.shoeSize}: EU, US, UK hay CM?`,
      );
    }
  } else {
    if (needs.skillLevel == null) {
      return ask(
        "skillLevel",
        "Anh/chị mới bắt đầu hay tự đánh giá trình độ hiện tại thế nào?",
        "Anh/chị chọn giúp em một mức: mới chơi, trung bình hay nâng cao?",
      );
    }

    if (needs.playFormat == null) {
      return ask(
        "playFormat",
        "Anh/chị chủ yếu đánh đơn, đánh đôi hay cả hai?",
        "Anh/chị chọn giúp em một trong ba: đánh đơn, đánh đôi hay cả hai?",
      );
    }

    // Không hỏi ngân sách đã gồm cước chưa: giá vợt luôn là giá chưa gồm tiền căng cước,
    // và câu tư vấn luôn nói rõ điều đó.
  }

  return {
    action: "search_products",
    question: null,
    needs,
  };
}
