import { loadKnowledge } from './knowledgeBase.js';

const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[đĐ]/gu, 'd').toLowerCase();

const PRODUCT_REQUEST = /\bmua\b|chon\s+(?:vot|giay|san pham)|goi y.*(?:vot|giay|san pham)|tu van.*(?:vot|giay|san pham)|thu vot|doi vot|thong so|bao gia/u;

export function isAthleteAdviceRequest(message) {
  const text = fold(message);
  return !PRODUCT_REQUEST.test(text) &&
    /(?:nhac lai|noi lai|lap lai|khuyen lai).*loi khuyen|loi khuyen.*(?:vdv|van dong vien|axelsen)|(?:vdv|van dong vien|axelsen).*(?:khuyen|noi gi|nhan nhu)/u.test(text);
}

function historyAdviceIds(history, tips) {
  return tips.filter((tip) => history.some((item) => item.role === 'assistant' &&
    fold(item.content).includes(fold(tip.athlete)) &&
    fold(item.content).includes(fold(tip.paraphrase_vi)))).map((tip) => tip.id);
}

// Check persisted messages across the entire owned conversation, independently
// of the last eight context messages. Return only IDs/timestamps, not old prose.
export async function getAthleteAdviceUsage(database, conversationId, kb = loadKnowledge()) {
  const matches = await Promise.all(kb.racquet.athlete_advice.map(async (tip) => ({
    id: tip.id,
    message: await database.advisorMessage.findFirst({
      where: { conversationId, role: 'assistant', AND: [
        { content: { contains: tip.athlete, mode: 'insensitive' } },
        { content: { contains: tip.paraphrase_vi, mode: 'insensitive' } },
        { OR: [{ content: { contains: 'Lời khuyên VĐV' } },
          { content: { contains: 'Lời khuyên từ vận động viên' } }] },
      ] },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true },
    }),
  })));
  const used = matches.filter((match) => match.message);
  used.sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
  return { usedAthleteAdviceIds: used.map((item) => item.id), lastAthleteAdviceId: used[0]?.id ?? null };
}

export function answerTrainingQuestion(message, kb = loadKnowledge()) {
  const text = fold(message);
  if (/dau (?:co tay|khuyu|vai|tay)|bi dau|dang dau|chan thuong|khung.*nut|vot.*nut|nut.*khung|ngan sach|trieu|\bmua\b|\d+\s*(?:kg|lbs)/u.test(text)) return null;
  const guide = kb.racquet.training_guidance;
  if (/thu vot|doi vot/u.test(text) && /cach|the nao|nen|can/u.test(text)) {
    return ['Dạ, anh/chị nên đánh thử theo cùng một điều kiện để nhận ra khác biệt nhé.',
      `- **Đánh thử:** ${guide.racket_trial_vi}`,
      '- **Đánh giá:** cây vợt có giúp anh/chị thực hiện động tác đúng và ổn định cả buổi không? Nếu phải gồng hoặc liên tục chậm vợt, nên xem lại độ hợp.',
    ].join('\n\n');
  }
  if (/doi cuoc|thu day|thu cuoc|toc do vung.*(?:kg|cang)|(?:kg|cang).*toc do vung/u.test(text)) {
    return ['Dạ, mức căng cần phối hợp với tốc độ vung và khả năng tiếp cầu của anh/chị ạ.',
      `- **Cách thử:** ${guide.string_trial_vi}`,
      '- **Đừng tăng chỉ vì tiếng cầu:** tiếng nổ lớn không chứng minh mức căng phù hợp, và không lấy số kg của VĐV làm chuẩn.',
    ].join('\n\n');
  }
  const basics = /ky thuat co ban|cam vot|doi grip|bo phap|di chuyen|jump smash|ve vi tri chuan bi/u.test(text);
  const session = /buoi tap|chi danh tran|toan danh tran|tap gi truoc|lich tap|nen tap gi/u.test(text);
  if (!basics && !session) return null;
  if (!/cach|lam sao|nen|tap|hoc|can|truoc|khong|gi/u.test(text)) return null;
  return [
    'Dạ, anh/chị nên tập nền tảng chắc và áp dụng dần vào trận đấu nhé.',
    basics ? `- **Nền tảng:** ${guide.fundamentals_vi}` : null,
    session ? `- **Một buổi tập có thể gồm:** ${guide.session_steps_vi.join(' → ')}.` : null,
    '- **Cách đánh giá:** tập từng mục tiêu, nhờ HLV quan sát và sửa thay vì chỉ cố đánh mạnh hoặc đẹp mắt.',
    `- **Lượng tập:** ${guide.recovery_vi}`,
  ].filter(Boolean).join('\n\n');
}

// A source-backed paraphrase is appended after the factual/safety response.
// It never rewrites specs, supplies a kg value, or becomes treatment advice.
export function professionalTip(message, result, kb = loadKnowledge(), {
  history = [], usedAthleteAdviceIds = [], lastAthleteAdviceId = null,
} = {}) {
  if (result.action !== 'answer_knowledge') return null;
  if (/^(?:Dạ,\s*)?\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?\s*(?:lbs|kgf?)\s+(?:khoảng|tương đương|≈)/u.test(result.reply) || /^Quy đổi nhanh/u.test(result.reply)) return null;
  if (/khớp nhiều sản phẩm|chưa xác định|chưa thấy danh sách|chưa tra được|không thể kết nối|Lời khuyên (?:VĐV|từ vận động viên)/u.test(result.reply) || /\?\s*$/u.test(result.reply)) return null;
  const text = fold(message);
  if (/mat khau|token|api key|bi mat|ton kho|nha cung cap/u.test(text)) return null;
  if (/bien dang|dau du doi|khong cu dong|gay xuong/u.test(text)) return null;
  // Unit conversion and definitions remain short, deterministic utility replies.
  if (/bao nhieu kg|may ky|sang lbs|doi .*ra|quy doi|bang quy doi|lbs la gi|kg la gi/u.test(text) &&
      !/an toan|duoc khong|dau|chan thuong/u.test(text)) return null;
  const health = /dau co tay|dau vai|dau khuyu|chan thuong|qua tai|hoi phuc|nghi ngoi/u.test(text);
  const technique = /ky thuat|cam vot|doi grip|bo phap|di chuyen|jump smash|buoi tap|nen tap gi|chi danh tran/u.test(text);
  if (!health && PRODUCT_REQUEST.test(text)) return null;
  const tension = /cang|so kg|so ky|muc kg|muc cang/u.test(text) && !/giay/u.test(text);
  const repeatRequested = isAthleteAdviceRequest(message);
  if (!health && !technique && !tension && !repeatRequested) return null;
  const seen = new Set([...usedAthleteAdviceIds, ...historyAdviceIds(history, kb.racquet.athlete_advice)]);
  const id = health ? 'axelsen_recovery' : technique ? 'axelsen_basics' : tension ? 'axelsen_foundation'
    : lastAthleteAdviceId ?? [...seen].at(-1) ?? 'axelsen_basics';
  if (seen.has(id) && !repeatRequested) return null;
  const tip = kb.racquet.athlete_advice.find((item) => item.id === id);
  if (!tip) return null;
  const advice = tip.paraphrase_vi.charAt(0).toLocaleLowerCase('vi') + tip.paraphrase_vi.slice(1);
  // Display a natural paraphrase without bibliography; provenance remains in KB.
  return `**Lời khuyên từ vận động viên chuyên nghiệp nổi tiếng:** ${tip.athlete} nhấn mạnh việc ${advice}${id === 'axelsen_recovery' ? ' Đây là lời khuyên tập luyện, không phải hướng dẫn điều trị.' : ''}`;
}
