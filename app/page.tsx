import { Suspense } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { CatalogEvent } from '@/lib/types';
import SearchBar from '@/app/components/SearchBar';
import EventCard from '@/app/components/EventCard';
import HomepageAnalytics from '@/app/components/HomepageAnalytics';
import ChicketsNav from '@/app/components/ChicketsNav';
import ChicketsFooter from '@/app/components/ChicketsFooter';
import ChicketsMascot from '@/app/components/ChicketsMascot';

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
    <>
    <div style={{ background: '#FFF8E1', color: '#1A1A2E' }}>
      <HomepageAnalytics />
      <ChicketsNav />

      {/* Hero */}
      <section
        className="relative border-b-[3px] border-chk-navy overflow-hidden"
        style={{ background: '#FFD93D' }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'radial-gradient(#1A1A2E 1.4px, transparent 1.4px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative max-w-[1240px] mx-auto px-6 sm:px-10 py-14 sm:py-20 grid grid-cols-1 sm:grid-cols-[1.15fr_.85fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-chk-navy text-chk-yellow text-[13px] font-bold px-4 py-1.5 rounded-full mb-5">
              <span className="w-2 h-2 rounded-full bg-chk-orange inline-block" />
              Every major resale site — one search
            </div>
            <h1 className="font-baloo font-extrabold text-[52px] sm:text-[62px] leading-[1.02] tracking-tight text-chk-navy mb-4">
              Spot the cheapest<br />seat in the house.
            </h1>
            <p className="text-[18px] leading-relaxed font-medium max-w-[480px] mb-7" style={{ color: '#2A2A40' }}>
              Chickets scans every major ticket marketplace at once, then sorts by price. Don&apos;t like what you see?{' '}
              <strong>Name your own price</strong> and let sellers come to you.
            </p>
            <Suspense>
              <SearchBar />
            </Suspense>
            <div className="flex gap-6 mt-5 flex-wrap">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: '#2A2A40' }}>
                🔍 All sites compared
              </div>
              <div className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: '#2A2A40' }}>
                🏷️ Fees shown upfront
              </div>
              <div className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: '#2A2A40' }}>
                ⚡ Set your own price
              </div>
            </div>
          </div>
          <div className="hidden sm:flex justify-center items-end">
            <ChicketsMascot size={300} />
          </div>
        </div>
      </section>

      {/* NYP slim bar */}
      <div className="max-w-[1240px] mx-auto px-6 sm:px-10 pt-8 pb-2">
        <div
          className="flex items-center gap-4 py-4 px-6 rounded-[16px]"
          style={{ background: '#1A1A2E', border: '3px solid #1A1A2E', boxShadow: '5px 5px 0 #1A1A2E' }}
        >
          <ChicketsMascot size={48} className="flex-shrink-0" />
          <p className="font-baloo font-extrabold text-white flex-1 m-0" style={{ fontSize: 17 }}>
            Don&apos;t chase the price. Name it.
          </p>
          <Link
            href="/alerts"
            className="font-baloo font-bold no-underline flex-shrink-0 rounded-full px-5 py-2"
            style={{ background: '#FFD93D', color: '#1A1A2E', fontSize: 14, border: '2px solid #FFD93D' }}
          >
            Try it →
          </Link>
        </div>
      </div>

      {/* Events grid */}
      <section className="max-w-[1240px] mx-auto px-6 sm:px-10 py-14">
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div>
            <h2 className="font-baloo font-extrabold text-[34px] tracking-tight text-chk-navy mb-1">
              {q ? `Results for "${q}"` : 'Trending near you'}
            </h2>
            <p className="text-[15px] font-medium text-chk-muted">
              {q
                ? `${events.length} event${events.length !== 1 ? 's' : ''} found`
                : 'Tap any event to compare prices across every site we track.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className={`text-[13px] font-bold px-4 py-2 rounded-full no-underline ${
                !q ? 'bg-chk-navy text-chk-yellow' : 'bg-white border-[2px] border-chk-navy text-chk-navy'
              }`}
            >
              All
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <EmptyState q={q} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>


    </div>
    <ChicketsFooter />
    </>
  );
}

function EmptyState({ q }: { q?: string }) {
  return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🐣</span>
      {q ? (
        <>
          <p className="font-semibold text-chk-navy mb-1">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-chk-muted text-sm">
            Try a different search, or{' '}
            <Link href="/" className="text-chk-orange hover:underline font-semibold">
              browse all events
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-chk-navy mb-1">No events yet</p>
          <p className="text-chk-muted text-sm">
            Head to the{' '}
            <Link href="/admin" className="text-chk-orange hover:underline font-semibold">
              Admin panel
            </Link>{' '}
            to add events to the catalog.
          </p>
        </>
      )}
    </div>
  );
}
