import { loadKnowledge } from './knowledgeBase.js';

const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[đĐ]/gu, 'd').toLowerCase();

export function answerPlayerEquipmentQuestion(message, kb = loadKnowledge()) {
  const text = fold(message);
  const guide = kb.racquet.player_equipment_guidance;
  const painText = text.replace(/(?:khong con|khong|chua|het)\s+(?:bi\s+)?dau(?:\s+(?:co tay|khuyu tay|vai|tay))?/gu, '');
  const painMention = /dau (?:co tay|khuyu|vai|tay)|yeu tay|te tay/u.test(painText);
  const personalPain = painMention && (/toi|minh|em|dang|bi dau|dau tang|yeu tay/u.test(painText) ||
    !/co gay|nguy co|co the gay|de bi/u.test(painText));
  const risk = /chan thuong|qua tai|gay dau|gay hai|hai co tay|hai vai/u.test(text);
  if (personalPain) {
    return ['Dạ, nếu anh/chị đang đau thì em ưu tiên việc giảm tải trước nhé.',
      `- **Trước mắt:** ${guide.pain_action_vi}`,
      `- **Khi cần khám:** ${guide.clinical_review_vi}`,
      '- **Về thiết bị:** em chưa chốt cây vợt hay số kg để xử lý đau; không thể xác định nguyên nhân chỉ qua tin nhắn.',
    ].join('\n\n');
  }
  if (risk && /vot|cuoc|cang|kg|tay|vai|khuyu/u.test(text)) {
    return ['Dạ, có thể góp phần gây quá tải nếu bộ vợt–cước không vừa sức, nhưng không thể kết luận chỉ từ số kg ạ.',
      `- **Nguy cơ:** ${guide.risk_vi}`,
      `- **Chưa đau:** ${guide.not_painful_vi.replace(/^Nếu chỉ thấy khó đánh, chưa đau:\s*/u, '')}`,
      `- **Đã đau:** ${guide.pain_action_vi.replace(/^Nếu đang đau:\s*/u, '')}`,
      `- **Cần đánh giá:** ${guide.clinical_review_vi}`,
    ].join('\n\n');
  }
  const modelText = text.replace(/\b[2-6](?:\.5)?u\b|\b\d+(?:[.,]\d+)?\s*(?:kgf?|lbs?|ky|g)\b/gu, '');
  if (/\b\d{2,4}(?:zz|[a-z]\d*)\b|\d+\s+(?:game|pro|tour|play)/u.test(modelText)) return null;
  const group = /phong trao|chuyen nghiep|van dong vien|\bvdv\b|than tuong/u.test(text);
  const educational = /khac|so sanh|bat chuoc|giong|tai sao|vi sao|chon|nen|cang|kg|vot|cuoc|day/u.test(text);
  if (!group || !educational || /\bmua\b|ngan sach|trieu|\d+\s*(?:tr|k|nghin|vnd)\b/u.test(text)) return null;
  const strings = /cuoc|day|cang|kg|lbs/u.test(text);
  const racket = /vot|do cung|nang dau|trong luong/u.test(text) || !strings;
  if (/bat chuoc|than tuong|tieng cau|cang cao|kg cao/u.test(text)) {
    return ['Dạ, anh/chị không nên chọn theo vợt hoặc số kg của thần tượng thôi ạ.',
      `- **Về lực đánh:** ${guide.tension_myth_vi}`,
      `- **Về độ hợp:** ${guide.skill_distinction_vi}`,
      `- **Mức căng:** ${guide.no_universal_kg_vi}`,
    ].join('\n\n');
  }
  return ['Dạ, khác biệt chính là **chọn vừa sức** và **tối ưu cho yêu cầu thi đấu**, không phải chuyên nghiệp thì luôn dùng đồ cứng hoặc kg cao ạ.',
    ...(racket ? [`- **Vợt phong trào:** ${guide.recreational_racket_vi}`, `- **Vợt chuyên nghiệp:** ${guide.professional_racket_vi}`] : []),
    ...(strings ? [`- **Cước phong trào:** ${guide.recreational_strings_vi}`, `- **Cước chuyên nghiệp:** ${guide.professional_strings_vi}`,
      `- **Cách so sánh:** ${guide.setup_consistency_vi}`] : []),
    `**Lưu ý:** ${guide.skill_distinction_vi}${strings ? ` ${guide.no_universal_kg_vi}` : ''}`,
  ].join('\n\n');
}
