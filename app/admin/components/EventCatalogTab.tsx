'use client';

import { useEffect, useState, useCallback } from 'react';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';

interface Props {
  password: string;
}

const PLATFORMS: { key: string; label: string; fullName: string }[] = [
  { key: 'ticketmaster', label: 'TM',  fullName: 'Ticketmaster' },
  { key: 'vividseats',   label: 'VS',  fullName: 'Vivid Seats'  },
  { key: 'tickpick',     label: 'TP',  fullName: 'TickPick'      },
  { key: 'gametime',     label: 'GT',  fullName: 'Gametime'      },
  { key: 'axs',          label: 'AXS', fullName: 'AXS'           },
  { key: 'seatgeek',     label: 'SG',  fullName: 'SeatGeek'      },
  { key: 'stubhub',      label: 'SH',  fullName: 'StubHub'       },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Compact row of platform link indicators derived from stored platform_urls
function PlatformDots({ event }: { event: CatalogEvent }) {
  const urls = parsePlatformUrls(event);
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      {PLATFORMS.map(({ key, label, fullName }) => {
        const url = urls[key as keyof typeof urls];
        return url ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${fullName}: ${url}`}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1 py-0.5 hover:bg-green-100 transition-colors leading-none"
          >
            {label} <span className="text-green-500">✓</span>
          </a>
        ) : (
          <span
            key={key}
            title={`${fullName}: no URL stored`}
            className="inline-flex items-center text-[10px] font-medium text-slate-300 bg-slate-50 border border-slate-100 rounded px-1 py-0.5 leading-none"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

// Modal for editing all platform URLs for a single event
function EditUrlsModal({
  event,
  password,
  onClose,
  onSaved,
}: {
  event: CatalogEvent;
  password: string;
  onClose: () => void;
  onSaved: (updated: CatalogEvent) => void;
}) {
  const existing = parsePlatformUrls(event);
  const [urls, setUrls] = useState<Record<string, string>>(
    Object.fromEntries(PLATFORMS.map(({ key }) => [key, (existing[key as keyof typeof existing] as string) ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const platform_urls: Record<string, string | null> = {};
    for (const { key } of PLATFORMS) {
      platform_urls[key] = urls[key].trim() || null;
    }
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ platform_urls }),
      });
      const d = await res.json();
      if (d.ok) {
        onSaved({ ...event, platform_urls: JSON.stringify(platform_urls) });
        onClose();
      } else {
        setError(d.error || 'Failed to save.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Edit Platform URLs</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{event.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {PLATFORMS.map(({ key, fullName }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600 w-28 flex-shrink-0">{fullName}</span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="w-3.5 flex-shrink-0 text-center">
                  {urls[key].trim() ? (
                    <span className="text-green-500 text-xs font-bold">✓</span>
                  ) : (
                    <span className="text-slate-200 text-xs">—</span>
                  )}
                </div>
                <input
                  type="url"
                  value={urls[key]}
                  onChange={(e) => setUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`${fullName} event URL…`}
                  className="flex-1 text-xs text-slate-900 rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-300"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
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
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save URLs'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventCatalogTab({ password }: Props) {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CatalogEvent | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/events', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setEvents(d.events);
      })
      .catch(() => setError('Failed to load events.'))
      .finally(() => setLoading(false));
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (event: CatalogEvent) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ is_active: !event.is_active }),
      });
      const d = await res.json();
      if (d.ok) {
        setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_active: event.is_active ? 0 : 1 } : e)));
      } else {
        setActionError(d.error || 'Failed to update event.');
      }
    } catch {
      setActionError('Network error while updating event.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${pendingDelete.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      });
      const d = await res.json();
      if (d.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== pendingDelete.id));
        setPendingDelete(null);
      } else {
        setActionError(d.error || 'Failed to remove event.');
      }
    } catch {
      setActionError('Network error while removing event.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
  );

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{actionError}</div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🎟</p>
          <p className="text-sm">No events in the catalog yet.</p>
          <p className="text-sm">Go to <strong>Add Events</strong> to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </p>
            <button onClick={load} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Refresh
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 px-4 py-3">
                {event.image_url ? (
                  <img src={event.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-100" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xl">🎵</div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate text-sm">{event.title}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {[event.venue, event.city, event.state].filter(Boolean).join(', ')}
                    {event.event_date && ` · ${formatDate(event.event_date)}`}
                  </p>
                  <PlatformDots event={event} />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Edit platform URLs */}
                  <button
                    onClick={() => { setActionError(null); setEditingEvent(event); }}
                    title="Edit platform URLs"
                    className="text-slate-300 hover:text-indigo-500 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>
                    </svg>
                  </button>

                  {/* Active/Inactive toggle */}
                  <button
                    onClick={() => toggleActive(event)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      event.is_active
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {event.is_active ? 'Active' : 'Inactive'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => { setActionError(null); setPendingDelete(event); }}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    title="Remove event"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6 2a1 1 0 00-1 1v.5H3a.5.5 0 000 1h.5v8A1.5 1.5 0 005 14h6a1.5 1.5 0 001.5-1.5v-8H13a.5.5 0 000-1h-2V3a1 1 0 00-1-1H6zm0 1h4v.5H6V3zm-1 2h6v8A.5.5 0 0110.5 13h-5a.5.5 0 01-.5-.5V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit URLs modal */}
      {editingEvent && (
        <EditUrlsModal
          event={editingEvent}
          password={password}
          onClose={() => setEditingEvent(null)}
          onSaved={(updated) => {
            setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setEditingEvent(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setPendingDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Remove this event?</h3>
            <p className="text-sm text-slate-600 mb-1 font-medium truncate">{pendingDelete.title}</p>
            <p className="text-sm text-slate-400 mb-5">
              {[pendingDelete.venue, pendingDelete.city].filter(Boolean).join(', ')}
              {pendingDelete.event_date && ` · ${formatDate(pendingDelete.event_date)}`}
            </p>
            <p className="text-xs text-slate-400 mb-6">
              This will remove the event from the platform. Ticket data won&apos;t be affected until
              the cache expires.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
