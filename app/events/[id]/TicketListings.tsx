'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { TicketListing } from '@/lib/ticket-sources';
import { posthog } from '@/lib/posthog';

interface SourceSummary {
  platform: string;
  count: number;
  error: string | null;
}

interface ApiResponse {
  listings: TicketListing[];
  sources: SourceSummary[];
  from_cache: boolean;
  fetched_at: string | null;
  error?: string;
}

const BADGE_BG = ['#FFD93D', '#FF6B35', '#E8C200', '#FFD93D', '#FF6B35', '#E8C200', '#FFD93D', '#FF6B35'];

function badgeColor(index: number): string {
  return BADGE_BG[index % BADGE_BG.length];
}

function platformInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtCeil(n: number): string {
  return Math.ceil(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? `1h ${mins % 60}m ago` : `${hrs}h ago`;
}

function cheapestPerPlatform(listings: TicketListing[], minQty: number): TicketListing[] {
  const best = new Map<string, TicketListing>();
  for (const l of listings) {
    if (l.quantity > 0 && l.quantity < minQty) continue;
    const key = l.platform.toLowerCase();
    const current = best.get(key);
    if (!current || l.all_in_price < current.all_in_price) {
      best.set(key, l);
    }
  }
  return [...best.values()].sort((a, b) => a.all_in_price - b.all_in_price);
}

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function TicketListings({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [selectedQty, setSelectedQty] = useState(2);
  const isMountedQty = useRef(false);

  const load = (force = false, qty = selectedQty) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    const params = new URLSearchParams({ qty: String(qty) });
    if (force) params.set('force', '1');
    fetch(`/api/tickets/${eventId}?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() =>
        setData({ listings: [], sources: [], from_cache: false, fetched_at: null, error: 'Network error' })
      )
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    isMountedQty.current = false;
    load(false, selectedQty);
    isMountedQty.current = true;
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMountedQty.current) return;
    load(false, selectedQty);
  }, [selectedQty]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(
    () => cheapestPerPlatform(data?.listings ?? [], selectedQty),
    [data?.listings, selectedQty]
  );

  // Broadcast cheapest price so NYPPanel can prefill a suggested value
  useEffect(() => {
    const cheapestPrice = displayed[0]?.all_in_price ?? null;
    const dispatch = () => {
      window.dispatchEvent(
        new CustomEvent('tickethub:listings-state', { detail: { qty: selectedQty, cheapestPrice } })
      );
    };
    dispatch();
    window.addEventListener('tickethub:request-state', dispatch);
    return () => window.removeEventListener('tickethub:request-state', dispatch);
  }, [selectedQty, displayed]);

  const sources = data?.sources ?? [];
  const activeSources = sources.filter((s) => s.count > 0);
  const errorSources = sources.filter((s) => s.error && s.count === 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1A1A2E" strokeWidth="4" />
          <path className="opacity-75" fill="#1A1A2E" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-sm font-semibold text-chk-muted">Checking all platforms…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="bg-white rounded-[20px] overflow-hidden border-[3px] border-chk-navy"
        style={{ boxShadow: '5px 5px 0 #1A1A2E' }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-chk-navy flex-wrap gap-3">
          <h2 className="font-baloo font-extrabold text-[21px] text-chk-navy m-0">
            Every site, sorted by total
          </h2>
          <div className="flex items-center gap-4">
            {data?.fetched_at && (
              <span className="text-[12px] font-semibold text-chk-muted">
                {data.from_cache ? 'Cached' : 'Updated'} {timeAgo(data.fetched_at)}
              </span>
            )}
            <button
              onClick={() => load(true, selectedQty)}
              disabled={refreshing}
              className="text-[12px] font-bold text-chk-orange hover:opacity-70 disabled:text-chk-muted cursor-pointer"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-[12px] font-semibold text-chk-muted hover:text-chk-navy cursor-pointer"
            >
              Sources {showSources ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Quantity filter */}
        <div className="flex items-center gap-3 px-5 py-3 border-b-[2px] flex-wrap" style={{ borderColor: '#EFE6C8' }}>
          <span className="text-[13px] font-bold text-chk-navy whitespace-nowrap">Tickets together:</span>
          <div className="flex gap-1.5">
            {QTY_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setSelectedQty(n);
                  posthog.capture('quantity_changed', { event_id: eventId, quantity: n });
                }}
                className={`w-9 h-9 rounded-[9px] text-sm font-bold border-[2px] border-chk-navy transition-colors cursor-pointer ${
                  selectedQty === n
                    ? 'bg-chk-navy text-chk-yellow'
                    : 'bg-white text-chk-navy hover:bg-chk-yellow'
                }`}
              >
                {n === 6 ? '6+' : n}
              </button>
            ))}
          </div>
          {data?.listings && data.listings.length > 0 && (
            <span className="text-[11px] font-medium text-chk-muted hidden sm:block">
              Showing cheapest per platform with ≥{selectedQty} together
            </span>
          )}
        </div>

        {/* Source status panel */}
        {showSources && sources.length > 0 && (
          <div className="px-5 py-4 border-b-[2px]" style={{ borderColor: '#EFE6C8', background: '#FFFBEC' }}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-chk-muted mb-2">Source Status</p>
            <div className="grid grid-cols-1 gap-1.5">
              {sources.map((s) => (
                <div key={s.platform} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-0.5 font-bold w-4 flex-shrink-0 ${s.count > 0 ? 'text-chk-orange' : 'text-chk-muted'}`}>
                    {s.count > 0 ? '✓' : '—'}
                  </span>
                  <span className={`font-semibold w-28 flex-shrink-0 ${s.count > 0 ? 'text-chk-navy' : 'text-chk-muted'}`}>
                    {s.platform}
                    {s.count > 0 && <span className="text-chk-muted font-normal"> ({s.count})</span>}
                  </span>
                  {s.error && <span className="text-chk-muted">{s.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Column headers — desktop */}
        {displayed.length > 0 && (
          <div
            className="hidden md:grid px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-chk-muted border-b-[2px]"
            style={{ gridTemplateColumns: '1.8fr 1fr 0.5fr 1fr 80px', gap: '10px', borderColor: '#EFE6C8' }}
          >
            <span>Marketplace</span>
            <span>Section</span>
            <span>Qty</span>
            <span>Total / ea</span>
            <span />
          </div>
        )}

        {displayed.length === 0 ? (
          <div className="px-5 py-10 text-center text-chk-muted">
            <p className="text-3xl mb-2">🐣</p>
            {data?.listings && data.listings.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-chk-navy mb-1">No listings with {selectedQty}+ tickets together</p>
                <p className="text-[13px]">Try selecting a smaller quantity above.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-chk-navy mb-1">No ticket listings found</p>
                {errorSources.length > 0 && (
                  <p className="text-[13px]">
                    {errorSources.length} source{errorSources.length !== 1 ? 's' : ''} unavailable —{' '}
                    <button onClick={() => setShowSources(true)} className="underline cursor-pointer">
                      see details
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop rows */}
            <div className="hidden md:block">
              {displayed.map((t, i) => (
                <div
                  key={i}
                  className="grid px-5 py-4 items-center border-b-[1.5px]"
                  style={{
                    gridTemplateColumns: '1.8fr 1fr 0.5fr 1fr 80px',
                    gap: '10px',
                    background: i === 0 ? '#FFFBEC' : '#fff',
                    borderColor: '#F2ECD6',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-[34px] h-[34px] rounded-[9px] border-[2px] border-chk-navy flex items-center justify-center font-baloo font-extrabold text-[15px] text-chk-navy flex-shrink-0"
                      style={{ background: badgeColor(i) }}
                    >
                      {platformInitial(t.platform)}
                    </span>
                    <div>
                      <div className="font-bold text-[14.5px] text-chk-navy">{t.platform}</div>
                      {i === 0 && (
                        <span className="text-[11px] font-extrabold text-white bg-chk-orange px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                          ★ Best price
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[13.5px] font-semibold" style={{ color: '#4A4660' }}>
                    {[t.section, t.row].filter(Boolean).join(' · ') || '—'}
                  </div>

                  <div className="text-[13.5px] font-bold text-chk-navy">
                    {t.quantity > 0 ? t.quantity : '—'}
                  </div>

                  <div>
                    <div className="font-baloo font-extrabold text-[19px] text-chk-navy">{fmtCeil(t.all_in_price)}</div>
                    <div className="text-[11px] font-semibold text-chk-muted">
                      {t.estimated_fees > 0 ? `$${Math.ceil(t.estimated_fees)} fees` : 'incl. fees'}
                    </div>
                  </div>

                  {t.url ? (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => posthog.capture('get_tickets_clicked', {
                        event_id: eventId,
                        platform: t.platform,
                        section: t.section,
                        row: t.row,
                        quantity: t.quantity,
                        all_in_price: t.all_in_price,
                        is_best_price: i === 0,
                      })}
                      className={`block text-center border-[2.5px] border-chk-navy rounded-[10px] font-baloo font-bold text-[13.5px] px-2 py-2 whitespace-nowrap no-underline hover:opacity-90 transition-opacity ${
                        i === 0 ? 'bg-chk-orange text-white' : 'bg-chk-yellow text-chk-navy'
                      }`}
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-[12px] text-chk-muted">No link</span>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y-[2px]" style={{ borderColor: '#F2ECD6' }}>
              {displayed.map((t, i) => (
                <div
                  key={i}
                  className="p-4"
                  style={{ background: i === 0 ? '#FFFBEC' : '#fff' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-9 h-9 rounded-[9px] border-[2px] border-chk-navy flex items-center justify-center font-baloo font-extrabold text-[15px] text-chk-navy flex-shrink-0"
                        style={{ background: badgeColor(i) }}
                      >
                        {platformInitial(t.platform)}
                      </span>
                      <div>
                        <div className="font-bold text-[14.5px] text-chk-navy">{t.platform}</div>
                        {i === 0 && (
                          <span className="text-[11px] font-extrabold text-white bg-chk-orange px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                            ★ Best price
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-baloo font-extrabold text-[22px] text-chk-navy">{fmtCeil(t.all_in_price)}</div>
                      <div className="text-[11px] font-semibold text-chk-muted">
                        {t.estimated_fees > 0 ? `$${Math.ceil(t.estimated_fees)} fees` : 'incl. fees'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-chk-muted">Section</p>
                      <p className="font-semibold text-chk-navy">{t.section || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-chk-muted">Row</p>
                      <p className="font-semibold text-chk-navy">{t.row || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-chk-muted">Qty</p>
                      <p className="font-semibold text-chk-navy">{t.quantity > 0 ? t.quantity : '—'}</p>
                    </div>
                  </div>
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => posthog.capture('get_tickets_clicked', {
                        event_id: eventId,
                        platform: t.platform,
                        section: t.section,
                        row: t.row,
                        quantity: t.quantity,
                        all_in_price: t.all_in_price,
                        is_best_price: i === 0,
                      })}
                      className={`block w-full text-center border-[2.5px] border-chk-navy rounded-[12px] font-baloo font-bold text-[15px] py-3 no-underline hover:opacity-90 transition-opacity ${
                        i === 0 ? 'bg-chk-orange text-white' : 'bg-chk-yellow text-chk-navy'
                      }`}
                    >
                      View →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-5 py-3 text-[12.5px] font-semibold text-chk-muted" style={{ background: '#FFFBEC' }}>
          Prices refresh live · we never mark up a seller&apos;s price. Confirm at checkout.
        </div>
      </div>

      <p className="text-xs text-chk-muted text-center pt-1">
        Prices are estimates and may vary at checkout. Confirm the final price on the ticketing platform before purchase.
      </p>
    </div>
  );
}
