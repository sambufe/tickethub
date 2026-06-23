'use client';

import { useState, useEffect } from 'react';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';

const PLATFORMS: { key: string; name: string; placeholder: string }[] = [
  { key: 'ticketmaster', name: 'Ticketmaster', placeholder: 'https://www.ticketmaster.com/event/…' },
  { key: 'seatgeek', name: 'SeatGeek', placeholder: 'https://seatgeek.com/…-tickets/…' },
  { key: 'stubhub', name: 'StubHub', placeholder: 'https://www.stubhub.com/…-tickets/…' },
  { key: 'vividseats', name: 'Vivid Seats', placeholder: 'https://www.vividseats.com/production/…' },
  { key: 'gametime', name: 'Gametime', placeholder: 'https://gametime.co/concert/…/events/…' },
  { key: 'tickpick', name: 'TickPick', placeholder: 'https://www.tickpick.com/buy-…' },
];

interface Props {
  event: CatalogEvent | null;
  password: string;
  onClose: () => void;
  onSaved: (eventId: number, updatedUrls: Record<string, string | null>) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EditPlatformUrlsModal({ event, password, onClose, onSaved }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Populate fields when the event changes
  useEffect(() => {
    if (!event) return;
    const parsed = parsePlatformUrls(event);
    const initial: Record<string, string> = {};
    for (const { key } of PLATFORMS) {
      initial[key] = (parsed[key as keyof typeof parsed] as string | null | undefined) ?? '';
    }
    setUrls(initial);
    setSaveState('idle');
    setErrorMsg(null);
  }, [event]);

  if (!event) return null;

  const handleSave = async () => {
    setSaveState('saving');
    setErrorMsg(null);

    // Convert empty strings to null so the DB isn't cluttered with empty entries
    const payload: Record<string, string | null> = {};
    for (const { key } of PLATFORMS) {
      payload[key] = urls[key].trim() || null;
    }

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ platform_urls: payload }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErrorMsg(d.error ?? 'Save failed.');
        setSaveState('error');
        return;
      }
      setSaveState('saved');
      onSaved(event.id, payload);
      // Auto-close after a brief success flash
      setTimeout(onClose, 1200);
    } catch {
      setErrorMsg('Network error — changes not saved.');
      setSaveState('error');
    }
  };

  const hasChanges = (() => {
    const parsed = parsePlatformUrls(event);
    return PLATFORMS.some(({ key }) => {
      const stored = (parsed[key as keyof typeof parsed] as string | null | undefined) ?? '';
      return (urls[key] ?? '').trim() !== (stored ?? '').trim();
    });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={saveState === 'saving' ? undefined : onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-slate-900">Edit Platform URLs</h2>
            <p className="text-sm text-slate-500 truncate mt-0.5">{event.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saveState === 'saving'}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none flex-shrink-0 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        {/* URL fields */}
        <div className="px-6 py-5 space-y-4">
          {PLATFORMS.map(({ key, name, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{name}</label>
              <input
                type="url"
                value={urls[key] ?? ''}
                onChange={(e) => setUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                disabled={saveState === 'saving' || saveState === 'saved'}
                className="w-full text-sm text-slate-900 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-300"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{errorMsg}</p>
          )}

          {saveState === 'saved' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-green-600 text-sm font-medium">
              <span>✓</span>
              <span>URLs saved successfully</span>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={saveState === 'saving'}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveState === 'saving' || !hasChanges}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white text-sm font-semibold transition-colors"
              >
                {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
