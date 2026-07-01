'use client';

import { useState, useEffect } from 'react';
import { EventResult } from '@/lib/types';
import { generateCanonicalId } from '@/lib/canonical-id';

interface Props {
  event: EventResult | null;
  prefillUrls: Record<string, string | null>;
  password: string;
  onClose: () => void;
  onAdded: (eventResultId: string) => void;
}

interface PlatformEntry {
  key: string;
  name: string;
  url: string;
}

const PLATFORMS: { key: string; name: string }[] = [
  { key: 'ticketmaster', name: 'Ticketmaster' },
  { key: 'stubhub',      name: 'StubHub' },
  { key: 'vividseats',   name: 'Vivid Seats' },
  { key: 'gametime',     name: 'Gametime' },
  { key: 'tickpick',     name: 'TickPick' },
  { key: 'seatgeek',     name: 'SeatGeek' },
  { key: 'axs',          name: 'AXS' },
];

// Platforms auto-searched via SerpAPI
const AUTO_SEARCHED = new Set(['stubhub', 'vividseats', 'gametime', 'tickpick']);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isLikelyJunk(url: string, artist: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const subdomain = parsed.hostname.split('.')[0];
    if (['support', 'blog', 'help', 'about', 'careers', 'community'].includes(subdomain)) return true;
    const path = parsed.pathname.toLowerCase();
    if (/\/(blog|support|help|articles?|faq|seating[-_]chart|performer)\//.test(path)) return true;
    if (artist) {
      const words = artist.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length >= 4);
      const urlLower = url.toLowerCase();
      if (words.length > 0 && !words.some((w) => urlLower.includes(w))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function EventConfirmModal({ event, prefillUrls, password, onClose, onAdded }: Props) {
  const [platforms, setPlatforms] = useState<PlatformEntry[]>(
    PLATFORMS.map((p) => ({ ...p, url: '' }))
  );
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reinit URL fields whenever a new event is selected
  useEffect(() => {
    if (!event) return;
    setPlatforms(PLATFORMS.map((p) => ({ ...p, url: prefillUrls[p.key] ?? '' })));
    setAdding(false);
    setAddError(null);
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canonicalId =
    event?.venue && event?.event_date
      ? generateCanonicalId(event.venue, event.event_date)
      : null;

  if (!event) return null;

  const setUrl = (key: string, val: string) => {
    setPlatforms((prev) => prev.map((p) => (p.key === key ? { ...p, url: val } : p)));
  };

  const filledCount = platforms.filter((p) => p.url.trim()).length;
  const hasAnyPrefill = Object.values(prefillUrls).some((v) => v != null);

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);

    const platform_urls: Record<string, string | null> = {};
    for (const p of platforms) {
      platform_urls[p.key] = p.url.trim() || null;
    }

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          title: event.title,
          artist: event.artist,
          venue: event.venue,
          city: event.city,
          state: event.state,
          event_date: event.event_date,
          ticketmaster_id: event.ticketmaster_id ?? null,
          seatgeek_id: event.seatgeek_id ?? null,
          source_url: event.source_url ?? null,
          image_url: event.image_url ?? null,
          canonical_id: canonicalId,
          platform_urls,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        onAdded(event.id);
      } else {
        setAddError(data.error || 'Failed to add event.');
      }
    } catch {
      setAddError('Network error while adding event.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Confirm & Add Event</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Event summary */}
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          {event.image_url ? (
            <img src={event.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🎵</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-base leading-snug">{event.title}</p>
            {event.artist && event.artist !== event.title && (
              <p className="text-sm text-slate-500 mt-0.5">{event.artist}</p>
            )}
            <p className="text-sm text-slate-600 mt-1">
              {[event.venue, event.city, event.state].filter(Boolean).join(' · ')}
            </p>
            <p className="text-sm text-slate-600">{formatDate(event.event_date)}</p>
            {canonicalId && (
              <p className="text-xs text-slate-400 font-mono mt-1">{canonicalId}</p>
            )}
          </div>
        </div>

        {/* Platform URLs */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Platform URLs
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              hasAnyPrefill
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {hasAnyPrefill ? 'Auto-searched · edit if needed' : 'Manual mode'}
            </span>
          </div>

          <div className="space-y-2">
            {platforms.map((p) => {
              const junk = !!p.url.trim() && isLikelyJunk(p.url, event.artist);
              const autoSearched = AUTO_SEARCHED.has(p.key);
              return (
                <div key={p.key} className="flex items-center gap-3 py-1">
                  <div className="w-28 flex-shrink-0 flex items-center gap-1">
                    <span className="text-sm font-medium text-slate-700">{p.name}</span>
                    {autoSearched && (
                      <span className="text-xs text-slate-300" title="Auto-searched">✦</span>
                    )}
                  </div>
                  <div className="w-4 flex-shrink-0 text-center">
                    {p.url.trim() ? (
                      junk ? (
                        <span className="text-orange-400 text-sm" title="Review this URL — may not be the correct listing">⚠</span>
                      ) : (
                        <span className="text-green-500 text-sm font-bold">✓</span>
                      )
                    ) : (
                      <span className="text-slate-200 text-sm font-bold">—</span>
                    )}
                  </div>
                  <input
                    type="url"
                    value={p.url}
                    onChange={(e) => setUrl(p.key, e.target.value)}
                    placeholder={`Paste ${p.name} event URL…`}
                    className={`flex-1 text-xs text-slate-900 rounded border px-2 py-1.5 focus:outline-none focus:ring-1 placeholder:text-slate-300 ${
                      junk
                        ? 'border-orange-300 bg-orange-50/40 focus:ring-orange-400'
                        : 'border-slate-200 focus:ring-indigo-400'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 mt-3">
            ✦ = auto-searched via Google. ⚠ = URL may be wrong — verify before saving.
            {filledCount > 0 && (
              <span className="ml-1 text-slate-500">{filledCount} of {platforms.length} filled.</span>
            )}
          </p>
        </div>

        {/* Footer */}
        {addError && (
          <div className="px-6 pb-2">
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold transition-colors"
          >
            {adding ? 'Adding…' : 'Confirm & Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
