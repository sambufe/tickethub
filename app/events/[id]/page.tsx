import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import TicketListings from './TicketListings';
import EventAnalytics from './EventAnalytics';

function getEvent(id: string): CatalogEvent | null {
  const db = getDb();
  return (
    (db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CatalogEvent | null) ?? null
  );
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = getEvent(id);

  if (!event) notFound();

  const location = [event.venue, [event.city, event.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

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

      {/* Event hero */}
      <div className="bg-slate-900 relative overflow-hidden">
        {event.image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm scale-105"
            style={{ backgroundImage: `url(${event.image_url})` }}
          />
        )}
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 010 1.06L7.06 8l2.72 2.72a.75.75 0 11-1.06 1.06L5.47 8.53a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z" />
            </svg>
            Back to events
          </Link>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {event.image_url && (
              <img
                src={event.image_url}
                alt={event.title}
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover flex-shrink-0 shadow-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              {event.artist && event.artist !== event.title && (
                <p className="text-indigo-400 text-sm font-semibold uppercase tracking-wide mb-1">
                  {event.artist}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
                {event.title}
              </h1>
              <div className="space-y-1.5">
                {location && (
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M8 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM2 6a6 6 0 1110.174 4.31l3.008 3.007a.75.75 0 11-1.06 1.06l-3.007-3.007A6 6 0 012 6z" clipRule="evenodd" />
                    </svg>
                    {location}
                  </div>
                )}
                {event.event_date && (
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.75 7.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />
                      <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 014.75 2h6.5A2.75 2.75 0 0114 4.75v6.5A2.75 2.75 0 0111.25 14h-6.5A2.75 2.75 0 012 11.25v-6.5zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25h-6.5z" clipRule="evenodd" />
                    </svg>
                    {formatDateTime(event.event_date)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket listings */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <TicketListings eventId={String(event.id)} />
      </main>
      <EventAnalytics event={event} />
    </div>
  );
}
