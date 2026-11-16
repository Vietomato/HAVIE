import { loadKnowledge } from './knowledgeBase.js';
import { readTraits, describePlayFormatReasons } from './racketRecommendation.js';

const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[đĐ]/gu, 'd').toLowerCase();
const words = (value) => fold(value).match(/[a-z0-9]+/gu) ?? [];
const nameOf = (candidate) => [candidate.name, candidate.variantName].filter(Boolean).join(' — ');

function intentOf(message) {
  const text = fold(message);
  // Keep buying changes, string/tension safety and commerce on their own routes.
  if (/ngan sach|trieu|\d+\s*(?:tr|k|nghin|vnd)\b|\bcuoc\b|\bcang\b|\blbs?\b|\bkg\b|\bmm\b|ton kho|bao nhieu tien|\bgia\b|\bnut\b|\bgay\b|\bmop\b|hu hong|bien dang/u.test(text)) return null;
  const reference = /(?:nhung|cac|may)\s+(?:cay|vot|mau)|(?:cay|vot|mau)\s+(?:nay|do|kia|vua)|o tren|vua goi y|danh sach|\b(?:cay|mau|vot)\s*(?:thu\s*)?[1-5]\b/u.test(text);
  const codes = words(text).filter((word) => /^\d{2,4}[a-z]*$/u.test(word));
  if (!reference && !codes.length) return null;
  const format = /danh don/u.test(text) && /danh doi/u.test(text) ? 'both'
    : /danh don/u.test(text) ? 'singles' : /danh doi/u.test(text) ? 'doubles' : null;
  const all = /thong so|so sanh/u.test(text);
  const weight = all || /trong luong|khoi luong|\b(?:nang|nhe)\b(?!\s*dau)|bao nhieu\s*(?:g|gram)\b/u.test(text);
  const balance = all || /can bang|\bbp\b|nang dau|nhe dau/u.test(text);
  const flex = all || /\bcung\b|\bdeo\b|\bflex\b/u.test(text);
  const fit = /co hop|hop khong|hop ko|hop k\b|de danh|tro luc/u.test(text);
  if (!format && !weight && !balance && !flex && !fit) return null;
  return { text, reference, codes, format, weight, balance, flex, fit,
    plural: /nhung|cac cay|cac mau|cac vot|may cay|may mau|tat ca|danh sach|so sanh/u.test(text) };
}

function resolveCandidates(intent, candidates) {
  const { text, codes } = intent;
  const ordinal = text.match(/\b(?:cay|mau|vot)\s*(?:thu\s*)?([1-5])\b/u)?.[1];
  if (ordinal) return candidates[Number(ordinal) - 1] ? [candidates[Number(ordinal) - 1]] : [];
  const families = ['astrox', 'nanoflare', 'arcsaber', 'axforce', 'halbertec', 'bladex', 'windstorm', 'auraspeed', 'thruster'];
  const requestedFamilies = families.filter((family) => text.includes(family));
  const editions = ['pro', 'tour', 'game', 'play'].filter((edition) => words(text).includes(edition));
  const brands = ['yonex', 'victor', 'mizuno', 'lining'].filter((brand) => words(text).includes(brand));
  const weight = text.match(/\b([2-6](?:\.5)?)\s*u(?:g\d+)?\b/u)?.[1];
  if (codes.length || requestedFamilies.length || editions.length || brands.length || weight) {
    return candidates.filter((candidate) => {
      const nameWords = words(candidate.name);
      const name = fold(candidate.name);
      return (!codes.length || codes.some((code) => nameWords.includes(code))) &&
        (!requestedFamilies.length || requestedFamilies.some((family) => name.includes(family))) &&
        (!editions.length || editions.some((edition) => nameWords.includes(edition))) &&
        (!brands.length || brands.some((brand) => nameWords.includes(brand))) &&
        (!weight || readTraits(candidate).weightClass === `${weight}U`);
    });
  }
  return intent.plural || candidates.length === 1 ? candidates : [];
}

function weightSentences(traits, kb) {
  const group = kb.weight_classes.find((item) => item.code === traits.weightClass);
  if (!traits.weightClass) return ['**Khối lượng:** em chưa có hạng U hoặc khối lượng đã xác minh cho bản này.'];
  const grams = Number.isFinite(traits.averageWeightG)
    ? `, trung bình **${traits.averageWeightG} g** theo hãng`
    : group ? `, khoảng **${group.approx_unstrung_g} g chưa căng cước** (ước lượng phân hạng)` : '';
  return [`**Khối lượng:** bản **${traits.weightClass}**${grams}.`];
}

function explainOne(candidate, intent, needs) {
  const traits = readTraits(candidate);
  const kb = loadKnowledge().racquet;
  const lines = [];
  if (intent.weight) lines.push(...weightSentences(traits, kb));
  if (intent.balance || intent.weight) {
    const balance = kb.balance_types.find((item) => item.id === traits.balanceType);
    if (balance) lines.push(`**Điểm cân bằng:** **${balance.label}**${traits.balanceFromShopText ? ' theo mô tả shop' : ''}; ${balance.strengths[0]}.`);
    else if (intent.balance) lines.push('**Điểm cân bằng:** chưa có phân loại đủ rõ cho bản này.');
    if (intent.weight && balance) lines.push('**Cảm giác cầm:** nặng đầu khác với tổng khối lượng; cần thử thực tế sau khi căng cước và quấn cán.');
  }
  if (intent.flex || intent.fit) {
    const flex = kb.shaft_flex.find((item) => item.id === traits.shaftFlex);
    lines.push(flex ? `**Độ cứng:** **thân ${flex.label}**${traits.flexFromShopText ? ' theo mô tả shop' : ''}. ${flex.advisor_note_vi}`
      : '**Độ cứng:** chưa có dữ liệu đủ rõ cho bản này.');
  }
  if (intent.format || intent.fit) {
    const reasons = describePlayFormatReasons(traits, intent.format ?? needs.playFormat);
    // One main reason per format; a second paragraph of general guidance is
    // unnecessary when the user is asking a short follow-up about each racket.
    const selected = (intent.format ?? needs.playFormat) === 'both'
      ? reasons.filter((reason) => /^(?:Đánh đơn|Đánh đôi):/u.test(reason))
      : reasons.slice(0, 1);
    lines.push(...(selected.length ? selected : reasons.slice(0, 1)).map((reason) =>
      reason.replace(/^(Đánh đơn|Đánh đôi):/u, '**$1:**')));
    if (!reasons.length) lines.push('**Độ hợp:** chưa đủ thông số để kết luận cho lối chơi này.');
  }
  if (needs.skillLevel === 'beginner' && ['stiff', 'extra_stiff'].includes(traits.shaftFlex)) {
    lines.push('**Lưu ý:** anh/chị mới chơi nên thử thân cứng trước khi chọn.');
  }
  return `**${nameOf(candidate)}**\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

// Use bounded, structured recommendation snapshots locally. Never parse product
// facts out of assistant prose or send conversation history to an AI provider.
export function answerRacketFollowup(message, needs, history = []) {
  if (needs.productType === 'shoes') return null;
  const intent = intentOf(message);
  if (!intent) return null;
  const latest = history.slice(-8).reverse().find((item) => item.role === 'assistant' &&
    Array.isArray(item.candidates) && item.candidates.length > 0);
  const candidates = (latest?.candidates ?? []).filter((item) => item?.name &&
    item.productType !== 'shoes').slice(0, 5);
  if (!candidates.length) {
    // Full model names still use live catalog lookup; a shorthand without a
    // preceding recommendation is ambiguous and must not select a random model.
    if (!intent.reference && intent.codes.length) return null;
    return 'Em chưa thấy danh sách vợt vừa gợi ý trong ngữ cảnh gần đây. Anh/chị gửi lại tên đầy đủ và bản trọng lượng của cây cần hỏi nhé?';
  }
  const selected = resolveCandidates(intent, candidates);
  if (!selected.length && !intent.reference && intent.codes.length) return null;
  if (!selected.length || (selected.length > 1 && !intent.plural)) {
    return `Em chưa xác định duy nhất cây anh/chị đang hỏi. Anh/chị cho tên đầy đủ hoặc số thứ tự trong danh sách vừa gợi ý nhé?\n\n${candidates.map((item, index) => `${index + 1}. ${nameOf(item)}`).join('\n')}`;
  }
  const intro = intent.format
    ? 'Các cây vừa gợi ý có những điểm sau để cân nhắc:'
    : null;
  return [intro, ...selected.map((candidate) => explainOne(candidate, intent, needs)),
    intent.format ? '**Lưu ý:** độ hợp còn tùy kỹ thuật và vai trò trên sân; không chia cứng vợt chỉ đánh đơn hoặc chỉ đánh đôi.' : null,
  ].filter(Boolean).join('\n\n');
}
