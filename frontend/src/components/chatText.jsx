import React from 'react';

// In đậm các phần quan trọng trong tin nhắn của bot: tên mẫu, nhãn từng mục, giá,
// mức căng (lbs/kg) và lưu ý "chưa gồm tiền căng cước". Chỉ đổi cách hiển thị, không đổi nội dung.
const IMPORTANT = new RegExp(
  [
    // Explicit emphasis from the bot; rendered as React text, never as HTML.
    '(\\*\\*[^*\\n]+\\*\\*)',
    // Dòng tên mẫu: "1. Vợt cầu lông Yonex ..."
    '^(\\d+\\.\\s.+)$',
    // Nhãn đầu dòng của từng mẫu
    '^((?:Giá|Thông số|Vì sao phù hợp|Đặc tính|Lưu ý):)',
    // Giá tiền: 2.889.000 ₫
    '(\\d{1,3}(?:\\.\\d{3})+\\s?[₫đ])',
    // Lưu ý chưa gồm tiền căng cước
    '(chưa gồm tiền căng cước)',
    // Mức căng: 24 lbs, 24-28 lbs, 10.9 kg
    '(\\d+(?:[.,]\\d+)?(?:\\s?-\\s?\\d+(?:[.,]\\d+)?)?\\s?(?:lbs|kg)\\b)',
    '(\\b[2-6](?:\\.5)?U\\b)',
  ].join('|'),
  'gimu',
);

export function BotText({ text }) {
  const content = String(text ?? '');
  const parts = [];
  let last = 0;

  for (const match of content.matchAll(IMPORTANT)) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    const value = match[0];
    parts.push(<strong key={match.index}>{value.startsWith('**') ? value.slice(2, -2) : value}</strong>);
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));

  return <>{parts}</>;
}

function ProseBlock({ lines }) {
  const groups = [];
  for (const line of lines) {
    const bullet = line.match(/^\s*[-•]\s+(.+)$/u);
    const type = bullet ? 'list' : 'paragraph';
    if (groups.at(-1)?.type !== type) groups.push({ type, lines: [] });
    groups.at(-1).lines.push(bullet ? bullet[1] : line);
  }
  return (
    <div className="botmsg__section">
      {groups.map((group, index) => group.type === 'list'
        ? <ul key={index} className="botmsg__list">
            {group.lines.map((line, item) => <li key={item}><BotText text={line} /></li>)}
          </ul>
        : <p key={index} className="botmsg__p"><BotText text={group.lines.join('\n')} /></p>)}
    </div>
  );
}

const ROW = /^(Giá|Thông số|Vì sao phù hợp|Đặc tính|Lưu ý):\s*(.*)$/u;
const TITLE = /^(\d+)\.\s+(.+)$/u;
const NOTICE = /\s*\(?\s*chưa gồm tiền căng cước\s*\)?\.?\s*$/iu;

// Tin nhắn của bot: mỗi mẫu vợt thành một thẻ gọn (số thứ tự, tên, từng mục), các đoạn còn lại giữ nguyên.
function RacketCard({ lines }) {
  const [, number, name] = lines[0].match(TITLE);
  const rows = lines.slice(1).map((line) => line.match(ROW)).filter(Boolean);

  return (
    <div className="botcard">
      <div className="botcard__head">
        <span className="botcard__num">{number}</span>
        <strong className="botcard__name">{name}</strong>
      </div>
      {rows.map(([, label, value]) => {
        if (label === 'Giá') {
          const hasNotice = NOTICE.test(value);
          const price = value.replace(NOTICE, '').replace(/\s*\(\s*\)\s*$/u, '');
          return (
            <div key={label} className="botcard__row botcard__row--price">
              <span className="botcard__label">Giá</span>
              <span className="botcard__value">
                <strong className="botcard__price">{price}</strong>
                {hasNotice && <span className="botcard__chip">Chưa gồm tiền căng cước</span>}
              </span>
            </div>
          );
        }
        return (
          <div
            key={label}
            className={`botcard__row${label === 'Lưu ý' ? ' botcard__row--warn' : ''}`}
          >
            <span className="botcard__label">{label}</span>
            <span className="botcard__value"><BotText text={value} /></span>
          </div>
        );
      })}
    </div>
  );
}

export function BotMessage({ text }) {
  const blocks = String(text ?? '').split(/\n{2,}/u).filter((block) => block.trim());

  return (
    <div className="botmsg">
      {blocks.map((block, index) => {
        const lines = block.split('\n');
        const isCard = TITLE.test(lines[0]) && lines.slice(1).some((line) => ROW.test(line));
        return isCard
          ? <RacketCard key={index} lines={lines} />
          : <ProseBlock key={index} lines={lines} />;
      })}
    </div>
  );
}
