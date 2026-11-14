// Thông số dạng thang đo của hãng, ví dụ:
//   "Độ cứng: S○●○○○F (thang hãng)"
//   "Cân bằng: Nặng đầu □■□□□ Nhẹ đầu (thang hãng)"
// được đọc thành { label, left, right, steps, position } để vẽ thanh dễ nhìn.
const SYMBOLS = /[□■○●]{3,9}/u;
const FILLED = /[■●]/u;

const END_WORDS = { S: 'Cứng', F: 'Dẻo', HH: 'Nặng đầu', HL: 'Nhẹ đầu' };
const upperFirst = (text) => text.charAt(0).toLocaleUpperCase('vi') + text.slice(1);
const normalizeEnd = (text) => {
  const word = text.trim();
  return END_WORDS[word.toUpperCase()] ?? upperFirst(word.toLocaleLowerCase('vi'));
};

export function parseSpecScale(spec) {
  const match = String(spec ?? '')
    .replace(/\s*\(thang hãng\)\s*$/iu, '')
    .match(/^([^:]{2,40}):\s*(.+)$/u);
  if (!match) return null;

  const [, label, rest] = match;
  const symbols = rest.match(SYMBOLS);
  if (!symbols) return null;

  const position = [...symbols[0]].findIndex((char) => FILLED.test(char));
  const left = rest.slice(0, symbols.index).trim();
  const right = rest.slice(symbols.index + symbols[0].length).trim();
  if (position < 0 || !left || !right) return null;

  return {
    label: label.trim(),
    left: normalizeEnd(left),
    right: normalizeEnd(right),
    steps: symbols[0].length,
    position,
  };
}

// Diễn giải vị trí bằng chữ để người xem không phải đoán ô nào là "khá" hay "rất".
export function describeScalePosition({ left, right, steps, position }, label = '') {
  const middle = (steps - 1) / 2;
  if (position === middle) return /cân bằng/iu.test(label) ? 'Cân bằng' : 'Trung bình';

  const word = position < middle ? left : right;
  const distance = Math.abs(position - middle);
  const adverb = distance >= middle ? 'Rất' : 'Khá';
  return `${adverb} ${word.toLocaleLowerCase('vi')}`;
}
