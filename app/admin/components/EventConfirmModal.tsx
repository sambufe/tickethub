'use client';

import { useEffect, useRef, useState } from 'react';
import { EventResult } from '@/lib/types';
import { generateCanonicalId } from '@/lib/canonical-id';

interface Props {
  event: EventResult | null;
  password: string;
  onClose: () => void;
  onAdded: (eventResultId: string) => void;
}

type Status = 'loading' | 'found' | 'not_found' | 'multiple' | 'error';

interface PlatformRow {
  key: string;
  name: string;
  status: Status;
  url: string | null;
  editedUrl: string;
  editing: boolean;
  candidates?: Array<{ url: string; label: string }>;
  error?: string;
}

const PLATFORMS: { key: string; name: string }[] = [
  { key: 'ticketmaster', name: 'Ticketmaster' },
  { key: 'seatgeek', name: 'SeatGeek' },
  { key: 'stubhub', name: 'StubHub' },
  { key: 'vividseats', name: 'Vivid Seats' },
  { key: 'axs', name: 'AXS' },
  { key: 'gametime', name: 'Gametime' },
  { key: 'tickpick', name: 'TickPick' },
];

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

function truncate(url: string, max = 60): string {
  return url.length > max ? url.slice(0, max) + '…' : url;
}

export default function EventConfirmModal({ event, password, onClose, onAdded }: Props) {
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canonicalId =
    event?.venue && event?.event_date
      ? generateCanonicalId(event.venue, event.event_date)
      : null;

  // Fire all 7 platform searches when modal opens
  useEffect(() => {
    if (!event) return;

    // Cancel any in-flight requests from a previous event
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setPlatforms(
      PLATFORMS.map((p) => ({
        ...p,
        status: 'loading',
        url: null,
        editedUrl: '',
        editing: false,
      }))
    );
    setAddError(null);

    const body = {
      title: event.title,
      artist: event.artist,
      venue: event.venue,
      city: event.city,
      state: event.state,
      event_date: event.event_date,
      ticketmaster_id: event.ticketmaster_id,
      seatgeek_id: event.seatgeek_id,
      source_url: event.source_url,
    };

    PLATFORMS.forEach(({ key }) => {
      fetch('/api/admin/platform-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ platform: key, ...body }),
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then((result: { url: string | null; found: boolean; candidates?: Array<{ url: string; label: string }>; error?: string }) => {
          setPlatforms((prev) =>
            prev.map((p) =>
              p.key === key
                ? {
                    ...p,
                    status: result.found ? 'found' : result.candidates?.length ? 'multiple' : 'not_found',
                    url: result.url,
                    editedUrl: result.url ?? '',
                    candidates: result.candidates,
                    error: result.error,
                  }
                : p
            )
          );
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          setPlatforms((prev) =>
            prev.map((p) =>
              p.key === key
                ? { ...p, status: 'error', url: null, error: String(err) }
                : p
            )
          );
        });
    });

    return () => { ac.abort(); };
  }, [event, password]);

  if (!event) return null;

  const allDone = platforms.every((p) => p.status !== 'loading');
  const foundCount = platforms.filter((p) => p.status === 'found' || p.editedUrl).length;

  const toggleEdit = (key: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.key === key ? { ...p, editing: !p.editing } : p))
    );
  };

  const setEditedUrl = (key: string, val: string) => {
    setPlatforms((prev) => prev.map((p) => (p.key === key ? { ...p, editedUrl: val } : p)));
  };

  const selectCandidate = (key: string, url: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, status: 'found', url, editedUrl: url, candidates: undefined } : p
      )
    );
  };

  const saveEdit = (key: string) => {
    setPlatforms((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const hasUrl = p.editedUrl.trim().length > 0;
        return {
          ...p,
          editing: false,
          url: hasUrl ? p.editedUrl.trim() : p.url,
          status: hasUrl ? 'found' : p.status,
        };
      })
    );
  };

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);

    // Build platform_urls from final state (prefer editedUrl, fall back to url)
    const platform_urls: Record<string, string | null> = {};
    for (const p of platforms) {
      const finalUrl = p.editedUrl.trim() || p.url;
      platform_urls[p.key] = finalUrl || null;
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

        {/* Platform coverage */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Platform Coverage
            </h3>
            {!allDone && (
              <span className="text-xs text-slate-400">Searching all platforms…</span>
            )}
            {allDone && (
              <span className="text-xs text-slate-500">
                {foundCount} of {platforms.length} found
              </span>
            )}
          </div>

          <div className="space-y-2">
            {platforms.map((p) => (
              <PlatformRow
                key={p.key}
                row={p}
                onToggleEdit={() => toggleEdit(p.key)}
                onUrlChange={(val) => setEditedUrl(p.key, val)}
                onSaveEdit={() => saveEdit(p.key)}
                onSelectCandidate={(url) => selectCandidate(p.key, url)}
              />
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Paste a URL manually for any platform not found automatically.
            Vivid Seats search may take up to 30 seconds.
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

function PlatformRow({
  row,
  onToggleEdit,
  onUrlChange,
  onSaveEdit,
  onSelectCandidate,
}: {
  row: PlatformRow;
  onToggleEdit: () => void;
  onUrlChange: (val: string) => void;
  onSaveEdit: () => void;
  onSelectCandidate: (url: string) => void;
}) {
  const isLoading = row.status === 'loading';
  const isFound = row.status === 'found';
  const isMultiple = row.status === 'multiple';

  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      {/* Status icon */}
      <div className="w-5 flex-shrink-0 mt-0.5">
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : isFound ? (
          <span className="text-green-500 text-sm font-bold">✓</span>
        ) : isMultiple ? (
          <span className="text-amber-500 text-sm font-bold">?</span>
        ) : (
          <span className="text-slate-300 text-sm font-bold">—</span>
        )}
      </div>

      {/* Platform name */}
      <div className="w-28 flex-shrink-0">
        <span className="text-sm font-medium text-slate-700">{row.name}</span>
      </div>

      {/* URL / status / edit */}
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <span className="text-xs text-slate-400">Searching…</span>
        ) : row.editing ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={row.editedUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="Paste event URL…"
              className="flex-1 text-xs text-slate-900 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
            />
            <button
              onClick={onSaveEdit}
              className="text-xs text-indigo-600 font-medium px-2 py-1 rounded border border-indigo-300 hover:bg-indigo-50"
            >
              Save
            </button>
          </div>
        ) : isMultiple && row.candidates ? (
          <div className="space-y-1">
            <p className="text-xs text-amber-600 font-medium mb-1">{row.candidates.length} matches — pick one:</p>
            {row.candidates.map((c) => (
              <button
                key={c.url}
                onClick={() => onSelectCandidate(c.url)}
                className="block w-full text-left text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded px-1.5 py-1 truncate"
                title={c.url}
              >
                {c.label}
              </button>
            ))}
            <button onClick={onToggleEdit} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
              Paste URL instead
            </button>
          </div>
        ) : isFound || row.editedUrl ? (
          <div className="flex items-center gap-2">
            <a
              href={row.editedUrl || row.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline truncate max-w-xs"
              title={row.editedUrl || row.url || ''}
            >
              {truncate(row.editedUrl || row.url || '')}
            </a>
            <button onClick={onToggleEdit} className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0">
              Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{row.error ?? 'Not found'}</span>
            <button onClick={onToggleEdit} className="text-xs text-indigo-500 hover:text-indigo-700 flex-shrink-0 font-medium">
              Add URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
