// Chia câu trả lời một khối thành các đoạn ngắn để dễ đọc trong khung chat.
// Câu đã có xuống dòng (đã được dựng có cấu trúc) thì giữ nguyên.

// Hết câu: . ! ? theo sau là khoảng trắng rồi chữ hoa hoặc số. Số thập phân và tiền
// (3.000.000 ₫, 10.9 kg) không có khoảng trắng sau dấu chấm nên không bị tách.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-ZÀ-ỸĐ0-9"“])/u;

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
