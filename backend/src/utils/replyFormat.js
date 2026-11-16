// Chia câu trả lời một khối thành các đoạn ngắn để dễ đọc trong khung chat.
// Câu đã có xuống dòng (đã được dựng có cấu trúc) thì giữ nguyên.

// Hết câu: . ! ? theo sau là khoảng trắng rồi chữ hoa hoặc số. Số thập phân và tiền
// (3.000.000 ₫, 10.9 kg) không có khoảng trắng sau dấu chấm nên không bị tách.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-ZÀ-ỸĐ0-9"“])/u;

// Add one courteous opening to terse deterministic answers. Existing greetings
// and first-person/customer address stay intact; facts and units are unchanged.
export function courteousReply(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value || /^(?:Dạ|Vâng|Chào|Xin chào|Anh\/chị|Em\b|Nếu anh\/chị)/iu.test(value)) return value;
  if (/^(?:\*\*|\d+\.\s)/u.test(value)) return `Dạ, em gửi anh/chị thông tin như sau ạ:\n\n${value}`;
  return `Dạ, ${value}`;
}

export function formatReplyParagraphs(text, { sentencesPerParagraph = 2 } = {}) {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value || value.includes("\n")) return value;

  const sentences = value.split(SENTENCE_BREAK).filter(Boolean);
  if (sentences.length <= sentencesPerParagraph) return value;

  // Câu hỏi đứng riêng ở đoạn cuối để khách thấy ngay mình cần trả lời gì.
  const last = sentences.at(-1);
  const closingQuestion = /\?$/u.test(last) ? sentences.pop() : null;

  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(index, index + sentencesPerParagraph).join(" "));
  }
  if (closingQuestion) paragraphs.push(closingQuestion);

  return paragraphs.join("\n\n");
}
