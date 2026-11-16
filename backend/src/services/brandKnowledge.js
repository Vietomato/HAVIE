import { loadKnowledge } from './knowledgeBase.js';

const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[đĐ]/gu, 'd').toLowerCase();

// Brand/series guidance is educational. It never supplies a product spec,
// price, fit score or stringing limit to the catalog/recommendation pipeline.
export function answerBrandQuestion(message, needs = {}, kb = loadKnowledge()) {
  const text = fold(message);
  if (/giay|\bsize\b|\bcuoc\b|\bcang\b|\blbs?\b|\bkg\b|\bmua\b|ngan sach|trieu|\d+\s*(?:tr|k|nghin|vnd)\b|\d+\s+(?:game|pro|tour|play)/u.test(text)) return null;
  const modelText = text.replace(/\b[2-6](?:\.5)?u\b/gu, '');
  if (/\d+[a-z]+/u.test(modelText)) return null;
  const data = kb.racquet.brand_comparison;
  const named = data.brands.filter((brand) => brand.aliases.some((alias) => text.includes(fold(alias))));
  const series = data.brands.flatMap((brand) => brand.series).filter((item) => text.includes(fold(item.name)));
  const general = /cac hang vot|bon hang|4 hang|thuong hieu vot|hang vot nao/u.test(text) ||
    (/cac hang/u.test(text) && (needs.productType === 'rackets' || /vot|do cung|medium|4u/u.test(text))) ||
    (needs.productType === 'rackets' && /chon hang nao/u.test(text));
  const asking = /so sanh|khac|giong|hon|tot|nen chon|dong|luon|tat ca|dung khong|\bvs\b|\bvoi\b|\bva\b|la gi/u.test(text);
  if (!general && (!asking || (!named.length && !series.length))) return null;
  const selected = named.length ? named : series.length
    ? data.brands.filter((brand) => brand.series.some((item) => series.includes(item))) : data.brands;
  const caution = '**Lưu ý:** đây là định hướng dòng, không phải kết luận cho mọi model. Cùng Medium/4U vẫn có thể khác cảm giác; mức căng phải kiểm tra đúng model, biến thể và trình độ.';
  if (/giong/u.test(text) && !/khac|so sanh/u.test(text)) {
    return ['**Điểm giống nhau**', ...data.shared_points_vi.map((point) => `- ${point}`), caution].join('\n\n');
  }
  if (/chon hang nao|chon thuong hieu|thu tu chon/u.test(text)) {
    return ['**Chọn theo độ hợp trước, thương hiệu sau:**',
      ...data.choosing_order_vi.map((point, index) => `${index + 1}. ${point}.`),
      data.beginner_example_vi, caution].join('\n\n');
  }
  const rows = selected.map((brand) => {
    const shown = series.length ? brand.series.filter((item) => series.includes(item)) : brand.series;
    return `- **${brand.name}:** ${shown.map((item) => `**${item.name}** — ${item.direction_vi}`).join('; ')}.`;
  });
  const notes = /luon|tat ca|tot hon|nhe dau|nang dau|de danh/u.test(text)
    ? [data.guardrails_vi[0], ...selected.map((brand) => brand.note_vi)].join(' ') : null;
  return ['Dạ, em so sánh theo **định hướng từng dòng** để anh/chị dễ chọn nhé; không có hãng nào luôn tốt hơn cho mọi người.', rows.join('\n'), notes,
    selected.length > 1 ? 'Các hãng đều có nhiều mức độ dễ chơi; cảm giác còn tùy cước, quấn cán và khả năng người chơi.' : null,
    caution].filter(Boolean).join('\n\n');
}
