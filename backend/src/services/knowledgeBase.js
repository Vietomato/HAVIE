import { readFileSync } from "node:fs";

// Kho kiến thức cầu lông (data/havie_badminton_knowledge.json).
// Đây là DỮ LIỆU THAM KHẢO, không phải chỉ thị: nội dung chỉ được đưa vào
// câu trả lời dưới dạng câu văn do backend dựng từ các trường đã kiểm tra.
// Mỗi mục truy xuất được gắn nhãn `kind` để không trộn lời hãng với
// gợi ý của cửa hàng.

const KB_URL = new URL(
  "../../data/havie_badminton_knowledge.json",
  import.meta.url,
);

const TENSION_LEVELS = ["beginner", "intermediate", "advanced"];
const FLEX_IDS = ["flexible", "medium", "stiff", "extra_stiff"];
const BALANCE_IDS = ["head_heavy", "even", "head_light"];
const WEIGHT_CODES = ["2U", "3U", "4U", "5U", "6U"];

const REQUIRED_STRINGS = [
  "BG65",
  "BG66 Ultimax",
  "BG80",
  "Exbolt 63",
  "Exbolt 65",
  "Exbolt 68",
  "Aerobite",
];

export function validateKnowledge(kb) {
  const errors = [];
  const isArray = Array.isArray;

  if (!kb || typeof kb !== "object") return ["Kho kiến thức không phải object."];

  const sourceIds = new Set((kb.sources ?? []).map((item) => item.id));

  if (!isArray(kb.consultation_topics) || !kb.consultation_topics.length) {
    errors.push("Thiếu consultation_topics.");
  }
  const topicIds = new Set();
  for (const topic of kb.consultation_topics ?? []) {
    if (!topic.id || topicIds.has(topic.id)) errors.push("Chủ đề tư vấn bị thiếu hoặc trùng mã.");
    topicIds.add(topic.id);
    if (!["rackets", "strings", "shoes"].includes(topic.category) ||
        !["advisor", "reference"].includes(topic.kind) ||
        typeof topic.answer_vi !== "string" || !topic.answer_vi.trim() ||
        !isArray(topic.triggers_vi) || !topic.triggers_vi.length ||
        topic.triggers_vi.some((term) => typeof term !== "string" || !term.trim())) {
      errors.push(`Chủ đề tư vấn không hợp lệ: ${topic.id}.`);
    }
    if (!isArray(topic.source_ids) || !topic.source_ids.length ||
        topic.source_ids.some((id) => !sourceIds.has(id))) {
      errors.push(`Chủ đề tư vấn thiếu nguồn hợp lệ: ${topic.id}.`);
    }
  }

  if (sourceIds.size !== (kb.sources ?? []).length) {
    errors.push("Mã nguồn bị trùng.");
  }

  const racquet = kb.racquet ?? {};

  for (const key of ["weight_classes", "balance_types", "shaft_flex", "selection_guidance"]) {
    if (!isArray(racquet[key]) || racquet[key].length === 0) {
      errors.push(`racquet.${key} bị thiếu.`);
    }
  }

  const stringing = kb.stringing ?? {};

  if (!isArray(stringing.models) || stringing.models.length === 0) {
    errors.push("stringing.models bị thiếu.");
  }

  const names = new Set();

  for (const model of stringing.models ?? []) {
    if (typeof model.name !== "string" || !model.name) {
      errors.push("Một cước không có tên.");
      continue;
    }

    if (names.has(model.name)) errors.push(`Cước bị trùng: ${model.name}.`);
    names.add(model.name);

    const gauge = model.gauge_mm;
    const gaugeOk =
      (Number.isFinite(gauge) && gauge > 0) ||
      (Number.isFinite(gauge?.main) && Number.isFinite(gauge?.cross));

    if (!gaugeOk) errors.push(`${model.name}: cỡ cước không hợp lệ.`);

    if (typeof model.advisor_note_vi !== "string" || !model.advisor_note_vi) {
      errors.push(`${model.name}: thiếu nhận xét.`);
    }

    for (const id of model.source_ids ?? []) {
      if (!sourceIds.has(id)) errors.push(`${model.name}: nguồn không tồn tại: ${id}.`);
    }
  }

  for (const name of REQUIRED_STRINGS) {
    if (!names.has(name)) errors.push(`Thiếu cước bắt buộc: ${name}.`);
  }

  // Mã độ cứng, cân bằng và hạng U phải khớp với giá trị catalog/hồ sơ nhu cầu đang dùng.
  const sameSet = (items, expected) =>
    items.length === expected.length && expected.every((id) => items.includes(id));

  if (!sameSet((racquet.shaft_flex ?? []).map((item) => item.id), FLEX_IDS)) {
    errors.push(`Độ cứng phải đúng: ${FLEX_IDS.join(", ")}.`);
  }

  if (!sameSet((racquet.balance_types ?? []).map((item) => item.id), BALANCE_IDS)) {
    errors.push(`Điểm cân bằng phải đúng: ${BALANCE_IDS.join(", ")}.`);
  }

  if (!sameSet((racquet.weight_classes ?? []).map((item) => item.code), WEIGHT_CODES)) {
    errors.push(`Hạng trọng lượng phải đúng: ${WEIGHT_CODES.join(", ")}.`);
  }

  const tiers = stringing.tension_guidance_tiers ?? [];
  const tierIds = new Set(tiers.map((item) => item.id));

  if (tierIds.size !== tiers.length || tiers.length === 0) {
    errors.push("Các bậc căng bị trống hoặc trùng mã.");
  }

  for (const tier of tiers) {
    const [low, high] = tier.suggested_range ?? [];

    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low) {
      errors.push(`Dải căng không hợp lệ: ${tier.id}.`);
    }
  }

  for (const level of TENSION_LEVELS) {
    const mapped = stringing.skill_tension_map?.[level];

    if (!Array.isArray(mapped) || mapped.length === 0) {
      errors.push(`Thiếu bậc căng cho trình độ ${level}.`);
      continue;
    }

    for (const id of mapped) {
      const tier = tiers.find((item) => item.id === id);

      if (!tier) errors.push(`${level}: bậc căng không tồn tại: ${id}.`);
      else if (tier.auto_recommend === false) {
        errors.push(`${level}: không được tự gợi ý bậc ${id}.`);
      }
    }
  }

  if (!Number.isFinite(stringing.units?.kgf_to_lbs) || stringing.units.kgf_to_lbs <= 2) {
    errors.push("Hệ số quy đổi kgf sang lbs không hợp lệ.");
  }

  if (!isArray(stringing.tension_policy) || stringing.tension_policy.length === 0) {
    errors.push("Thiếu quy tắc căng (tension_policy).");
  }

  for (const item of stringing.tension_adjustments ?? []) {
    if (typeof item.advice_vi !== "string" || !item.advice_vi) {
      errors.push(`Điều chỉnh căng ${item.id}: thiếu nội dung.`);
    }

    for (const id of item.source_ids ?? []) {
      if (!sourceIds.has(id)) errors.push(`Điều chỉnh căng ${item.id}: nguồn không tồn tại: ${id}.`);
    }
  }

  for (const id of stringing.source_ids ?? []) {
    if (!sourceIds.has(id)) errors.push(`stringing.source_ids: nguồn không tồn tại: ${id}.`);
  }

  errors.push(...validateSuitabilityRules(racquet.suitability_rules));

  return errors;
}

const WEIGHT_PREFERENCES = [
  "nhẹ", "không quá nhẹ", "nặng", "không quá nặng", "2U", "3U", "3.5U", "4U", "5U", "6U",
];
const PRIORITY_IDS = ["easy_to_use", "attack_support", "fast_handling"];
const PLAY_FORMATS = ["singles", "doubles", "both"];

// Luật đánh giá độ hợp của vợt (racquet.suitability_rules): mọi giá trị phải thuộc
// các mã mà catalog và hồ sơ nhu cầu đang dùng, để luật không im lặng vô hiệu.
function validateSuitabilityRules(rules) {
  if (!rules || typeof rules !== "object") return ["Thiếu racquet.suitability_rules."];

  const errors = [];
  const allowed = {
    weight_classes: [...WEIGHT_CODES, "3.5U"],
    shaft_flex: FLEX_IDS,
    balance: BALANCE_IDS,
  };

  const checkGroup = (path, group) => {
    for (const [dimension, entry] of Object.entries(group ?? {})) {
      if (dimension === "reason_vi" || dimension === "match_vi") continue;

      if (!allowed[dimension]) {
        errors.push(`${path}: nhóm không hợp lệ: ${dimension}.`);
        continue;
      }

      for (const kind of ["prefer", "avoid", "exclude"]) {
        for (const value of entry?.[kind] ?? []) {
          if (!allowed[dimension].includes(value)) {
            errors.push(`${path}.${dimension}.${kind}: giá trị không hợp lệ: ${value}.`);
          }
        }
      }

      const both = (entry?.prefer ?? []).filter((value) => (entry?.avoid ?? []).includes(value));
      if (both.length) errors.push(`${path}.${dimension}: vừa prefer vừa avoid: ${both.join(", ")}.`);
    }
  };

  const keyed = [
    ["by_skill", TENSION_LEVELS],
    ["by_play_format", PLAY_FORMATS],
    ["by_priority", PRIORITY_IDS],
  ];

  for (const [section, ids] of keyed) {
    for (const [id, group] of Object.entries(rules[section] ?? {})) {
      if (!ids.includes(id)) errors.push(`${section}: mã không hợp lệ: ${id}.`);
      checkGroup(`${section}.${id}`, group);
    }
  }

  for (const [id, entry] of Object.entries(rules.weight_preference ?? {})) {
    if (!WEIGHT_PREFERENCES.includes(id)) errors.push(`weight_preference: mã không hợp lệ: ${id}.`);
    checkGroup(`weight_preference.${id}`, { weight_classes: entry });
  }

  return errors;
}

export function getSuitabilityRules(kb = loadKnowledge()) {
  return kb.racquet.suitability_rules;
}

let cached = null;

export function loadKnowledge() {
  if (cached) return cached;

  const kb = JSON.parse(readFileSync(KB_URL, "utf8"));
  const errors = validateKnowledge(kb);

  if (errors.length) {
    throw new Error(`Kho kiến thức không hợp lệ: ${errors.join(" ")}`);
  }

  cached = kb;
  return kb;
}

const normalize = (text) => text.normalize("NFC").toLowerCase();

function has(text, pattern) {
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(text);
}

// Chỉ giải thích khi khách đang HỎI, không giải thích khi khách chỉ nêu sở thích.
const QUESTION =
  /\?|khác|là gì|nghĩa là|so sánh|\bvs\b|nên|thế nào|ra sao|như nào|hơn|được không|ổn không|an toàn không|có được|tư vấn|muốn biết|tìm hiểu|giới thiệu|thông tin|thông số|hãng nào|của ai|đường kính|mô tả|đặc điểm|bao nhiêu|hợp ai|ưu điểm|nhược điểm|tại sao|vì sao|cách chọn|chọn giày|giày nào|chọn vợt|vợt nào/u;

const ASKS_FOR_STRING =
  /(?:tư vấn|chọn|nên chọn|nên dùng|dùng|loại|hợp)(?: giúp mình| cho mình)?(?: loại)?(?: dây)? cước|(?:dây )?cước (?:nào|gì|loại nào|loại gì|nên|hợp)|nên căng cước/u;

const compact = (text) => normalize(text).replace(/[\s\-_.]/gu, "");

const STRING_ALIASES = {
  bg65ti: "BG65 Titanium",
  bg65titanium: "BG65 Titanium",
  bg80p: "BG80 Power",
  bg66um: "BG66 Ultimax",
  bg66f: "BG66 Force",
};

// Tìm tên cước trong tin nhắn, ưu tiên tên dài trước (BG65 Titanium trước BG65).
export function findStringModels(message, kb = loadKnowledge()) {
  let rest = compact(message);

  const candidates = [
    ...kb.stringing.models.flatMap((model) => [model.name, model.official_item_code]
      .filter(Boolean).map((key) => ({ key: compact(key), name: model.name }))),
    ...Object.entries(STRING_ALIASES).map(([key, name]) => ({ key, name })),
  ].sort((left, right) => right.key.length - left.key.length);

  const found = [];

  for (const { key, name } of candidates) {
    const index = rest.indexOf(key);

    if (index === -1) continue;

    // Che phần đã khớp bằng chuỗi cùng độ dài để giữ nguyên vị trí.
    rest = rest.slice(0, index) + "|".repeat(key.length) + rest.slice(index + key.length);

    if (!found.some((item) => item.name === name)) found.push({ name, index });
  }

  // Theo thứ tự khách nhắc tới.
  return found.sort((left, right) => left.index - right.index).map((item) => item.name);
}

export function getStringQuestionIntent(message, kb = loadKnowledge()) {
  const text = normalize(message);
  const models = findStringModels(message, kb);
  const price = has(text, "giá|giá bán|bao nhiêu tiền|bao tiền|báo giá");
  const stock = /tồn kho|tồn hàng|còn hàng|hết hàng|còn bao nhiêu|số lượng|còn mấy|có hàng|stock|inventory/u.test(text);
  const labor = /công căng|phí căng|tiền căng/u.test(text);
  const description = !price && !stock && !labor ||
    /muốn biết|tìm hiểu|giới thiệu|thông tin|mô tả|đặc điểm|đường kính|so sánh|khác|bền|dễ đánh/u.test(text);
  const racketRequest = has(text.replace(/cước vợt/gu, "cước"), "vợt|ngân sách|triệu|size|giày");
  const tension = parseTensionRequest(message, kb) !== null ||
    has(text, "lbs|lb|kg|kgf|ký|mức căng|lực căng") || (has(text, "căng") && !labor);
  const question = QUESTION.test(text) || price || stock || labor ||
    (models.length === 1 && compact(text) === compact(models[0]));
  return {
    models, price, stock, labor, description,
    focused: !racketRequest && !tension && question &&
      (models.length > 0 || ASKS_FOR_STRING.test(text)),
  };
}

export function isKnowledgeOnlyQuestion(message, knowledge) {
  const text = normalize(message);
  if (!QUESTION.test(text)) return false;
  // Concrete buying constraints and named model requests stay in the catalog flow.
  if (/ngân sách|triệu|\d+\s*(?:k(?!g)|nghìn|ngàn|vnd|₫)|giá bán|giá bao nhiêu|bao nhiêu tiền|tối đa|mua|tìm (?:vợt|giày)|gợi ý (?:mẫu|vài|một|sản phẩm)/u.test(text)) return false;
  if (knowledge.tensionRequest) return false;
  return knowledge.snippets.length > 0 || knowledge.topics.includes("tension");
}

const MIN_PLAUSIBLE_LBF = 8;
const MAX_PLAUSIBLE_LBF = 40;
const KGF_WORDS = ["kg", "kgs", "kgf", "ký"];
const TENSION_CONTEXT = /căng|cước|tension|dây|lực căng|mức căng/u;

// Only standalone conversion questions qualify. Mixed requests about racket limits
// or suitability must continue through the existing tension safety checks.
export function getTensionConversion(message, kb = loadKnowledge()) {
  const text = normalize(message).trim();
  const units = "(kgf|kgs|kg|ký|lbs?|pounds?)";
  const amount = "(\\d+(?:[.,]\\d+)?)";
  const ending = "\\s*(?:vậy|nhỉ|ạ|nhé)?[?.!]*$";
  const direct = new RegExp(
    `^(?:căng\\s+)?${amount}\\s*${units}\\s*(?:thì\\s+)?(?:tương đương|bằng|là|ra)\\s*(?:bao nhiêu|mấy)?\\s*${units}${ending}`, "u",
  );
  const convert = new RegExp(
    `^(?:quy đổi|đổi)\\s+${amount}\\s*${units}\\s*(?:ra|sang)\\s*(?:bao nhiêu\\s*)?${units}${ending}`, "u",
  );
  const match = text.match(direct) ?? text.match(convert);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  const fromKgf = KGF_WORDS.includes(match[2]);
  const toKgf = KGF_WORDS.includes(match[3]);
  if (!Number.isFinite(value) || value <= 0 || fromKgf === toKgf) return null;
  const result = fromKgf ? value * kb.stringing.units.kgf_to_lbs : value / kb.stringing.units.kgf_to_lbs;
  return `${value} ${fromKgf ? "kgf" : "lbs"} tương đương khoảng ${Math.round(result * 10) / 10} ${toKgf ? "kgf" : "lbs"}.`;
}

// Đọc mức căng khách nêu.
// - "28 lbs" -> lbs; "11 kg"/"11 ký" -> kgf (chỉ khi đang bàn về căng/cước).
// - "căng 24" không kèm đơn vị -> {ambiguous: true}, phải hỏi lại lbs hay kg.
// Không bao giờ đọc đường kính cước ("0.63mm") thành lực căng.
export function parseTensionRequest(message, kb = loadKnowledge()) {
  const text = normalize(message);
  const factor = kb.stringing.units.kgf_to_lbs;

  const explicit = text.match(
    /(\d+(?:[.,]\d+)?)\s*(lbs?|pounds?|kgf|kgs|kg|ký)(?![\p{L}])/u,
  );

  if (explicit) {
    const value = Number(explicit[1].replace(",", "."));
    const isKgf = KGF_WORDS.includes(explicit[2]);

    if (isKgf && !TENSION_CONTEXT.test(text)) return null;

    const lbf = isKgf ? value * factor : value;

    if (!Number.isFinite(lbf) || lbf <= 0) return null;

    // Ngoài khoảng mức căng vợt thông thường (vd. nhầm đường kính 0.63 mm thành lbs):
    // không dùng làm mức căng để kiểm tra giới hạn.
    if (lbf < MIN_PLAUSIBLE_LBF || lbf > MAX_PLAUSIBLE_LBF) {
      return {
        value,
        unit: isKgf ? "kgf" : "lbs",
        lbf: null,
        ambiguous: false,
        implausible: true,
      };
    }

    return {
      value,
      unit: isKgf ? "kgf" : "lbs",
      lbf: Math.round(lbf * 10) / 10,
      ambiguous: false,
    };
  }

  const bare = text.match(
    /(?:căng|mức căng|lực căng)\s+(?:khoảng\s+|tầm\s+|cỡ\s+|ở\s+|mức\s+|là\s+)?(\d+(?:[.,]\d+)?)(?!\s*(?:mm|g|u|k|tr|triệu|nghìn|ngàn|lần|buổi|[.,]?\d))(?![\p{L}])/u,
  );

  if (bare) {
    const value = Number(bare[1].replace(",", "."));

    if (value >= 8 && value <= 35) {
      return { value, unit: null, lbf: null, ambiguous: true };
    }
  }

  return null;
}

export function parseRequestedTension(message, kb = loadKnowledge()) {
  return parseTensionRequest(message, kb)?.lbf ?? null;
}

const gaugeText = (gauge) =>
  typeof gauge === "number"
    ? `${gauge} mm`
    : `dây dọc ${gauge.main} mm, dây ngang ${gauge.cross} mm`;

function describeString(model) {
  if (model.evidence_type === "manufacturer_sources_conflict") return `${model.name}: ${model.advisor_note_vi}`;
  return `${model.name} (cỡ ${gaugeText(model.gauge_mm)}): ${model.advisor_note_vi}`;
}

const sentence = (text) => (/[.!?]$/u.test(text) ? text : `${text}.`);

const WEIGHT_PATTERN = "[2-6]u";

const SELECTION_KEYWORDS = [
  ["bền, tiết kiệm", "bền|tiết kiệm|ít đứt|rẻ"],
  ["cảm giác đanh, đập cầu", "đanh|đập|smash|chắc"],
  ["bật nhanh, phản tạt", "bật|phản tạt|nhanh"],
  ["giữ cầu, cắt cầu", "giữ cầu|cắt cầu|kiểm soát|lưới"],
  ["mới chơi", "mới chơi|mới bắt đầu|người mới"],
];

function describeSelection(message, kb, needs) {
  const entries = kb.stringing.string_selection_guidance;
  const text = normalize(message);

  let matched = SELECTION_KEYWORDS.filter(([, pattern]) => has(text, pattern))
    .map(([need]) => entries.find((entry) => entry.need === need))
    .filter(Boolean);

  if (!matched.length && needs?.skillLevel === "beginner") {
    matched = entries.filter((entry) => entry.need === "mới chơi");
  }

  if (!matched.length) {
    return sentence(
      "Tùy nhu cầu: " +
        entries.map((entry) => `${entry.need}: ${entry.options[0]}`).join("; "),
    );
  }

  return sentence(
    matched
      .slice(0, 2)
      .map((entry) => `Nếu cần ${entry.need}, có thể xem ${entry.options.join(", ")}`)
      .join("; "),
  );
}

// Trả về các mục kiến thức liên quan (tối đa MAX_SNIPPETS, mỗi mục một câu hoặc hai).
// kind: "reference" (thông số có nguồn hãng trong kho) | "advisor" (gợi ý của cửa hàng).
const MAX_SNIPPETS = 3;

export function retrieveKnowledge(message, needs = null, kb = loadKnowledge()) {
  const text = normalize(message);
  const snippets = [];
  const topics = new Set();

  const add = (topic, kind, body) => {
    topics.add(topic);
    snippets.push({ topic, kind, text: body });
  };

  const stringModels = findStringModels(message, kb);
  const asking = QUESTION.test(text);
  const tensionRequest = parseTensionRequest(message, kb);
  const requestedTensionLbf = tensionRequest?.lbf ?? null;
  const shoeTalk = has(text, "giày|chân bè|bàn chân|size|phom chân");

  if (asking || tensionRequest !== null) {
    let consultation = kb.consultation_topics.filter((item) =>
      (shoeTalk ? item.category === "shoes" : item.category !== "shoes") &&
      item.triggers_vi.some((term) => text.includes(normalize(term))));
    if (consultation.some((item) => item.category === "shoes" && item.id !== "shoe_fit")) {
      consultation = consultation.filter((item) => item.id !== "shoe_fit");
    }
    for (const item of consultation.slice(0, 2)) add(item.id, item.kind, item.answer_vi);
  }

  if (stringModels.length && asking) {
    const models = stringModels
      .slice(0, 2)
      .map((name) => kb.stringing.models.find((item) => item.name === name));

    add("string", "reference", models.map((model) => sentence(models.length === 1 && model.evidence_type !== "manufacturer_sources_conflict"
      ? `${model.name} của ${model.brand} có đường kính ${gaugeText(model.gauge_mm)}. ${model.advisor_note_vi}`
      : describeString(model))).join(" "));
  } else if (!stringModels.length && asking && ASKS_FOR_STRING.test(text)) {
    // Chỉ khi khách thật sự hỏi chọn cước; "chưa gồm cước" hay "tư vấn vợt" thì không.
    add("string_choice", "advisor", describeSelection(message, kb, needs));
  }

  const tensionTalk =
    tensionRequest !== null ||
    has(text, "căng|mức căng|lực căng|lbs|lb");

  if (tensionTalk && (asking || tensionRequest !== null)) {
    topics.add("tension");
  }

  // Chỉnh mức căng theo cảm giác đánh; chỉ khi khách đang bàn về căng/cước.
  if (tensionTalk) {
    const rules = new Map(
      kb.stringing.tension_adjustments.map((item) => [item.id, item.advice_vi]),
    );

    const adjustments = [
      ["pain_or_new", "đau cổ tay|đau khuỷu|đau tay|chấn thương"],
      ["off_center", "lệch tâm|hụt|không tới cuối sân|cầu không tới|không tới được cuối sân"],
      ["solid_contact", "trúng tâm|phản hồi chắc|chắc hơn|sắc hơn"],
      ["no_style_rule", "đánh đôi|đánh đơn|nặng đầu|nhẹ đầu"],
    ]
      .filter(([id, pattern]) => rules.has(id) && has(text, pattern) && (asking || id !== "no_style_rule"))
      .map(([id]) => rules.get(id));

    if (adjustments.length) {
      add("tension_feel", "advisor", adjustments.slice(0, 2).join(" "));
    }
  }

  if (asking && !shoeTalk) {
    const balance = kb.racquet.balance_types.filter((item) =>
      (item.id === "head_heavy" && has(text, "nặng đầu")) ||
      (item.id === "head_light" && has(text, "nhẹ đầu")) ||
      (item.id === "even" && has(text, "cân bằng")),
    );

    if (balance.length && !topics.has("balance_point") && !topics.has("racket_power")) {
      add(
        "balance",
        "advisor",
        balance
          .map((item) =>
            sentence(
              `Vợt ${item.label}: ưu điểm là ${item.strengths.join(", ")}; cần lưu ý ${item.tradeoffs.join(", ")}`,
            ),
          )
          .join(" "),
      );
    }

    const flexIds = [
      ["flexible", "dẻo|mềm"],
      ["medium", "trung bình"],
      ["stiff", "cứng"],
      ["extra_stiff", "rất cứng|extra stiff"],
    ];

    const flexes = flexIds
      .filter(([id, pattern]) => {
        if (id === "stiff" && has(text, "rất cứng|extra stiff")) return false;
        return has(text, pattern);
      })
      .map(([id]) => kb.racquet.shaft_flex.find((item) => item.id === id))
      .filter(Boolean);

    if (flexes.length && !topics.has("balance")) {
      add(
        "flex",
        "advisor",
        flexes
          .slice(0, 2)
          .map((item) => sentence(`Thân ${item.label}: ${item.advisor_note_vi.replace(/\.$/u, "")}`))
          .join(" "),
      );
    }

    const weight = text.match(new RegExp(`(^|[^\\p{L}\\p{N}])(${WEIGHT_PATTERN})(?=$|[^\\p{L}\\p{N}])`, "u"));

    if (weight) {
      const code = weight[2].toUpperCase();
      const item = kb.racquet.weight_classes.find((entry) => entry.code === code);

      if (item) {
        add(
          "weight",
          "reference",
          sentence(
            `${item.code} khoảng ${item.approx_unstrung_g} g khi chưa căng cước, ${item.note}`,
          ),
        );
      }
    }

    if (
      !snippets.length &&
      has(text, "chọn vợt|nên chọn|vợt nào|vợt gì|loại vợt|vợt phù hợp|vợt hợp")
    ) {
      const profile =
        needs?.skillLevel === "beginner" || has(text, "người mới|mới chơi|mới bắt đầu")
          ? "beginner"
          : needs?.playFormat === "doubles"
            ? "doubles_fast"
            : has(text, "tấn công|đập|công") ? "attack" : "all_round";

      const guidance = kb.racquet.selection_guidance.find((item) => item.profile === profile);

      if (guidance) add("selection", "advisor", sentence(guidance.suggestion_vi));
    }
  }

  return {
    topics: [...topics],
    snippets: snippets.slice(0, MAX_SNIPPETS),
    stringModels,
    requestedTensionLbf,
    tensionRequest,
    heuristicNotice: snippets.some((item) => item.kind === "advisor")
      ? "Đây là gợi ý tham khảo, anh/chị nên thử thực tế."
      : null,
    stringNotice: stringModels.length || topics.has("string_choice")
      ? "Thông tin kỹ thuật cước Yonex là tham khảo; giá và tình trạng hàng cần tra catalog hiện tại, " +
        "và loại cước không quyết định mức căng tối đa của vợt."
      : null,
  };
}

// Dải căng tham khảo theo trình độ: khung giáo dục của cửa hàng, KHÔNG phải mức
// của hãng. Trình độ ghép sang một hoặc hai bậc liền nhau; lấy cả đoạn.
export function getTensionHeuristic(skillLevel, kb = loadKnowledge()) {
  const ids = kb.stringing.skill_tension_map[skillLevel];

  if (!ids) return null;

  const tiers = ids
    .map((id) => kb.stringing.tension_guidance_tiers.find((item) => item.id === id))
    .filter(Boolean);

  if (!tiers.length) return null;

  return {
    lowLbf: Math.min(...tiers.map((item) => item.suggested_range[0])),
    highLbf: Math.max(...tiers.map((item) => item.suggested_range[1])),
  };
}
