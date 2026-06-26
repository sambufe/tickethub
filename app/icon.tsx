import { ImageResponse } from 'next/og';

export const size = { width: 60, height: 60 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="31" r="26" fill="#FFD93D" stroke="#1A1A2E" strokeWidth="3.5" />
      <ellipse cx="22" cy="11" rx="4" ry="8" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5" transform="rotate(-16 22 11)" />
      <ellipse cx="30" cy="8" rx="4" ry="9" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5" />
      <ellipse cx="38" cy="11" rx="4" ry="8" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5" transform="rotate(16 38 11)" />
      <circle cx="22" cy="28" r="6.5" fill="#fff" stroke="#1A1A2E" strokeWidth="2" />
      <circle cx="23" cy="29" r="3.4" fill="#1A1A2E" />
      <circle cx="38" cy="28" r="6.5" fill="#fff" stroke="#1A1A2E" strokeWidth="2" />
      <circle cx="39" cy="29" r="3.4" fill="#1A1A2E" />
      <path d="M25 37 L35 37 L30 44 Z" fill="#FF6B35" stroke="#1A1A2E" strokeWidth="2" strokeLinejoin="round" />
    </svg>,
    { ...size }
  );
}
