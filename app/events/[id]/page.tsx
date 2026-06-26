import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import TicketListings from './TicketListings';
import EventAnalytics from './EventAnalytics';
import NYPPanel from './NYPPanel';
import ChicketsNav from '@/app/components/ChicketsNav';
import ChicketsFooter from '@/app/components/ChicketsFooter';

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
    <>
    <div style={{ background: '#FFF8E1', color: '#1A1A2E' }}>
      <ChicketsNav />
      <main className="max-w-[1240px] mx-auto px-6 sm:px-10 py-7 pb-16">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold text-sm text-chk-navy mb-5 no-underline"
        >
          <span className="w-7 h-7 rounded-full bg-white border-[2.5px] border-chk-navy flex items-center justify-center text-sm">
            ←
          </span>
          All results
        </Link>

        {/* Event header band */}
        <div
          className="relative rounded-[22px] overflow-hidden p-7 sm:p-9 mb-7 border-[3px] border-chk-navy"
          style={{ background: '#FFD93D', boxShadow: '6px 6px 0 #1A1A2E' }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#1A1A2E 1.3px, transparent 1.3px)',
              backgroundSize: '22px 22px',
            }}
          />
          {event.image_url && (
            <img
              src={event.image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm"
            />
          )}
          <div className="relative flex items-center gap-5 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="inline-block bg-chk-navy text-chk-yellow text-[12px] font-extrabold px-3 py-1 rounded-full mb-3">
                LIVE PRICES
              </div>
              {event.artist && event.artist !== event.title && (
                <p className="text-[14px] font-bold text-chk-navy mb-1" style={{ opacity: 0.7 }}>
                  {event.artist}
                </p>
              )}
              <h1 className="font-baloo font-extrabold text-[38px] sm:text-[42px] leading-none tracking-tight text-chk-navy mb-3">
                {event.title}
              </h1>
              <div className="flex gap-4 flex-wrap text-[15px] font-semibold" style={{ color: '#2A2A40' }}>
                {location && <span>📍 {location}</span>}
                {event.event_date && <span>🗓️ {formatDateTime(event.event_date)}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Two-column: ticket table left, NYP panel right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_.95fr] gap-6 items-start">
          <TicketListings eventId={String(event.id)} />
          <div>
            <NYPPanel eventId={String(event.id)} eventTitle={event.title} />
          </div>
        </div>
      </main>
      <EventAnalytics event={event} />
    </div>
    <ChicketsFooter />
    </>
  );
}
