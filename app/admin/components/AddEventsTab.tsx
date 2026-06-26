'use client';

import { useState, useCallback } from 'react';
import { EventResult } from '@/lib/types';
import EventConfirmModal from './EventConfirmModal';

interface Props {
  password: string;
}

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: 'TM',
  seatgeek: 'SG',
  both: 'TM + SG',
};

const SOURCE_COLORS: Record<string, string> = {
  ticketmaster: 'bg-blue-100 text-blue-700',
  seatgeek: 'bg-red-100 text-red-700',
  both: 'bg-purple-100 text-purple-700',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
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

export default function AddEventsTab({ password }: Props) {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [results, setResults] = useState<EventResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const [confirming, setConfirming] = useState<EventResult | null>(null);

  const doSearch = useCallback(async (page: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setSearched(false); }
    if (!append) setResults([]);
    setErrors([]);

    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (city) params.set('city', city);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (page > 0) params.set('page', String(page));

    try {
      const res = await fetch(`/api/admin/search?${params}`, {
        headers: { 'x-admin-password': password },
      });
      const data = await res.json();
      setResults((prev) => append ? [...prev, ...(data.results || [])] : (data.results || []));
      setErrors(data.errors || []);
      setHasMore(!!data.has_more);
      setCurrentPage(page);
    } catch {
      setErrors(['Failed to reach search API. Is the dev server running?']);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setSearched(true);
    }
  }, [keyword, city, dateFrom, dateTo, password]);

  const handleSearch = useCallback(() => doSearch(0, false), [doSearch]);
  const handleLoadMore = useCallback(() => doSearch(currentPage + 1, true), [doSearch, currentPage]);

  const handleAdded = (eventResultId: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === eventResultId ? { ...r, alreadyAdded: true } : r))
    );
    setConfirming(null);
  };

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Search Events</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Artist or Event Name
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. Taylor Swift, Coachella…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Los Angeles"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {loading ? 'Searching…' : 'Search Events'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* API errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-amber-800">⚠ {e}</p>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div>
          <p className="text-sm text-slate-500 mb-3">
            {results.length === 0
              ? 'No results found.'
              : `${results.length} event${results.length !== 1 ? 's' : ''} found — click one to add it`}
          </p>

          <div className="space-y-3">
            {results.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => !event.alreadyAdded && setConfirming(event)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 font-medium rounded-lg px-6 py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading more…' : 'Load more results'}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">Searching Ticketmaster + SeatGeek…</span>
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-base font-medium text-slate-500">Search for an event to get started</p>
          <p className="text-sm mt-1">Enter an artist name or event above and click Search Events</p>
        </div>
      )}

      {/* Confirmation modal */}
      <EventConfirmModal
        event={confirming}
        password={password}
        onClose={() => setConfirming(null)}
        onAdded={handleAdded}
      />
    </div>
  );
}

function EventCard({ event, onClick }: { event: EventResult; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${
        event.alreadyAdded
          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-default'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      {/* Thumbnail */}
      {event.image_url ? (
        <img
          src={event.image_url}
          alt=""
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-slate-100"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center">
          <span className="text-2xl">🎵</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-slate-900 leading-snug">{event.title}</p>
            {event.artist && event.artist !== event.title && (
              <p className="text-sm text-slate-500 mt-0.5">{event.artist}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[event.source]}`}>
              {SOURCE_LABELS[event.source]}
            </span>
            {event.alreadyAdded ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Added
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Click to add →</span>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>{[event.venue, event.city, event.state].filter(Boolean).join(', ')}</span>
          <span className="text-slate-400">·</span>
          <span>{formatDate(event.event_date)}</span>
        </div>
      </div>
    </div>
  );
}
