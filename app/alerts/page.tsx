'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import ChicketsNav from '@/app/components/ChicketsNav';
import ChicketsFooter from '@/app/components/ChicketsFooter';
import ChicketsMascot from '@/app/components/ChicketsMascot';

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6];
const DATE_WINDOWS = ['Tonight', 'This Week', 'This Month', 'Next Few Months'] as const;
type DateWindow = typeof DATE_WINDOWS[number];
const MAX_PRICE = 500;

export default function AlertsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [qty, setQty] = useState(2);
  const [dateWindow, setDateWindow] = useState<DateWindow>('This Month');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEdited = useRef(false);

  const numericPrice = typeof price === 'number' ? price : 0;
  const sliderBg = `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${(numericPrice / MAX_PRICE) * 100}%, #2A2A48 ${(numericPrice / MAX_PRICE) * 100}%, #2A2A48 100%)`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (price === '' || price <= 0) { setError('Enter a price above $0.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          target_price: Number(price),
          quantity: qty,
          date_window: dateWindow,
          event_id: null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ background: '#FFF8E1', minHeight: '100vh', color: '#1A1A2E' }}>
        <ChicketsNav />

        {/* Yellow hero header */}
        <section
          className="relative border-b-[3px] border-chk-navy overflow-hidden"
          style={{ background: '#FFD93D' }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#1A1A2E 1.4px, transparent 1.4px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative max-w-[1240px] mx-auto px-6 sm:px-10 py-12 sm:py-16 flex flex-col items-center text-center gap-4">
            <ChicketsMascot size={80} />
            <h1 className="font-baloo font-extrabold text-chk-navy tracking-tight m-0" style={{ fontSize: 48, lineHeight: 1.05 }}>
              Name Your Price
            </h1>
            <p className="font-medium text-[17px] max-w-[480px] m-0" style={{ color: '#2A2A40' }}>
              Set a target price. We&apos;ll ping you the moment any platform hits it.
            </p>
          </div>
        </section>

        {/* Form card */}
        <div className="max-w-[1240px] mx-auto px-6 sm:px-10 py-12">
          <div
            className="mx-auto bg-white"
            style={{
              maxWidth: 560,
              border: '3px solid #1A1A2E',
              borderRadius: 20,
              boxShadow: '5px 5px 0 #1A1A2E',
              overflow: 'hidden',
            }}
          >
            {success ? (
              <div className="text-center" style={{ padding: '48px 32px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <p className="font-baloo font-extrabold text-chk-navy" style={{ fontSize: 24, marginBottom: 8 }}>
                  You&apos;re on the list!
                </p>
                <p className="font-medium text-chk-muted" style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                  We&apos;ll email <strong className="text-chk-navy">{email}</strong> the moment any listing drops to{' '}
                  <strong className="text-chk-orange">${numericPrice}</strong> or less for {qty} ticket{qty !== 1 ? 's' : ''}.
                </p>
                <Link
                  href="/"
                  className="font-baloo font-bold no-underline rounded-[12px] px-6 py-3 inline-block"
                  style={{ background: '#FFD93D', color: '#1A1A2E', border: '2.5px solid #1A1A2E', boxShadow: '3px 3px 0 #1A1A2E', fontSize: 16 }}
                >
                  Browse events →
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '28px 28px 24px' }}>
                {/* Name */}
                <div style={{ marginBottom: 16 }}>
                  <label className="font-bold" style={labelStyle}>Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    style={inputStyle}
                  />
                </div>

                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label className="font-bold" style={labelStyle}>Your email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={inputStyle}
                  />
                </div>

                {/* Max price */}
                <div style={{ marginBottom: 10 }}>
                  <label className="font-bold" style={labelStyle}>Max price per ticket</label>
                  <div
                    style={{
                      background: '#0F0F1C',
                      border: '2px solid #2A2A48',
                      borderRadius: 12,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="font-baloo font-extrabold" style={{ color: '#FFD93D', fontSize: 28 }}>$</span>
                    <input
                      type="number"
                      min={0}
                      max={MAX_PRICE}
                      step={5}
                      value={price}
                      onChange={(e) => {
                        userEdited.current = true;
                        setPrice(e.target.value === '' ? '' : Math.min(MAX_PRICE, Math.max(0, Number(e.target.value))));
                      }}
                      className="chk-num"
                      placeholder="150"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#FFD93D',
                        fontFamily: 'var(--font-baloo-2)',
                        fontWeight: 800,
                        fontSize: 32,
                        width: '100%',
                      }}
                    />
                  </div>
                </div>

                {/* Range slider */}
                <div style={{ marginBottom: 20 }}>
                  <input
                    type="range"
                    min={0}
                    max={MAX_PRICE}
                    step={5}
                    value={numericPrice}
                    onChange={(e) => {
                      userEdited.current = true;
                      setPrice(Number(e.target.value));
                    }}
                    className="chk-range"
                    style={{ width: '100%', background: sliderBg }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600 }}>$0</span>
                    <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600 }}>${MAX_PRICE}</span>
                  </div>
                </div>

                {/* Qty */}
                <div style={{ marginBottom: 16 }}>
                  <label className="font-bold" style={labelStyle}>Seats</label>
                  <div className="flex gap-2 flex-wrap">
                    {QTY_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQty(n)}
                        className="font-bold"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          border: '2px solid #1A1A2E',
                          background: qty === n ? '#FFD93D' : '#fff',
                          color: qty === n ? '#1A1A2E' : '#1A1A2E',
                          fontSize: 15,
                          cursor: 'pointer',
                          boxShadow: qty === n ? '3px 3px 0 #1A1A2E' : 'none',
                          transition: 'all 0.1s',
                        }}
                      >
                        {n === 6 ? '6+' : n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date window */}
                <div style={{ marginBottom: 20 }}>
                  <label className="font-bold" style={labelStyle}>When</label>
                  <div className="flex gap-2 flex-wrap">
                    {DATE_WINDOWS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setDateWindow(w)}
                        className="font-semibold text-sm"
                        style={{
                          padding: '7px 14px',
                          borderRadius: 999,
                          border: dateWindow === w ? '2px solid #1A1A2E' : '2px solid #D1D5DB',
                          background: dateWindow === w ? '#FFD93D' : '#fff',
                          color: '#1A1A2E',
                          cursor: 'pointer',
                          boxShadow: dateWindow === w ? '3px 3px 0 #1A1A2E' : 'none',
                          transition: 'all 0.1s',
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p style={{ color: '#FF6B35', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="font-baloo font-bold w-full"
                  style={{
                    background: submitting ? '#b89e20' : '#FFD93D',
                    color: '#1A1A2E',
                    border: '2.5px solid #1A1A2E',
                    borderRadius: 12,
                    fontSize: 18,
                    padding: '14px 0',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: submitting ? 'none' : '4px 4px 0 #1A1A2E',
                    transition: 'all 0.1s',
                  }}
                >
                  {submitting ? 'Placing bid…' : 'Alert Me When It Drops'}
                </button>

                <p className="text-center font-medium" style={{ color: '#9CA3AF', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                  We never spam. One email per match, then you&apos;re done.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
      <ChicketsFooter />
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#6B6450',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '2px solid #E5E7EB',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  fontWeight: 500,
  color: '#1A1A2E',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
