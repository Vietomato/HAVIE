import React from 'react';

// HAVIE Badminton logo: slanted wordmark whose "I" is a shuttlecock. Inline SVG so it needs
// no font and can switch to light lettering on dark backgrounds (footer, login art).
export default function Logo({ onDark = false, className = '' }) {
  const ink = onDark ? '#FFFFFF' : '#101827';
  const tag = onDark ? '#7DB8FF' : '#087CFF';

  return (
    <svg
      className={('logo ' + className).trim()}
      viewBox="14 12 446 142"
      role="img"
      aria-label="HAVIE Badminton"
    >
      <g transform="translate(42 18) skewX(-12)">
        <g fill={ink}>
          <path d="M0 0H22V39H56V0H78V100H56V61H22V100H0Z" />
          <path
            transform="translate(88 0)"
            fillRule="evenodd"
            d="M31 0H59L90 100H66L60 78H30L24 100H0Z M37 58H53L45 32.3Z"
          />
          <path transform="translate(170 0)" d="M0 0H24L45 68L66 0H90L58 100H32Z" />
          <path transform="translate(338 0)" d="M0 0H70V20H22V40H62V60H22V80H70V100H0Z" />
        </g>
        <g transform="translate(270 0)">
          <path fill="#DC0A2D" d="M14 80L-6 14Q22 2 50 14L30 80Z" />
          <circle cx="22" cy="89" r="11" fill="#DC0A2D" />
          <path d="M18 80L4 12M22 80V6M26 80L40 12" stroke="#fff" strokeWidth="3" fill="none" />
          <path d="M-3 24Q22 12 47 24" stroke="#fff" strokeWidth="3.5" fill="none" />
        </g>
      </g>
      <path d="M46 150H72L66 141H40Z" fill="#DC0A2D" />
      <text
        x="86"
        y="150"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="15"
        fontWeight="800"
        letterSpacing="9"
        fill={tag}
      >
        BADMINTON
      </text>
    </svg>
  );
}
