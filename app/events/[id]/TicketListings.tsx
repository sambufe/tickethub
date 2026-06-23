'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { TicketListing } from '@/lib/ticket-sources';

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

const PLATFORM_COLORS: Record<string, string> = {
  ticketmaster: 'bg-blue-100 text-blue-700',
  seatgeek: 'bg-orange-100 text-orange-700',
  stubhub: 'bg-red-100 text-red-700',
  'vivid seats': 'bg-purple-100 text-purple-700',
  vividseats: 'bg-purple-100 text-purple-700',
  axs: 'bg-teal-100 text-teal-700',
  gametime: 'bg-green-100 text-green-700',
  tickpick: 'bg-amber-100 text-amber-700',
};

function platformColor(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, '');
  return PLATFORM_COLORS[key] ?? 'bg-slate-100 text-slate-700';
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtCeil(n: number): string {
  return Math.ceil(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? `1h ${mins % 60}m ago` : `${hrs}h ago`;
}

/** Keep only the cheapest listing per platform, after quantity filter. */
function cheapestPerPlatform(listings: TicketListing[], minQty: number): TicketListing[] {
  const best = new Map<string, TicketListing>();
  for (const l of listings) {
    // quantity=0 means "not specified" (e.g. TM price ranges) — always include
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
  // Tracks whether the initial load (triggered by eventId effect) has run,
  // so the selectedQty effect skips the first render and only fires on changes.
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

  // Initial load when the event page mounts or eventId changes
  useEffect(() => {
    isMountedQty.current = false;
    load(false, selectedQty);
    isMountedQty.current = true;
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when qty changes (Gametime returns different listings per qty)
  useEffect(() => {
    if (!isMountedQty.current) return;
    load(false, selectedQty);
  }, [selectedQty]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(
    () => cheapestPerPlatform(data?.listings ?? [], selectedQty),
    [data?.listings, selectedQty]
  );

  const sources = data?.sources ?? [];
  const activeSources = sources.filter((s) => s.count > 0);
  const errorSources = sources.filter((s) => s.error && s.count === 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
        <svg className="animate-spin h-8 w-8 text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-sm">Checking all platforms…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">
            Tickets
            {displayed.length > 0 && (
              <span className="text-slate-400 font-normal text-base ml-2">
                ({displayed.length} platform{displayed.length !== 1 ? 's' : ''})
              </span>
            )}
          </h2>
          {activeSources.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {activeSources.map((s) => (
                <span key={s.platform} className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformColor(s.platform)}`}>
                  {s.platform}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {data?.fetched_at && (
            <span className="text-xs text-slate-400">
              {data.from_cache ? 'Cached' : 'Updated'} {timeAgo(data.fetched_at)}
            </span>
          )}
          <button
            onClick={() => load(true, selectedQty)}
            disabled={refreshing}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:text-slate-300"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={() => setShowSources((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600">
            Sources {showSources ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Quantity filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Tickets together:</label>
        <div className="flex gap-1">
          {QTY_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setSelectedQty(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                selectedQty === n
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              {n === 6 ? '6+' : n}
            </button>
          ))}
        </div>
        {data?.listings && data.listings.length > 0 && (
          <span className="text-xs text-slate-400">
            Showing cheapest listing per platform with ≥{selectedQty} tickets together
          </span>
        )}
      </div>

      {/* Source status panel */}
      {showSources && sources.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Source Status</p>
          <div className="grid grid-cols-1 gap-2">
            {sources.map((s) => (
              <div key={s.platform} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 font-semibold w-4 flex-shrink-0 ${s.count > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                  {s.count > 0 ? '✓' : '—'}
                </span>
                <span className={`font-medium w-28 flex-shrink-0 ${s.count > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                  {s.platform}
                  {s.count > 0 && <span className="text-slate-400 font-normal"> ({s.count})</span>}
                </span>
                {s.error && <span className="text-slate-500">{s.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          <p className="text-3xl mb-2">🎟</p>
          {data?.listings && data.listings.length > 0 ? (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">No listings with {selectedQty}+ tickets together</p>
              <p className="text-xs">Try selecting a smaller quantity above.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">No ticket listings found</p>
              {errorSources.length > 0 && (
                <p className="text-xs">
                  {errorSources.length} source{errorSources.length !== 1 ? 's' : ''} unavailable —{' '}
                  <button onClick={() => setShowSources(true)} className="underline">
                    see details
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Platform</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Section</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Row</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Listed</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Est. Fees</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">All-In</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayed.map((t, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${i === 0 ? 'bg-green-50/40' : ''}`}>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${platformColor(t.platform)}`}>
                        {t.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{t.section || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{t.row || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {t.quantity > 0 ? t.quantity : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{fmt(t.listed_price)}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {t.estimated_fees > 0 ? `+${fmt(t.estimated_fees)}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-bold text-base ${i === 0 ? 'text-green-700' : 'text-slate-900'}`}>
                        {fmtCeil(t.all_in_price)}
                      </span>
                      {i === 0 && (
                        <span className="ml-1.5 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                          Best
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {t.url ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-1.5 text-xs transition-colors whitespace-nowrap"
                        >
                          Get Tickets
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">No link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {displayed.map((t, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl border p-4 shadow-sm ${i === 0 ? 'border-green-300 bg-green-50/30' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${platformColor(t.platform)}`}>
                    {t.platform}
                  </span>
                  <div className="text-right">
                    <span className={`font-bold text-xl ${i === 0 ? 'text-green-700' : 'text-slate-900'}`}>
                      {fmtCeil(t.all_in_price)}
                    </span>
                    {i === 0 && <span className="block text-xs text-green-600 font-medium">Best price</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div><p className="text-xs text-slate-400">Section</p><p className="text-slate-700">{t.section || '—'}</p></div>
                  <div><p className="text-xs text-slate-400">Row</p><p className="text-slate-700">{t.row || '—'}</p></div>
                  <div><p className="text-xs text-slate-400">Qty</p><p className="text-slate-700">{t.quantity > 0 ? t.quantity : '—'}</p></div>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {fmt(t.listed_price)}{t.estimated_fees > 0 ? ` + ${fmt(t.estimated_fees)} est. fees` : ''}
                </p>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                  >
                    Get Tickets
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center pt-2">
        Prices are estimates and may vary at checkout. Confirm the final price on the ticketing platform before purchase.
      </p>
    </div>
  );
}
