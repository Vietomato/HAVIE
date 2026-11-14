import React, { useId } from 'react';

// HAVIE Badminton logo: red badge + slanted wordmark. Inline SVG so it needs no font and
// can switch to light lettering on dark backgrounds (footer, login art).
export default function Logo({ onDark = false, className = '' }) {
  const gradientId = 'logo-grad-' + useId().replace(/:/g, '');
  const ink = onDark ? '#FFFFFF' : '#101827';
  const tag = onDark ? '#7DB8FF' : '#087CFF';

  return (
    <svg
      className={('logo ' + className).trim()}
      viewBox="6 8 424 134"
      role="img"
      aria-label="HAVIE Badminton"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F5092E" />
          <stop offset="1" stopColor="#B90825" />
        </linearGradient>
      </defs>
      <g transform="translate(34 15) skewX(-12)">
        <rect width="120" height="120" rx="20" fill={`url(#${gradientId})`} />
        <path
          transform="translate(31 20) scale(0.72)"
          fill="#fff"
          d="M0 0H22V39H56V0H78V100H56V61H22V100H0Z"
        />
        <path d="M30 98H90V106H30Z" fill="#fff" />
        <path d="M30 110H70V114H30Z" fill="#fff" opacity="0.6" />
      </g>
      <g transform="translate(190 30) scale(0.62)">
        <g transform="skewX(-12)" fill={ink}>
          <path d="M0 0H22V39H56V0H78V100H56V61H22V100H0Z" />
          <path
            transform="translate(88 0)"
            fillRule="evenodd"
            d="M31 0H59L90 100H66L60 78H30L24 100H0Z M37 58H53L45 32.3Z"
          />
          <path transform="translate(170 0)" d="M0 0H24L45 68L66 0H90L58 100H32Z" />
          <path transform="translate(270 0)" d="M0 0H22V100H0Z" />
          <path transform="translate(302 0)" d="M0 0H70V20H22V40H62V60H22V80H70V100H0Z" />
        </g>
      </g>
      <text
        x="196"
        y="116"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="17"
        fontWeight="800"
        letterSpacing="9"
        fill={tag}
      >
        BADMINTON
      </text>
    </svg>
  );
}
