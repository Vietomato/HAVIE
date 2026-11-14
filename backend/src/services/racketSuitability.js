import { getSuitabilityRules } from "./knowledgeBase.js";

// Đánh giá độ hợp của một cây vợt với khách theo luật trong kho kiến thức
// (racquet.suitability_rules). Chỉ dựa vào thông tin cây vợt thật sự có:
//  - hạng U của biến thể (dữ liệu shop),
//  - độ cứng và điểm cân bằng: thông số đã duyệt, hoặc mô tả sản phẩm của shop.
// Thiếu thông tin nào thì không tính phần đó, không đoán.

const FLEX_LABELS = {
  flexible: "thân dẻo",
  medium: "thân trung bình",
  stiff: "thân cứng",
  extra_stiff: "thân rất cứng",
};

const BALANCE_LABELS = {
  head_heavy: "nặng đầu",
  even: "cân bằng",
  head_light: "nhẹ đầu",
};

const text = (value) => String(value ?? "").normalize("NFC").toLowerCase();

export function readWeightClass({ attributes, variantName, productName } = {}) {
  const candidates = [attributes?.weight, variantName, productName];

  for (const source of candidates) {
    const match = String(source ?? "").match(/(?:^|[^\p{L}\p{N}])((?:[2-6])(?:\.5)?U)(?=$|[^\p{L}\p{N}])/iu);

    if (match) return match[1].toUpperCase();
  }

  return null;
}

// Độ cứng trong mô tả sản phẩm, ví dụ "Cứng (Stiff)", "Rất cứng (Extra Stiff)".
export function parseCatalogFlex(value) {
  const v = text(value);

  // A manufacturer scale or "Hard Flexible" is not a normalized flex category.
  if (/[□■○●]/u.test(v) || /(?:hard|soft)\s+flexible/u.test(v)) return null;

  if (/extra stiff|rất cứng/u.test(v)) return "extra_stiff";
  if (/dẻo|mềm|flexible/u.test(v)) return "flexible";
  if (/trung bình|medium/u.test(v) && !/cứng/u.test(v.replace(/trung bình/u, ""))) return "medium";
  if (/cứng|stiff/u.test(v)) return "stiff";

  return null;
}

// Điểm cân bằng trong mô tả; chỉ có số mm thì không suy ra loại.
export function parseCatalogBalance(value) {
  const v = text(value);

  if (/[□■○●]/u.test(v) ||
      (/nhẹ đầu|head light/u.test(v) && /nặng đầu|head heavy/u.test(v))) return null;

  if (/nhẹ đầu|head light/u.test(v)) return "head_light";
  if (/nặng đầu|head heavy/u.test(v)) return "head_heavy";
  if (/cân bằng|even/u.test(v)) return "even";

  return null;
}

// specs: mảng chuỗi "Nhãn: giá trị" của sản phẩm.
export function parseCatalogSpecs(specs) {
  const line = (label) => {
    const found = (specs ?? []).find((item) => String(item).startsWith(label));

    return found ? String(found).slice(String(found).indexOf(":") + 1).trim() : null;
  };

  const flex = line("Độ cứng");
  const balance = line("Điểm cân bằng");

  return {
    shaftFlex: flex ? parseCatalogFlex(flex) : null,
    balanceType: balance ? parseCatalogBalance(balance) : null,
  };
}

// Thang thứ tự: chỉ coi là "ngược ý" khi lệch từ 2 bậc (nhẹ đầu <-> nặng đầu,
// dẻo <-> cứng), vợt cân bằng hay thân trung bình vẫn chấp nhận được.
const FLEX_SCALE = ["flexible", "medium", "stiff", "extra_stiff"];
const BALANCE_SCALE = ["head_light", "even", "head_heavy"];

const farFrom = (scale, wanted) =>
  scale.filter((id) => Math.abs(scale.indexOf(id) - scale.indexOf(wanted)) >= 2);

const TIERS = { excluded: -1, caution: 0, neutral: 1, fit: 2 };

export const SUITABILITY_TIERS = TIERS;

// Explicit customer preferences take precedence over price and generic fit points.
export function preferenceRank(candidate, needs) {
  const specs = candidate.advisorSpecs ?? candidate.racketTraits ?? {};
  let rank = 0;
  for (const [wanted, actual, scale] of [
    [needs.balancePreference, specs.balanceType, BALANCE_SCALE],
    [needs.shaftFlexPreference, specs.shaftFlex, FLEX_SCALE],
  ]) {
    if (!wanted) continue;
    rank += actual === wanted ? 0 : !actual ? 2
      : Math.abs(scale.indexOf(actual) - scale.indexOf(wanted)) >= 2 ? 3 : 1;
  }
  return rank;
}

// traits: { weightClass, shaftFlex, balanceType, specSource: "approved"|"catalog_text"|null }
// needs: hồ sơ nhu cầu của khách.
export function assessRacket(traits, needs, rules = getSuitabilityRules()) {
  let score = 0;
  let excluded = false;
  const fitLabels = [];
  const fitReasons = [];
  const cautionLabels = [];
  const cautionReasons = [];

  const addUnique = (list, items) => {
    for (const item of items) if (!list.includes(item)) list.push(item);
  };

  const valueOf = {
    weight_classes: traits.weightClass,
    shaft_flex: traits.shaftFlex,
    balance: traits.balanceType,
  };

  const labelOf = {
    weight_classes: (value) => `hạng ${value}`,
    shaft_flex: (value) => FLEX_LABELS[value] ?? value,
    balance: (value) => BALANCE_LABELS[value] ?? value,
  };

  const fromCatalogText = (dimension) =>
    traits.specSource === "catalog_text" && dimension !== "weight_classes";

  // group: { weight_classes?, shaft_flex?, balance?, reason_vi? }; weight: điểm mỗi tín hiệu.
  const apply = (group, weight = 1) => {
    if (!group) return;

    const matched = [];
    const warned = [];

    for (const dimension of ["weight_classes", "shaft_flex", "balance"]) {
      const rule = group[dimension];
      const value = valueOf[dimension];

      if (!rule || !value) continue;

      const label = labelOf[dimension](value);

      if ((rule.exclude ?? []).includes(value)) {
        excluded = true;
        warned.push(label);
      } else if ((rule.avoid ?? []).includes(value)) {
        score -= weight;
        warned.push(label);
      } else if ((rule.prefer ?? []).includes(value)) {
        score += weight;
        matched.push(label);
      }
    }

    if (matched.length) {
      addUnique(fitLabels, matched);
      if (group.match_vi) addUnique(fitReasons, [group.match_vi]);
    }

    if (warned.length) {
      addUnique(cautionLabels, warned);
      if (group.match_vi) addUnique(cautionReasons, [group.match_vi]);
    }
  };

  apply(rules.by_skill?.[needs.skillLevel]);
  apply(rules.by_play_format?.[needs.playFormat]);

  for (const priority of needs.priorities ?? []) apply(rules.by_priority?.[priority]);

  // Sở thích khách nói rõ có trọng số cao hơn.
  if (needs.weightPreference && rules.weight_preference?.[needs.weightPreference]) {
    apply({ weight_classes: rules.weight_preference[needs.weightPreference], match_vi: `anh/chị muốn vợt ${needs.weightPreference}` }, 2);
  }

  if (needs.balancePreference) {
    apply({ balance: { prefer: [needs.balancePreference], avoid: farFrom(BALANCE_SCALE, needs.balancePreference) }, match_vi: `anh/chị muốn vợt ${BALANCE_LABELS[needs.balancePreference]}` }, 2);
  }

  if (needs.shaftFlexPreference) {
    apply({ shaft_flex: { prefer: [needs.shaftFlexPreference], avoid: farFrom(FLEX_SCALE, needs.shaftFlexPreference) }, match_vi: `anh/chị muốn ${FLEX_LABELS[needs.shaftFlexPreference]}` }, 2);
  }

  const tier = excluded
    ? TIERS.excluded
    : score > 0
      ? TIERS.fit
      : score < 0
        ? TIERS.caution
        : TIERS.neutral;

  // Gộp nhãn trùng thành một câu. Chỉ nêu đặc điểm thật của cây vợt (nhãn) và đối
  // tượng khách (match_vi); không chép lời khuyên dài của kho kiến thức, để câu trả lời
  // không lẫn lời khuyên với đặc điểm của cây vợt.
  const note = (labels, reasons, joiner) =>
    labels.length
      ? [reasons.length ? `${labels.join(", ")} ${joiner} ${reasons.join(", ")}` : labels.join(", ")]
      : [];

  return {
    tier,
    score,
    excluded,
    fitNotes: note(fitLabels, fitReasons, "— khớp gợi ý cho"),
    cautionNotes: note(cautionLabels, cautionReasons, "chưa hợp với"),
  };
}

// Vợt không có luật (giày, hoặc chưa biết gì về khách): trung lập.
export const NEUTRAL_FIT = Object.freeze({
  tier: TIERS.neutral,
  score: 0,
  excluded: false,
  fitNotes: [],
  cautionNotes: [],
});
