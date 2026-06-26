import Link from 'next/link';

export default function ChicketsNav() {
  return (
    <header
      className="flex items-center justify-between px-6 sm:px-10 py-3.5"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,248,225,.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '2px solid #1A1A2E',
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <svg viewBox="0 0 60 60" style={{ width: 42, height: 42, display: 'block' }} aria-hidden="true">
          <circle cx="30" cy="31" r="26" fill="#FFD93D" stroke="#1A1A2E" strokeWidth="3.5"/>
          <ellipse cx="22" cy="11" rx="4" ry="8" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5" transform="rotate(-16 22 11)"/>
          <ellipse cx="30" cy="8" rx="4" ry="9" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5"/>
          <ellipse cx="38" cy="11" rx="4" ry="8" fill="#E8C200" stroke="#1A1A2E" strokeWidth="2.5" transform="rotate(16 38 11)"/>
          <circle cx="22" cy="28" r="6.5" fill="#fff" stroke="#1A1A2E" strokeWidth="2"/>
          <circle cx="23" cy="29" r="3.4" fill="#1A1A2E"/>
          <circle cx="38" cy="28" r="6.5" fill="#fff" stroke="#1A1A2E" strokeWidth="2"/>
          <circle cx="39" cy="29" r="3.4" fill="#1A1A2E"/>
          <path d="M25 37 L35 37 L30 44 Z" fill="#FF6B35" stroke="#1A1A2E" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        <span className="font-baloo font-extrabold text-2xl text-chk-navy tracking-tight">chickets</span>
      </Link>
      <nav className="flex items-center">
        <Link href="/how-it-works" className="font-semibold text-sm no-underline" style={{ color: '#1A1A2E' }}>
          How it works
        </Link>
      </nav>
    </header>
  );
}
