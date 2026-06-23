'use client';

import { useEffect, useState, useCallback } from 'react';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import type { PlatformConnectionResult } from '@/app/api/admin/events/[id]/check-connections/route';

interface Props {
  password: string;
}

type ConnectionState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; results: PlatformConnectionResult[] };

type PlatformSearchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'found'; url: string }
  | { phase: 'candidates'; list: Array<{ url: string; label: string }> }
  | { phase: 'not_found' }
  | { phase: 'manual'; value: string };

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventCatalogTab({ password }: Props) {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Connection checker state
  const [connections, setConnections] = useState<Record<number, ConnectionState>>({});
  // Platform URL search state: key is `${eventId}:${platformKey}`
  const [platformSearches, setPlatformSearches] = useState<Record<string, PlatformSearchState>>({});

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
        setConnections((prev) => { const n = { ...prev }; delete n[pendingDelete.id]; return n; });
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

  const checkConnections = async (event: CatalogEvent) => {
    const isOpen = connections[event.id]?.phase === 'done' || connections[event.id]?.phase === 'loading';
    if (isOpen && connections[event.id]?.phase !== 'loading') {
      // Toggle off
      setConnections((prev) => { const n = { ...prev }; delete n[event.id]; return n; });
      return;
    }
    setConnections((prev) => ({ ...prev, [event.id]: { phase: 'loading' } }));
    try {
      const res = await fetch(`/api/admin/events/${event.id}/check-connections`, {
        headers: { 'x-admin-password': password },
      });
      const d = await res.json();
      if (d.error) {
        setConnections((prev) => ({ ...prev, [event.id]: { phase: 'done', results: [] } }));
      } else {
        setConnections((prev) => ({ ...prev, [event.id]: { phase: 'done', results: d.results } }));
      }
    } catch {
      setConnections((prev) => ({ ...prev, [event.id]: { phase: 'done', results: [] } }));
    }
  };

  const searchPlatformUrl = async (event: CatalogEvent, platformKey: string) => {
    const searchKey = `${event.id}:${platformKey}`;
    setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'loading' } }));

    try {
      const res = await fetch('/api/admin/platform-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          platform: platformKey,
          title: event.title,
          artist: event.artist,
          venue: event.venue,
          city: event.city,
          state: event.state,
          event_date: event.event_date,
          ticketmaster_id: event.ticketmaster_id,
          seatgeek_id: event.seatgeek_id,
          source_url: event.source_url,
        }),
      });
      const d = await res.json();
      if (d.found && d.url) {
        await savePlatformUrl(event, platformKey, d.url);
        setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'found', url: d.url } }));
        // Re-run connection check
        checkConnections(event);
      } else if (d.candidates?.length) {
        setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'candidates', list: d.candidates } }));
      } else {
        setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'not_found' } }));
      }
    } catch {
      setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'not_found' } }));
    }
  };

  const savePlatformUrl = async (event: CatalogEvent, platformKey: string, url: string) => {
    const currentUrls = parsePlatformUrls(event);
    const updated = { ...currentUrls, [platformKey]: url };
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ platform_urls: updated }),
    });
    if ((await res.json()).ok) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, platform_urls: JSON.stringify(updated) } : e
        )
      );
    }
  };

  const pickCandidate = async (event: CatalogEvent, platformKey: string, url: string) => {
    const searchKey = `${event.id}:${platformKey}`;
    await savePlatformUrl(event, platformKey, url);
    setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'found', url } }));
    checkConnections(event);
  };

  const saveManualUrl = async (event: CatalogEvent, platformKey: string, url: string) => {
    if (!url.trim()) return;
    const searchKey = `${event.id}:${platformKey}`;
    await savePlatformUrl(event, platformKey, url.trim());
    setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'found', url: url.trim() } }));
    checkConnections(event);
  };

  const setManualMode = (eventId: number, platformKey: string) => {
    const searchKey = `${eventId}:${platformKey}`;
    setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'manual', value: '' } }));
  };

  const updateManualValue = (eventId: number, platformKey: string, value: string) => {
    const searchKey = `${eventId}:${platformKey}`;
    setPlatformSearches((prev) => ({ ...prev, [searchKey]: { phase: 'manual', value } }));
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
            {events.map((event) => {
              const connState = connections[event.id];
              const isExpanded = connState?.phase === 'done' || connState?.phase === 'loading';

              return (
                <div key={event.id}>
                  {/* Main event row */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xl">🎵</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{event.title}</p>
                      <p className="text-sm text-slate-500 truncate">
                        {[event.venue, event.city, event.state].filter(Boolean).join(', ')}
                        {event.event_date && ` · ${formatDate(event.event_date)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => checkConnections(event)}
                        disabled={connState?.phase === 'loading'}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          isExpanded
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        } disabled:opacity-40`}
                      >
                        {connState?.phase === 'loading' ? 'Checking…' : isExpanded ? 'Collapse' : 'Check Connections'}
                      </button>

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

                  {/* Connection results panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-50 bg-slate-50/60 px-4 py-3">
                      {connState.phase === 'loading' ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                          <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Running connection checks for all platforms…
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {connState.results.map((r) => {
                            const searchKey = `${event.id}:${r.key}`;
                            const search = platformSearches[searchKey] ?? { phase: 'idle' };
                            return (
                              <ConnectionRow
                                key={r.key}
                                result={r}
                                searchState={search}
                                onSearch={() => searchPlatformUrl(event, r.key)}
                                onPickCandidate={(url) => pickCandidate(event, r.key, url)}
                                onManualMode={() => setManualMode(event.id, r.key)}
                                onManualChange={(v) => updateManualValue(event.id, r.key, v)}
                                onManualSave={(v) => saveManualUrl(event, r.key, v)}
                              />
                            );
                          })}
                          <button
                            onClick={() => checkConnections(event)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 pt-1 font-medium"
                          >
                            Re-run checks
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

function ConnectionRow({
  result,
  searchState,
  onSearch,
  onPickCandidate,
  onManualMode,
  onManualChange,
  onManualSave,
}: {
  result: PlatformConnectionResult;
  searchState: PlatformSearchState;
  onSearch: () => void;
  onPickCandidate: (url: string) => void;
  onManualMode: () => void;
  onManualChange: (v: string) => void;
  onManualSave: (v: string) => void;
}) {
  const icon =
    result.status === 'connected' ? '✅' :
    result.status === 'no_url' ? '⚠️' : '❌';

  const summaryColor =
    result.status === 'connected' ? 'text-green-700' :
    result.status === 'no_url' ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm w-4 flex-shrink-0 mt-px">{icon}</span>
      <span className="text-xs font-medium text-slate-700 w-24 flex-shrink-0 pt-0.5">{result.platform}</span>
      <div className="flex-1 min-w-0">
        {searchState.phase === 'loading' ? (
          <span className="text-xs text-slate-400">Searching…</span>
        ) : searchState.phase === 'found' ? (
          <span className="text-xs text-green-600 font-medium">URL saved — re-running check…</span>
        ) : searchState.phase === 'candidates' ? (
          <div className="space-y-0.5">
            <p className="text-xs text-amber-600 font-medium">{searchState.list.length} matches — pick one:</p>
            {searchState.list.map((c) => (
              <button
                key={c.url}
                onClick={() => onPickCandidate(c.url)}
                className="block text-xs text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-sm"
                title={c.url}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : searchState.phase === 'not_found' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Not found automatically.</span>
            <button onClick={onManualMode} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
              Paste URL
            </button>
          </div>
        ) : searchState.phase === 'manual' ? (
          <div className="flex gap-1.5 max-w-sm">
            <input
              type="url"
              value={searchState.value}
              onChange={(e) => onManualChange(e.target.value)}
              placeholder="Paste event URL…"
              className="flex-1 text-xs text-slate-900 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onManualSave(searchState.value)}
            />
            <button
              onClick={() => onManualSave(searchState.value)}
              className="text-xs text-indigo-600 font-medium px-2 py-1 rounded border border-indigo-300 hover:bg-indigo-50 flex-shrink-0"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${summaryColor}`}>{result.summary}</span>
            {result.status === 'no_url' && (
              <button onClick={onSearch} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex-shrink-0">
                Search
              </button>
            )}
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                View ↗
              </a>
            )}
            <button
              onClick={onManualMode}
              className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              {result.status === 'no_url' ? 'Paste URL' : 'Edit URL'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
