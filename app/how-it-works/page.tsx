import Link from 'next/link';
import ChicketsNav from '@/app/components/ChicketsNav';
import ChicketsFooter from '@/app/components/ChicketsFooter';
import ChicketsMascot from '@/app/components/ChicketsMascot';

export const metadata = { title: 'How It Works — Chickets' };

const STEPS = [
  {
    n: 1,
    title: 'Search any show.',
    bg: '#FFD93D',
    color: '#1A1A2E',
    shadow: '4px 4px 0 #1A1A2E',
  },
  {
    n: 2,
    title: 'We find every listing.',
    bg: '#FF6B35',
    color: '#fff',
    shadow: '4px 4px 0 #1A1A2E',
  },
  {
    n: 3,
    title: 'Buy now — or name your price.',
    bg: '#1A1A2E',
    color: '#FFD93D',
    shadow: '4px 4px 0 #FF6B35',
  },
  {
    n: 4,
    title: 'Get to the show.',
    bg: '#FF6B35',
    color: '#fff',
    shadow: '4px 4px 0 #1A1A2E',
    last: true as const,
  },
];

const FAQS = [
  {
    q: 'Does Chickets charge any fees?',
    a: 'No. Chickets is completely free to use. We show you prices from each platform including their fees so you can compare total cost. You buy directly on the platform of your choice — we never touch your payment.',
  },
  {
    q: 'Which platforms do you pull from?',
    a: 'We scan Ticketmaster, StubHub, SeatGeek, Vivid Seats, AXS, Gametime, and TickPick. Coverage varies by event — we show you exactly which platforms have listings and how many.',
  },
  {
    q: 'How does Name Your Price work?',
    a: 'Enter the most you\'re willing to pay per ticket, pick how many you need, and leave your email. We check prices hourly and email you the moment a listing drops to your target — with a direct link to buy.',
  },
  {
    q: 'Is my Name Your Price bid binding?',
    a: 'No. It\'s just an alert. You\'re not committed to anything — when you get the email, you choose whether to buy. There\'s no account, no credit card, no obligation.',
  },
  {
    q: 'How current are the prices?',
    a: 'Prices are fetched live when you open an event page, then cached for up to one hour. The timestamp on the listing table shows exactly when they were last pulled.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <div style={{ background: '#FFF8E1', color: '#1A1A2E' }}>
        <ChicketsNav />

        {/* Hero */}
        <section
          className="relative overflow-hidden"
          style={{ background: '#1A1A2E', borderBottom: '3px solid #1A1A2E' }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(#FFD93D 1.2px, transparent 1.2px)',
              backgroundSize: '24px 24px',
              opacity: 0.12,
            }}
          />
          <div className="relative max-w-[860px] mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
            <div
              className="inline-flex items-center gap-2 font-bold text-[12px] tracking-widest uppercase px-4 py-1.5 rounded-full mb-6"
              style={{ background: '#FF6B35', color: '#fff', border: '2px solid #FF6B35' }}
            >
              How Chickets Works
            </div>
            <h1
              className="font-baloo font-extrabold leading-[1.05] tracking-tight mb-5"
              style={{ fontSize: 'clamp(36px, 6vw, 58px)', color: '#FFD93D' }}
            >
              Stop overpaying.<br />Start chicket-hunting.
            </h1>
            <p className="text-[17px] font-medium max-w-[520px] mx-auto" style={{ color: '#9A96B8' }}>
              Chickets scans every major ticket marketplace in seconds and lets you set the price you want to pay. No apps. No accounts. No B.S.
            </p>
          </div>
        </section>

        {/* Steps */}
        <section className="max-w-[720px] mx-auto px-6 sm:px-10 py-20">
          <div className="flex flex-col gap-0">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-8 items-start">
                {/* Circle + connector column */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="flex items-center justify-center font-baloo font-extrabold text-[22px] flex-shrink-0"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: step.bg,
                      color: step.color,
                      border: '3px solid #1A1A2E',
                      boxShadow: step.shadow,
                    }}
                  >
                    {step.n}
                  </div>
                  {!step.last && (
                    <div
                      style={{
                        width: 3,
                        minHeight: 80,
                        background: '#E8E0C8',
                        flexGrow: 1,
                        marginTop: 6,
                        marginBottom: 6,
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={step.last ? 'pb-0 pt-3' : 'pb-10 pt-3'} style={{ flex: 1 }}>
                  <h2
                    className="font-baloo font-extrabold mb-4"
                    style={{ fontSize: 28, color: '#1A1A2E', lineHeight: 1.1 }}
                  >
                    {step.title}
                  </h2>

                  {step.n === 1 && <StepOneWidget />}
                  {step.n === 2 && <StepTwoWidget />}
                  {step.n === 3 && <StepThreeWidget />}
                  {step.n === 4 && (
                    <p className="text-[16px] font-medium leading-relaxed" style={{ color: '#5A5472' }}>
                      No more refreshing 6 different tabs. You get an email with the exact listing, click through, and grab your seats. Done.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ background: '#fff', borderTop: '3px solid #1A1A2E', borderBottom: '3px solid #1A1A2E' }}>
          <div className="max-w-[720px] mx-auto px-6 sm:px-10 py-16">
            <h2
              className="font-baloo font-extrabold mb-10"
              style={{ fontSize: 32, color: '#1A1A2E' }}
            >
              Questions
            </h2>
            <div>
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="py-6"
                  style={{
                    borderBottom: i < FAQS.length - 1 ? '2px solid #EFE6C8' : 'none',
                  }}
                >
                  <p className="font-baloo font-extrabold text-[18px] mb-2" style={{ color: '#1A1A2E' }}>
                    {faq.q}
                  </p>
                  <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#5A5472' }}>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className="relative overflow-hidden"
          style={{ background: '#FFD93D', borderTop: '3px solid #1A1A2E' }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#1A1A2E 1.3px, transparent 1.3px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative max-w-[720px] mx-auto px-6 sm:px-10 py-16 text-center">
            <ChicketsMascot size={80} className="mx-auto mb-4" />
            <h2
              className="font-baloo font-extrabold mb-3"
              style={{ fontSize: 36, color: '#1A1A2E' }}
            >
              Ready to find a deal?
            </h2>
            <p className="text-[16px] font-medium mb-8" style={{ color: '#2A2A40' }}>
              Compare prices across every major site in seconds.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href="/"
                className="font-baloo font-bold no-underline px-7 py-3 rounded-full text-[15px]"
                style={{
                  background: '#1A1A2E',
                  color: '#FFD93D',
                  border: '3px solid #1A1A2E',
                  boxShadow: '4px 4px 0 #1A1A2E',
                }}
              >
                Browse shows
              </Link>
              <Link
                href="/alerts"
                className="font-baloo font-bold no-underline px-7 py-3 rounded-full text-[15px]"
                style={{
                  background: '#FF6B35',
                  color: '#fff',
                  border: '3px solid #1A1A2E',
                  boxShadow: '4px 4px 0 #1A1A2E',
                }}
              >
                Name your price →
              </Link>
            </div>
          </div>
        </section>
      </div>
      <ChicketsFooter />
    </>
  );
}

function StepOneWidget() {
  return (
    <div
      className="rounded-[16px] px-4 py-3 flex items-center gap-3"
      style={{
        background: '#fff',
        border: '3px solid #1A1A2E',
        boxShadow: '5px 5px 0 #1A1A2E',
        maxWidth: 420,
      }}
    >
      <span style={{ fontSize: 18 }}>🔍</span>
      <span className="font-medium text-[15px]" style={{ color: '#9A96B8' }}>
        Search artist, venue, or city…
      </span>
      <div
        className="ml-auto font-baloo font-bold text-[13px] px-3 py-1 rounded-full flex-shrink-0"
        style={{ background: '#FFD93D', color: '#1A1A2E', border: '2px solid #1A1A2E' }}
      >
        Search
      </div>
    </div>
  );
}

function StepTwoWidget() {
  const rows = [
    { platform: 'StubHub', price: '$118', count: '34 listings' },
    { platform: 'SeatGeek', price: '$124', count: '21 listings' },
    { platform: 'Vivid Seats', price: '$131', count: '18 listings' },
  ];
  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        border: '3px solid #1A1A2E',
        boxShadow: '5px 5px 0 #1A1A2E',
        maxWidth: 420,
      }}
    >
      <div
        className="px-4 py-2 flex text-[11px] font-bold uppercase tracking-widest"
        style={{ background: '#12122A', color: '#6B6480' }}
      >
        <span style={{ flex: 1 }}>Platform</span>
        <span style={{ width: 80, textAlign: 'right' }}>Price</span>
        <span style={{ width: 90, textAlign: 'right' }}>Listings</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="px-4 py-3 flex items-center text-[14px] font-medium"
          style={{
            background: i % 2 === 0 ? '#fff' : '#FAFAFA',
            borderTop: '1.5px solid #EFE6C8',
            color: '#1A1A2E',
          }}
        >
          <span style={{ flex: 1, fontWeight: 600 }}>{row.platform}</span>
          <span
            style={{ width: 80, textAlign: 'right', fontWeight: 800, color: '#FF6B35', fontSize: 16, fontFamily: 'var(--font-baloo)' }}
          >
            {row.price}
          </span>
          <span style={{ width: 90, textAlign: 'right', color: '#9A96B8', fontSize: 12 }}>
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepThreeWidget() {
  return (
    <div className="flex gap-3 flex-wrap" style={{ maxWidth: 420 }}>
      {/* Buy now card */}
      <div
        className="flex-1 rounded-[16px] p-4"
        style={{
          background: '#FFD93D',
          border: '3px solid #1A1A2E',
          boxShadow: '5px 5px 0 #1A1A2E',
          minWidth: 160,
        }}
      >
        <p className="font-baloo font-extrabold text-[13px] mb-1" style={{ color: '#1A1A2E', opacity: 0.6 }}>
          BEST PRICE
        </p>
        <p className="font-baloo font-extrabold text-[32px] leading-none mb-1" style={{ color: '#1A1A2E' }}>
          $118
        </p>
        <p className="text-[12px] font-medium mb-3" style={{ color: '#2A2A40' }}>
          all-in · StubHub
        </p>
        <div
          className="font-baloo font-bold text-[13px] text-center py-2 rounded-full"
          style={{ background: '#1A1A2E', color: '#FFD93D', border: '2px solid #1A1A2E' }}
        >
          Buy now →
        </div>
      </div>

      {/* Name your price card */}
      <div
        className="flex-1 rounded-[16px] p-4"
        style={{
          background: '#1A1A2E',
          border: '3px solid #1A1A2E',
          boxShadow: '5px 5px 0 #FF6B35',
          minWidth: 160,
        }}
      >
        <p className="font-baloo font-extrabold text-[13px] mb-1" style={{ color: '#FF6B35' }}>
          NAME YOUR PRICE
        </p>
        <p className="font-baloo font-extrabold text-[32px] leading-none mb-1" style={{ color: '#FFD93D' }}>
          $90
        </p>
        <p className="text-[12px] font-medium mb-3" style={{ color: '#8E8CA0' }}>
          alert me when it drops
        </p>
        <div
          className="font-baloo font-bold text-[13px] text-center py-2 rounded-full"
          style={{ background: '#FFD93D', color: '#1A1A2E', border: '2px solid #FFD93D' }}
        >
          Set alert →
        </div>
      </div>
    </div>
  );
}
