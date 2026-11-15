import React from 'react';

// BOTMINTON: bong bóng chat có quả cầu lông bay chéo + vệt tốc độ. Inline SVG, không cần font.
export function BotMark({ size = 36, className = '', tone = 'lime' }) {
  const bubble = tone === 'dark' ? '#101827' : '#DC0A2D';
  const ink = '#FFFFFF';
  const feather = bubble;

  return (
    <svg
      className={('botmark ' + className).trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      {/* Bong bóng chat có đuôi bên trái */}
      <path
        fill={bubble}
        d="M24 3C12.4 3 3 11.6 3 22.2c0 5 2.1 9.5 5.6 12.9L6 44.5l9.3-4.2c2.7 1.1 5.6 1.7 8.7 1.7 11.6 0 21-8.6 21-19.2S35.6 3 24 3Z"
      />
      {/* Vệt tốc độ */}
      <path d="M8 17h9M6 22.5h10M9 28h8" stroke={ink} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
      {/* Quả cầu lông bay chéo lên phải */}
      <g transform="translate(28 21) rotate(40)">
        <path fill={ink} d="M-4.2 6.5L-10 -12Q0 -17.5 10 -12L4.2 6.5Z" />
        <path d="M-5 5L-6.4 -12.6M0 5V-14M5 5L6.4 -12.6" stroke={feather} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M-9 -8Q0 -12.5 9 -8" stroke={feather} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="0" cy="9.5" r="5" fill={ink} />
      </g>
    </svg>
  );
}

// Chữ BOTMINTON nghiêng, đậm, kiểu thể thao.
export function BotWordmark({ className = '' }) {
  return (
    <span className={('botword ' + className).trim()}>
      <span className="botword__bot">BOT</span>
      <span className="botword__minton">MINTON</span>
    </span>
  );
}
