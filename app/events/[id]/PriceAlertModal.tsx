'use client';

import { useEffect, useRef, useState } from 'react';
import { posthog } from '@/lib/posthog';

interface Props {
  eventId: string;
  eventTitle: string;
  defaultQty: number;
  suggestedPrice: number | null; // cheapest all_in_price minus 15%, rounded down to $5
  onClose: () => void;
}

export default function PriceAlertModal({ eventId, eventTitle, defaultQty, suggestedPrice, onClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState(defaultQty);
  const [price, setPrice] = useState(suggestedPrice ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on open
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: Number(eventId),
          name: name.trim(),
          email: email.trim(),
          target_price: Number(price),
          quantity: qty,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Something went wrong');
        setStatus('error');
      } else {
        setStatus('success');
        posthog.capture('price_alert_created', {
          event_id: Number(eventId),
          quantity: qty,
          target_price: Number(price),
        });
      }
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('error');
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Get notified when prices drop</h2>
            <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{eventTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-4 mt-0.5 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5">
          {status === 'success' ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-slate-800 font-semibold text-base">You&apos;re on the list!</p>
              <p className="text-slate-500 text-sm mt-2">
                We&apos;ll email <strong>{email}</strong> when <strong>{eventTitle}</strong> tickets
                drop to <strong>${Math.ceil(Number(price))}</strong> or below for{' '}
                <strong>{qty} ticket{qty !== 1 ? 's' : ''}</strong>.
              </p>
              <button
                onClick={onClose}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First name</label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sam"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                  <select
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} ticket{n !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Alert me when all-in price drops to
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 75"
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                {suggestedPrice && (
                  <p className="text-xs text-slate-400 mt-1">
                    Suggested: ${suggestedPrice} (15% below current best price)
                  </p>
                )}
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                {status === 'loading' ? 'Setting alert…' : '🎯 Set Price Alert'}
              </button>
            </form>
          )}
        </div>

        {status !== 'success' && (
          <p className="text-center text-xs text-slate-400 pb-4">
            No spam. One email when we find a match.
          </p>
        )}
      </div>
    </div>
  );
}
