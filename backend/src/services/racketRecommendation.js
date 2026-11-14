import { loadKnowledge } from "./knowledgeBase.js";
import { cleanRacketName } from "../utils/productName.js";
import { formatLbsRangeWithKg } from "./tensionUnits.js";
import { adviseTension, describeTensionSuggestion } from "./tensionAdvisor.js";

// Dựng câu tư vấn vợt: 3-5 mẫu, mỗi mẫu có thông số, lý do chọn và lưu ý.
// Mọi câu đều lấy từ dữ liệu thật của mẫu vợt (thông số hãng đã duyệt, mô tả của shop) và
// kho kiến thức. Không để AI viết lại: câu có cấu trúc, nhiều dòng, giá và thông số phải đúng.

export const NO_STRINGING_NOTICE = "Chưa gồm tiền căng cước";

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const SKILL_LABELS = {
  beginner: "mới chơi",
  intermediate: "trình trung bình",
  advanced: "trình nâng cao",
};
const PLAY_LABELS = { singles: "đánh đơn", doubles: "đánh đôi", both: "cả đơn và đôi" };
const FLEX_LABELS = {
  flexible: "thân dẻo",
  medium: "thân trung bình",
  stiff: "thân cứng",
  extra_stiff: "thân rất cứng",
};
const BRAND_LABELS = { yonex: "Yonex", lining: "Li-Ning", mizuno: "Mizuno", victor: "Victor" };

const PLACEHOLDER_VARIANT = /^default title$/iu;

const lowerFirst = (text) => `${text.charAt(0).toLocaleLowerCase("vi")}${text.slice(1)}`;

// Nối các ý bằng từ chuyển ý ("Hơn nữa, ...", "Ngoài ra, ...") cho câu trả lời tự nhiên hơn.
// Ý đầu giữ nguyên (hoặc mở bằng `first` nếu có); các ý sau lần lượt dùng từ trong `connectors`.
function joinWithConnectors(sentences, connectors, first = null) {
  return sentences.map((sentence, index) => {
    const connector = index === 0 ? first : connectors[Math.min(index - 1, connectors.length - 1)];
    return connector ? `${connector}, ${lowerFirst(sentence)}` : sentence;
  }).join(" ");
}

function displayName(candidate) {
  const name = cleanRacketName(candidate.name, "rackets");
  const variant = candidate.variantName && !PLACEHOLDER_VARIANT.test(candidate.variantName)
    ? candidate.variantName
    : null;
  return variant ? `${name} (${variant})` : name;
}

// Thông số hiệu lực của một mẫu: ưu tiên thông số hãng đã duyệt, sau đó mô tả của shop.
function readTraits(candidate) {
  const specs = candidate.advisorSpecs ?? {};
  const traits = candidate.racketTraits ?? {};
  const verifiedFlex = specs.shaftFlex ?? null;
  const verifiedBalance = specs.balanceType ?? null;
  return {
    weightClass: specs.weightClass ?? traits.weightClass ?? null,
    averageWeightG: Number.isFinite(specs.averageWeightG) ? specs.averageWeightG : null,
    shaftFlex: verifiedFlex ?? traits.shaftFlex ?? null,
    balanceType: verifiedBalance ?? traits.balanceType ?? null,
    flexFromShopText: !verifiedFlex && Boolean(traits.shaftFlex),
    balanceFromShopText: !verifiedBalance && Boolean(traits.balanceType),
    stringingMinLbf: Number.isFinite(specs.stringingMinLbf) ? specs.stringingMinLbf : null,
    stringingMaxLbf: Number.isFinite(specs.stringingMaxLbf) ? specs.stringingMaxLbf : null,
  };
}

function describeNeeds(needs) {
  const parts = [];
  if (needs.skillLevel) parts.push(SKILL_LABELS[needs.skillLevel]);
  if (needs.playFormat) parts.push(PLAY_LABELS[needs.playFormat]);
  if (needs.brandPreference) parts.push(`hãng ${BRAND_LABELS[needs.brandPreference] ?? needs.brandPreference}`);
  if (needs.budgetTargetVnd != null) parts.push(`ngân sách khoảng ${formatVnd(needs.budgetTargetVnd)}`);
  else if (needs.budgetMaxVnd != null) parts.push(`ngân sách tối đa ${formatVnd(needs.budgetMaxVnd)}`);
  return parts.filter(Boolean).join(", ");
}

function specLine(traits) {
  const bits = [];
  if (traits.weightClass) {
    bits.push(`hạng ${traits.weightClass}${traits.averageWeightG ? ` (khoảng ${traits.averageWeightG} g)` : ""}`);
  }
  if (traits.shaftFlex && FLEX_LABELS[traits.shaftFlex]) {
    bits.push(`${FLEX_LABELS[traits.shaftFlex]}`);
  }
  const balance = loadKnowledge().racquet.balance_types.find((item) => item.id === traits.balanceType);
  if (balance) bits.push(`${balance.label}`);

  let line = bits.length ? `Thông số: ${bits.join(", ")}.` : "";
  if (traits.stringingMaxLbf !== null) {
    const range = traits.stringingMinLbf !== null
      ? formatLbsRangeWithKg(traits.stringingMinLbf, traits.stringingMaxLbf)
      : formatLbsRangeWithKg(traits.stringingMaxLbf, traits.stringingMaxLbf);
    const text = traits.stringingMinLbf !== null
      ? `Hãng khuyến nghị căng ${range}.`
      : `Hãng công bố mức căng tối đa ${range}.`;
    line = line ? `${line} ${text}` : text;
  }
  return line;
}

// Lý do chọn: điểm khớp với nhu cầu (luật trong kho kiến thức) và ý nghĩa của điểm cân bằng.
function reasonLine(candidate, traits, needs) {
  const knowledge = loadKnowledge().racquet;
  const reasons = [];

  const fitNote = candidate.fit?.tier === 2 ? candidate.fit.fitNotes?.[0] : null;
  if (fitNote) reasons.push(`${fitNote}.`);

  const balance = knowledge.balance_types.find((item) => item.id === traits.balanceType);
  if (balance && needs.balancePreference && traits.balanceType === needs.balancePreference) {
    reasons.push(`Có điểm cân bằng ${balance.label}, đúng ý anh/chị.`);
  }
  if (balance?.strengths?.length) {
    const strengths = balance.strengths.slice(0, 2).join(", ");
    // "cân bằng" là nhãn của chính điểm cân bằng nên không viết "điểm cân bằng cân bằng".
    reasons.push(
      balance.id === "even"
        ? `Vợt cân bằng: ${strengths}.`
        : `Điểm cân bằng ${balance.label}: ${strengths}.`,
    );
  }

  const flex = knowledge.shaft_flex.find((item) => item.id === traits.shaftFlex);
  const flexRelevant = needs.skillLevel === "beginner" && ["flexible", "medium"].includes(traits.shaftFlex);
  if (flex?.advisor_note_vi && flexRelevant) {
    reasons.push(`Thân ${flex.label}: ${flex.advisor_note_vi.charAt(0).toLowerCase()}${flex.advisor_note_vi.slice(1)}`);
  }

  if (!reasons.length) {
    reasons.push("Mức giá nằm trong ngân sách anh/chị đưa ra, và em chưa thấy điểm nào lệch với nhu cầu của anh/chị.");
  }
  return `Vì sao phù hợp: ${joinWithConnectors(reasons, ["Hơn nữa", "Ngoài ra"])}`;
}

function featureLine(candidate) {
  const text = String(candidate.description ?? "").replace(/\s+/gu, " ").trim();
  if (!text) return "";
  // Câu mô tả của shop, cắt ở câu đầu để đoạn không quá dài.
  const first = text.split(/(?<=[.!])\s+/u)[0];
  return `Đặc tính: ${first.length > 160 ? `${first.slice(0, 157).trimEnd()}...` : first}`;
}

function cautionLine(candidate, traits, needs) {
  const notes = [];
  const cautions = candidate.fit?.cautionNotes ?? [];
  if (cautions.length) notes.push(`${cautions[0]}.`);
  if (traits.shaftFlex === "extra_stiff" && needs.skillLevel !== "advanced") {
    notes.push("Thân rất cứng, cần kỹ thuật và tốc độ vung tốt để phát huy.");
  } else if (["stiff"].includes(traits.shaftFlex) && needs.skillLevel === "beginner") {
    notes.push("Thân cứng, người mới chơi thường thấy khó đánh hơn vợt thân dẻo.");
  }
  const wanted = needs.balancePreference;
  if (wanted && traits.balanceType && traits.balanceType !== wanted) {
    const labels = { head_heavy: "nặng đầu", even: "cân bằng", head_light: "nhẹ đầu" };
    notes.push(`Điểm cân bằng ${labels[traits.balanceType]} khác với mong muốn ${labels[wanted]} của anh/chị.`);
  }
  if (!candidate.advisorSpecs) {
    notes.push("Em chưa có đủ thông số hãng đã duyệt cho đúng biến thể này, nên chỉ dựa vào mô tả của shop.");
  }
  // Lưu ý đi sau phần lý do nên mở bằng "Tuy vậy", các lưu ý tiếp theo nối bằng "Bên cạnh đó".
  return notes.length ? `Lưu ý: ${joinWithConnectors(notes, ["Bên cạnh đó", "Ngoài ra"], "Tuy vậy")}` : "";
}

function describeOne(candidate, index, needs) {
  const traits = readTraits(candidate);
  const price = Number.isFinite(candidate.priceVnd) && candidate.priceVnd > 0
    ? formatVnd(candidate.priceVnd)
    : "chưa có giá";
  return [
    `${index + 1}. ${displayName(candidate)}`,
    `Giá: ${price} (${NO_STRINGING_NOTICE.charAt(0).toLowerCase()}${NO_STRINGING_NOTICE.slice(1)})`,
    specLine(traits),
    reasonLine(candidate, traits, needs),
    featureLine(candidate),
    cautionLine(candidate, traits, needs),
  ].filter(Boolean).join("\n");
}

// candidates: đã xếp theo độ hợp; tối đa 5 mẫu được nêu.
export function describeRacketRecommendations(needs, candidates, { excludedForFit = 0 } = {}) {
  const shown = candidates.slice(0, 5);
  const summary = describeNeeds(needs);
  const count = shown.length;

  const intro = [
    summary
      ? `Dạ, em cảm ơn anh/chị đã chia sẻ ạ! Dựa trên nhu cầu của anh/chị (${summary}), `
      : "Dạ, em cảm ơn anh/chị đã quan tâm ạ! Với nhu cầu hiện tại, ",
    count >= 3
      ? `em gợi ý ${count} mẫu vợt dưới đây:`
      : count === 1
        ? "hiện em chọn được 1 mẫu phù hợp:"
        : `hiện em chọn được ${count} mẫu phù hợp:`,
  ].join("");

  const blocks = shown.map((candidate, index) => describeOne(candidate, index, needs));

  // Mức căng gợi ý theo trình độ, bị chặn bởi giới hạn hãng của mẫu đứng đầu (kèm quy đổi kg).
  const tension = describeTensionSuggestion(
    adviseTension({ skillLevel: needs.skillLevel, specs: shown[0]?.advisorSpecs ?? null }),
  );

  const footer = [`${NO_STRINGING_NOTICE}.`];
  if (needs.balancePreference && !shown.some((item) =>
    (item.advisorSpecs?.balanceType ?? item.racketTraits?.balanceType) === needs.balancePreference)) {
    footer.push("Chưa có mẫu nào xác nhận đúng sở thích cân bằng anh/chị nêu, nên em chưa xem các mẫu trên là khớp yêu cầu đó.");
  }
  if (excludedForFit > 0) {
    footer.push(`Em đã bỏ ${excludedForFit} mẫu trong tầm giá vì chưa hợp với trình độ hoặc sở thích anh/chị nêu.`);
  }

  const closing = count > 1
    ? "Anh/chị đang phân vân giữa cây nào, cứ nói em nhé, em so sánh kỹ hơn giúp anh/chị ạ. Em cũng có thể tư vấn cước và mức căng cho cây anh/chị chọn."
    : "Nếu anh/chị ưng cây này, em tư vấn thêm cước và mức căng cho anh/chị luôn nhé.";

  return [intro, ...blocks, tension, footer.join(" "), closing].filter(Boolean).join("\n\n");
}
