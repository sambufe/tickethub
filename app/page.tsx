import { Suspense } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import SearchBar from '@/app/components/SearchBar';
import EventCard from '@/app/components/EventCard';

function getEvents(q?: string): CatalogEvent[] {
  const db = getDb();
  if (q?.trim()) {
    return db
      .prepare(
        `SELECT * FROM events
         WHERE is_active = 1
           AND (title LIKE ? OR artist LIKE ? OR venue LIKE ? OR city LIKE ?)
         ORDER BY event_date ASC`
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as CatalogEvent[];
  }
  return db
    .prepare(`SELECT * FROM events WHERE is_active = 1 ORDER BY event_date ASC`)
    .all() as CatalogEvent[];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const events = getEvents(q);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl">🎟</span>
          <span className="font-bold text-white text-lg tracking-tight">TicketHub</span>
        </Link>
        <Link
          href="/admin"
          className="text-xs text-slate-400 hover:text-white transition-colors font-medium"
        >
          Admin ↗
        </Link>
      </header>

      {/* Hero / Search */}
      <div className="bg-slate-900 px-6 pb-12 pt-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Find the best ticket prices
        </h1>
        <p className="text-slate-400 mb-8 text-base">
          Compare prices across all major platforms in one place
        </p>
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {/* Events grid */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            {q ? `Results for "${q}"` : 'Upcoming Events'}
          </h2>
          {events.length > 0 && (
            <span className="text-sm text-slate-500">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {events.length === 0 ? (
          <EmptyState q={q} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ q }: { q?: string }) {
  return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🎵</span>
      {q ? (
        <>
          <p className="text-slate-600 font-medium mb-1">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-slate-400 text-sm">
            Try a different search, or{' '}
            <Link href="/" className="text-indigo-600 hover:underline">
              browse all events
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          <p className="text-slate-600 font-medium mb-1">No events yet</p>
          <p className="text-slate-400 text-sm">
            Head to the{' '}
            <Link href="/admin" className="text-indigo-600 hover:underline">
              Admin panel
            </Link>{' '}
            to add events to the catalog.
          </p>
        </>
      )}
    </div>
  );
}
