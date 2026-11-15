// Quy ước đổi đơn vị lực căng cước vợt cầu lông giữa lbs và kg.
//
// Quy ước của HAVIE (khớp kho kiến thức stringing.units):
//  - Lực căng đo bằng lbs (pound-force) hoặc kgf (kilogram-force).
//  - Khách và thợ căng ở Việt Nam nói "ký" / "kg" khi bàn về căng vợt là kgf.
//  - 1 kgf = 2.20462 lbs, 1 lbs = 0.45359 kgf.
//  - Làm tròn 1 chữ số thập phân; số thập phân viết bằng dấu chấm như phần còn lại của bot.
//  - Khi nêu một mức căng, luôn nêu cả hai đơn vị: "24 lbs (khoảng 10.9 kg)".
//  - Đường kính cước (mm) không phải lực căng nên không đổi sang lbs/kg.

export const KGF_TO_LBS = 2.20462;

// Khoảng mức căng vợt thông thường, để không đổi nhầm các số ngoài vùng này.
export const MIN_TENSION_LBS = 14;
export const MAX_TENSION_LBS = 40;

const round1 = (value) => Math.round(value * 10) / 10;

// 24 -> "24", 24.5 -> "24.5", 24.04 -> "24".
const plain = (value) => {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const lbsToKg = (lbs) => round1(lbs / KGF_TO_LBS);
export const kgToLbs = (kg) => round1(kg * KGF_TO_LBS);

// "24 lbs (khoảng 10.9 kg)"
export function formatLbsWithKg(lbs) {
  return `${plain(lbs)} lbs (khoảng ${plain(lbsToKg(lbs))} kg)`;
}

// "24-28 lbs (khoảng 10.9-12.7 kg)"; hai đầu bằng nhau thì thành một mức.
export function formatLbsRangeWithKg(low, high) {
  if (round1(low) === round1(high)) return formatLbsWithKg(low);
  return `${plain(low)}-${plain(high)} lbs (khoảng ${plain(lbsToKg(low))}-${plain(lbsToKg(high))} kg)`;
}

// Bảng tra nhanh các mức căng thường gặp, tính từ cùng hệ số.
export function buildConversionTable(from = 20, to = 32, step = 2) {
  const rows = [];
  for (let lbs = from; lbs <= to; lbs += step) rows.push({ lbs, kg: lbsToKg(lbs) });
  return rows;
}

const KG_UNITS = ["kg", "kgs", "kgf", "ký", "kí", "ky", "ki"];
const LBS_UNITS = ["lb", "lbs", "pound", "pounds"];
const UNIT_PATTERN = "(kgf|kgs|kg|ký|kí|ky|ki|lbs|lb|pounds?)";
const NUMBER = "(\\d+(?:[.,]\\d+)?)";
const toNumber = (text) => Number(text.replace(",", "."));
const isKg = (unit) => KG_UNITS.includes(unit);

export const normalizeTensionMessage = (message) =>
  String(message ?? "").normalize("NFC")
    .replace(/\bIbs\b/gu, "lbs")
    .toLowerCase()
    .replace(/(\d)\s*ibs\b/gu, "$1 lbs")
    .replace(/\s+/gu, " ").trim();

const fold = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");

// Only infer an omitted unit from the immediately preceding user conversion.
// Shopping amounts, racket weights and string gauges never establish a unit.
export function resolveTensionFollowup(message, history = []) {
  const text = fold(normalizeTensionMessage(message));
  const amount = text.match(/^(?:con\s+)?(\d+(?:[.,]\d+)?)\s*(?:thi sao|thi sao a|thi bao nhieu|nhi)?\s*[?.!]*$/u)?.[1];
  if (!amount) return message;
  const recent = history.slice(-8);
  const previousIndex = recent.findLastIndex((item) => item.role === "user");
  if (previousIndex < 0) return message;
  const previous = resolveTensionFollowup(recent[previousIndex].content, recent.slice(0, previousIndex));
  if (!answerTensionConversion(previous)) return message;
  const source = fold(normalizeTensionMessage(previous)).match(new RegExp(`${NUMBER}\\s*${UNIT_PATTERN}`, "u"));
  if (!source) return message;
  return `${amount} ${source[2]} bao nhiêu ${isKg(source[2]) ? "lbs" : "kg"}`;
}

export function answerTensionUnitDefinition(message) {
  const text = fold(normalizeTensionMessage(message));
  if (!/^(?:(?:cho minh hoi|cho hoi)\s+)?(?:lbs?|pounds?)\s+(?:la gi|nghia la gi|la don vi gi|la sao)\s*[?.!]*$/u.test(text)) return null;
  return 'Lbs (pound-force) là đơn vị lực căng cước. 1 kg lực (kgf, thường gọi là "ký") tương đương khoảng 2.2 lbs; ví dụ 25 lbs khoảng 11.3 kg.';
}

const TABLE_REQUEST = /bảng\s+(?:quy\s*đổi|đổi)|quy\s*đổi\s+(?:lbs|kg|ký)\s*(?:sang|ra)\s*(?:lbs|kg|ký)\s*(?:là\s*)?(?:gì|thế nào)?\s*$/u;

// Câu hỏi đổi đơn vị đứng riêng, kể cả khoảng ("24-28 lbs") và cách nói ngắn
// ("26lbs mấy ký", "26 lbs = ? kg"). Trả về câu trả lời hoặc null nếu không phải
// câu hỏi quy đổi thuần.
export function answerTensionConversion(message) {
  const text = fold(normalizeTensionMessage(message));

  if (new RegExp(fold(TABLE_REQUEST.source), "u").test(text) && /(?:lbs|kg|ky)/u.test(text) && !/\d/u.test(text)) {
    const rows = buildConversionTable()
      .map(({ lbs, kg }) => `${lbs} lbs ≈ ${plain(kg)} kg`)
      .join("\n");
    return `Quy đổi nhanh (1 kg ≈ 2.2 lbs):\n${rows}\nKhi nói về căng vợt, "ký" thường là kg lực (kgf).`;
  }

  const ending = "\\s*(?:vậy|nhỉ|ạ|nhé|không)?\\s*[?.!]*$";
  const connector =
    "(?:thì\\s+)?(?:=|→|->|tương đương|bằng|là|ra|sang|đổi ra|đổi sang|quy ra|quy đổi ra|bao nhiêu|mấy)?\\s*(?:khoảng\\s*)?(?:bao nhiêu|mấy)?\\s*[?]?\\s*";
  const pattern = new RegExp(
    fold(`^(?:quy đổi|đổi|cho mình hỏi|cho hỏi)?\\s*(?:căng\\s+)?${NUMBER}(?:\\s*[-–~]\\s*${NUMBER})?\\s*${UNIT_PATTERN}\\s*${connector}${UNIT_PATTERN}${ending}`),
    "u",
  );
  const match = text.match(pattern);
  if (!match) return null;

  const [, firstText, secondText, fromUnit, toUnit] = match;
  if (isKg(fromUnit) === isKg(toUnit)) return null;

  const first = toNumber(firstText);
  const second = secondText ? toNumber(secondText) : null;
  if (!Number.isFinite(first) || first <= 0 || (second !== null && second < first)) return null;

  const fromKg = isKg(fromUnit);
  const convert = fromKg ? kgToLbs : lbsToKg;
  const fromLabel = fromKg ? "kg" : "lbs";
  const toLabel = fromKg ? "lbs" : "kg";
  const source = second === null ? `${plain(first)} ${fromLabel}` : `${plain(first)}-${plain(second)} ${fromLabel}`;
  const result =
    second === null ? `${plain(convert(first))} ${toLabel}` : `${plain(convert(first))}-${plain(convert(second))} ${toLabel}`;

  // Số nằm ngoài vùng căng vợt thường gặp: vẫn đổi, nhưng nhắc kiểm tra đơn vị.
  const lbs = fromKg ? kgToLbs(first) : first;
  const unusual = lbs < MIN_TENSION_LBS || lbs > MAX_TENSION_LBS;

  return (
    `${source} khoảng ${result}.` +
    (unusual
      ? " Mức này nằm ngoài khoảng căng vợt thường gặp (khoảng 18-32 lbs), anh/chị kiểm tra lại đơn vị giúp em nhé."
      : "")
  );
}

export const TENSION_UNIT_WORDS = { kg: KG_UNITS, lbs: LBS_UNITS };
