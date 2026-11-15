import { getTensionHeuristic } from "./knowledgeBase.js";
import { formatLbsRangeWithKg } from "./tensionUnits.js";

// Tư vấn mức căng cước.
// - Khung theo trình độ (kho kiến thức) là gợi ý giáo dục, KHÔNG phải mức của hãng.
// - Giới hạn của HÃNG (stringingMinLbf/stringingMaxLbf trong advisorSpecs, đúng
//   biến thể trọng lượng đã được duyệt) luôn thắng: không gợi ý, không xác nhận
//   mức nằm ngoài khoảng đó.
// - Thiếu giới hạn đã xác minh thì chỉ nói khoảng tham khảo chung, không chốt
//   mức nào cho vợt đó và không khẳng định an toàn.

const SKILL_LABELS = {
  beginner: "người mới",
  intermediate: "trình trung bình",
  advanced: "trình nâng cao",
};

const isNumber = Number.isFinite;
const round1 = (value) => Math.round(value * 10) / 10;

function readLimit(specs) {
  const min = specs?.stringingMinLbf;
  const max = specs?.stringingMaxLbf;

  if (!isNumber(max) || max <= 0) return null;
  if (min === null || min === undefined) return { minLbf: null, maxLbf: max };
  return isNumber(min) && min > 0 && max >= min ? { minLbf: min, maxLbf: max } : null;
}

// Giao của khung tham khảo với khoảng hãng; rỗng thì null (không "kéo" về mép).
function intersect(range, limit) {
  const low = Math.max(range.lowLbf, limit.minLbf);
  const high = Math.min(range.highLbf, limit.maxLbf);

  return low <= high ? { lowLbf: low, highLbf: high } : null;
}

// specs: advisorSpecs của vợt (có thể null). requestedLbf: mức khách hỏi, đã quy
// về lbs (có thể null).
// status: ok | no_limit | no_overlap | need_skill
export function adviseTension({ skillLevel, specs, requestedLbf = null }) {
  const limit = readLimit(specs);
  const heuristic = skillLevel ? getTensionHeuristic(skillLevel) : null;

  const advice = {
    skillLevel: skillLevel ?? null,
    limit,
    limitKnown: limit !== null && limit.minLbf !== null,
    heuristic,
    suggested: null,
    status: "ok",
    requested: null,
  };

  if (!heuristic) {
    advice.status = "need_skill";
  } else if (!advice.limitKnown) {
    advice.status = "no_limit";
  } else {
    advice.suggested = intersect(heuristic, limit);
    if (!advice.suggested) advice.status = "no_overlap";
  }

  if (isNumber(requestedLbf)) {
    let status = "limit_unknown";

    if (limit) {
      status =
        requestedLbf > limit.maxLbf
          ? "above_limit"
          : limit.minLbf === null
            ? "maximum_only"
            : requestedLbf < limit.minLbf
              ? "below_limit"
              : "within_range";
    }

    advice.requested = { lbf: round1(requestedLbf), status };
  }

  return advice;
}

// Luôn nêu cả hai đơn vị: "24-28 lbs (khoảng 10.9-12.7 kg)".
const range = (low, high) => formatLbsRangeWithKg(low, high);

const CHECK_FRAME = "Thợ căng nên kiểm tra tình trạng khung trước khi căng.";

// Câu gợi ý đi kèm vợt được đề xuất (không lặp dải hãng vì describeFit đã nêu).
// Chỉ có khi đã biết giới hạn hãng của vợt đó.
export function describeTensionSuggestion(advice) {
  if (!advice.limitKnown || !advice.heuristic) return null;

  const label = SKILL_LABELS[advice.skillLevel];

  if (advice.status === "no_overlap") {
    return (
      `Khoảng tham khảo cho ${label} (${range(advice.heuristic.lowLbf, advice.heuristic.highLbf)}) ` +
      "không giao với khoảng hãng khuyến nghị cho mẫu này, nên em chưa đề xuất mức căng cụ thể."
    );
  }

  return (
    `Với ${label}, anh/chị có thể bắt đầu ở khoảng ${range(advice.suggested.lowLbf, advice.suggested.highLbf)}, ` +
    "nghiêng về mức thấp. Hơn nữa, anh/chị nên tinh chỉnh khoảng 1 lbs mỗi lần theo cảm giác. " +
    `Ngoài ra, ${CHECK_FRAME.charAt(0).toLowerCase()}${CHECK_FRAME.slice(1)}`
  );
}

// Trả lời trực tiếp câu hỏi về mức căng của khách.
// racketLabel: tên vợt kèm biến thể (vd. "X 4U / G5"), null nếu chưa biết mẫu vợt.
// request: kết quả parseTensionRequest (có thể null).
export function describeTensionAnswer(advice, racketLabel, request = null) {
  if (request?.ambiguous) {
    return `Anh/chị nói mức ${request.value} là lbs hay kg, để em quy đổi đúng nhé?`;
  }

  if (request?.implausible) {
    return (
      `Mức ${request.value} ${request.unit === "kgf" ? "kg" : "lbs"} không giống một mức căng vợt thông thường. ` +
      "Đường kính cước (tính bằng mm) khác với lực căng (tính bằng lbs hoặc kg), nên không đổi từ số này sang số kia được."
    );
  }

  const sentences = [];
  const name = racketLabel ?? "vợt này";

  if (request?.unit === "kgf") {
    sentences.push(`${request.value} kgf khoảng ${request.lbf} lbs.`);
  }

  if (advice.requested) {
    const { lbf, status } = advice.requested;

    if (!racketLabel) {
      sentences.push(
        "Giới hạn căng của hãng khác nhau theo từng model và biến thể (3U, 4U...), " +
          `nên em cần biết đúng mẫu và phiên bản vợt mới xác nhận được mức ${lbf} lbs.`,
      );
    } else if (status === "above_limit") {
      sentences.push(
        `${lbf} lbs vượt giới hạn ${advice.limit.maxLbf} lbs của hãng cho ${name}, ` +
          "nên em không đề xuất căng mức đó.",
      );
    } else if (status === "below_limit") {
      sentences.push(
        `${lbf} lbs thấp hơn khoảng ${range(advice.limit.minLbf, advice.limit.maxLbf)} hãng khuyến nghị cho ${name}, ` +
          "nên em không chốt mức đó.",
      );
    } else if (status === "maximum_only") {
      sentences.push(`Hãng chỉ công bố trần ${advice.limit.maxLbf} lbs cho ${name}, chưa có dải khuyến nghị đầy đủ, ` +
        `nên em chưa xác nhận ${lbf} lbs là mức phù hợp; cần thợ kiểm tra khung và điều kiện thực tế.`);
    } else if (status === "within_range") {
      sentences.push(
        `${lbf} lbs nằm trong khoảng ${range(advice.limit.minLbf, advice.limit.maxLbf)} hãng khuyến nghị cho ${name}. ` +
          CHECK_FRAME,
      );
    } else {
      sentences.push(
        `Em chưa có giới hạn căng đã xác minh của hãng cho ${name}, nên chưa xác nhận ${lbf} lbs có an toàn không; ` +
          "anh/chị nên xem nhãn trên khung vợt hoặc hỏi thợ căng.",
      );
    }

    return sentences.join(" ");
  }

  if (advice.status === "ok") {
    sentences.push(
      `Với ${name}, hãng khuyến nghị ${range(advice.limit.minLbf, advice.limit.maxLbf)}.`,
      describeTensionSuggestion(advice),
    );
  } else if (advice.status === "no_overlap") {
    sentences.push(describeTensionSuggestion(advice));
  } else if (advice.status === "no_limit") {
    sentences.push(
      `Khoảng tham khảo chung cho ${SKILL_LABELS[advice.skillLevel]} là ${range(advice.heuristic.lowLbf, advice.heuristic.highLbf)}, ` +
        "không phải mức của hãng. Em chưa có giới hạn căng đã xác minh cho mẫu vợt cụ thể, " +
        "nên chưa chốt mức nào; anh/chị cần xem nhãn trên vợt hoặc hỏi thợ căng.",
    );
  } else {
    sentences.push(
      "Để gợi ý mức căng, em cần biết trình độ của anh/chị và đúng mẫu, phiên bản vợt dự định dùng.",
    );
  }

  return sentences.filter(Boolean).join(" ");
}
