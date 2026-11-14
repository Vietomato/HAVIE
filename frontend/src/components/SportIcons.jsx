import React from 'react';

// Bộ icon thanh đầu trang theo chủ đề cầu lông: nét 1.8, bo tròn, cùng khung 24x24 như lucide
// để thay thế trực tiếp (nhận size, màu theo currentColor).
function Icon({ size = 22, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// Đơn hàng: kiện hàng đang "bay" tới (có vệt tốc độ).
export function OrdersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14.5 3.5l6 3v10l-6 3-6-3v-10z" />
      <path d="M8.5 6.5l6 3 6-3M14.5 9.5v10" />
      <path d="M2 9h3.5M1 13h4.5M3 17h2.5" />
    </Icon>
  );
}

// Yêu thích: trái tim có vệt tốc độ.
export function FavoriteIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14.5 20c-5.4-3.8-7.5-6.7-7.5-9.4 0-2 1.5-3.4 3.3-3.4 1.6 0 3.1.9 4.2 2.5 1.1-1.6 2.6-2.5 4.2-2.5 1.8 0 3.3 1.4 3.3 3.4 0 2.7-2.1 5.6-7.5 9.4z" />
      <path d="M2 10h3M1 14h4M3 18h2.5" />
    </Icon>
  );
}

// Tài khoản: người chơi cầm vợt.
export function PlayerIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="9" r="3" />
      <path d="M3.5 20.5c0-3.8 2.7-6 6-6s6 2.2 6 6" />
      <ellipse cx="18.8" cy="6" rx="2.4" ry="3.3" transform="rotate(40 18.8 6)" />
      <path d="M17 8.4L13.2 13.2" />
    </Icon>
  );
}

// Giỏ hàng: túi mua sắm đang "lao" tới, cùng kiểu vệt tốc độ với đơn hàng và yêu thích.
export function ShuttleBagIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.5 8h10l.9 12.5H9.6z" />
      <path d="M13.2 8V6.8a2.3 2.3 0 0 1 4.6 0V8" />
      <path d="M2 11h3.5M1 15h4.5M3 19h2.5" />
    </Icon>
  );
}
