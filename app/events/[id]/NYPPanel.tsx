'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  eventId: string;
  eventTitle: string;
}

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6];
const MAX_PRICE = 500;

export default function NYPPanel({ eventId, eventTitle }: Props) {
  const [price, setPrice] = useState<number | ''>('');
  const [qty, setQty] = useState(2);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEdited = useRef(false);

  // Listen for cheapest price broadcast from TicketListings and prefill once
  useEffect(() => {
    const handleState = (e: Event) => {
      if (userEdited.current) return;
      const { cheapestPrice } = (e as CustomEvent<{ qty: number; cheapestPrice: number | null }>).detail;
      if (cheapestPrice != null) {
        const suggested = Math.max(1, Math.floor((cheapestPrice * 0.9) / 5) * 5);
        setPrice(suggested);
      }
    };
    window.addEventListener('tickethub:listings-state', handleState);
    window.dispatchEvent(new CustomEvent('tickethub:request-state'));
    return () => window.removeEventListener('tickethub:listings-state', handleState);
  }, []);

  const numericPrice = typeof price === 'number' ? price : 0;
  const sliderBg = `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${(numericPrice / MAX_PRICE) * 100}%, #2A2A48 ${(numericPrice / MAX_PRICE) * 100}%, #2A2A48 100%)`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    if (price === '' || price <= 0) { setError('Enter a price above $0.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: Number(eventId), target_price: Number(price), quantity: qty, email: email.trim() }),
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
    <div
      style={{
        background: '#1A1A2E',
        border: '3px solid #1A1A2E',
        borderRadius: 20,
        boxShadow: '5px 5px 0 #FF6B35',
        position: 'sticky',
        top: 84,
      }}
    >
      {/* Orange header strip */}
      <div
        style={{
          background: '#FF6B35',
          borderRadius: '17px 17px 0 0',
          padding: '14px 20px',
          borderBottom: '3px solid #1A1A2E',
        }}
      >
        <p className="font-baloo font-extrabold text-white m-0" style={{ fontSize: 20 }}>
          🎯 Name Your Price
        </p>
        <p className="text-white font-semibold m-0" style={{ fontSize: 13, opacity: 0.85 }}>
          Set a target — we&apos;ll ping you when it drops.
        </p>
      </div>

      {/* Body */}
      {success ? (
        <div className="text-center" style={{ padding: '32px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <p className="font-baloo font-extrabold" style={{ color: '#FFD93D', fontSize: 20, marginBottom: 6 }}>
            You&apos;re on the list!
          </p>
          <p className="font-medium" style={{ color: '#A9A7BF', fontSize: 14, lineHeight: 1.5 }}>
            We&apos;ll email <strong style={{ color: '#fff' }}>{email}</strong> the moment a listing hits{' '}
            <strong style={{ color: '#FFD93D' }}>${numericPrice}</strong> or less for {qty} ticket{qty !== 1 ? 's' : ''}.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: '20px 20px 16px' }}>
          {/* Price input */}
          <div style={{ marginBottom: 16 }}>
            <label
              className="font-bold"
              style={{ color: '#A9A7BF', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}
            >
              Your max price (per ticket)
            </label>
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
              <span style={{ color: '#4A4860', fontSize: 11, fontWeight: 600 }}>$0</span>
              <span style={{ color: '#4A4860', fontSize: 11, fontWeight: 600 }}>${MAX_PRICE}</span>
            </div>
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: 16 }}>
            <label
              className="font-bold"
              style={{ color: '#A9A7BF', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}
            >
              Seats
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {QTY_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQty(n)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 9,
                    border: '2px solid #FFD93D',
                    background: qty === n ? '#FFD93D' : 'transparent',
                    color: qty === n ? '#1A1A2E' : '#FFD93D',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {n === 6 ? '6+' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              className="font-bold"
              style={{ color: '#A9A7BF', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                background: '#0F0F1C',
                border: '2px solid #2A2A48',
                borderRadius: 12,
                padding: '10px 14px',
                color: '#FFF8E1',
                fontWeight: 600,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#FF6B35', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="font-baloo font-bold"
            style={{
              width: '100%',
              background: submitting ? '#b89e20' : '#FFD93D',
              color: '#1A1A2E',
              border: '2.5px solid #1A1A2E',
              borderRadius: 12,
              fontSize: 17,
              padding: '13px 0',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.1s',
            }}
          >
            {submitting ? 'Placing bid…' : 'Alert Me When It Drops'}
          </button>

          <p style={{ color: '#4A4860', fontSize: 12, fontWeight: 500, textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            We&apos;ll email you the moment any platform hits your price.
          </p>
        </form>
      )}
    </div>
  );
}
