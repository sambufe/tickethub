'use client';

import Link from 'next/link';
import { CatalogEvent } from '@/lib/types';
import { posthog } from '@/lib/posthog';

const BAND_COLORS = [
  { bg: '#1A1A2E', text: '#FFD93D' },
  { bg: '#FF6B35', text: '#1A1A2E' },
  { bg: '#E8C200', text: '#1A1A2E' },
  { bg: '#2A2A48', text: '#FFD93D' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EventCard({ event, lowestPrice, platformCount }: { event: CatalogEvent; lowestPrice?: number | null; platformCount?: number }) {
  const band = BAND_COLORS[event.id % 4];
  const genreLabel = (event.artist && event.artist !== event.title ? event.artist : 'LIVE CONCERT').toUpperCase();
  const location = [event.venue, [event.city, event.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/events/${event.id}`}
      className="block h-full no-underline group"
      onClick={() => posthog.capture('event_card_clicked', { event_id: event.id, event_title: event.title })}
    >
      <div
        className="h-full flex flex-col bg-white rounded-[18px] overflow-hidden border-[3px] border-chk-navy transition-transform duration-100 hover:-translate-y-0.5"
        style={{ boxShadow: '5px 5px 0 #1A1A2E' }}
      >
        {/* Header band — fixed height, image dominant */}
        <div
          className="relative h-36 flex-shrink-0 flex items-end p-3.5 border-b-[3px] border-chk-navy overflow-hidden"
          style={{ background: band.bg }}
        >
          {event.image_url && (
            <img
              src={event.image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-75"
            />
          )}
          {/* Gradient scrim so genre label stays readable over any image */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)' }}
          />
          {event.event_date && (
            <span className="absolute top-3 right-3 bg-white border-[2px] border-chk-navy text-chk-navy text-[11px] font-extrabold px-2.5 py-0.5 rounded-full z-10">
              {formatDate(event.event_date)}
            </span>
          )}
          <span className="relative font-baloo font-bold text-[13px] text-white z-10 drop-shadow">
            {genreLabel}
          </span>
        </div>

        {/* Card body — grows to fill row height, pushes CTA to bottom */}
        <div className="flex-1 flex flex-col p-4">
          <h3 className="font-baloo font-bold text-[19px] leading-tight text-chk-navy mb-1.5 line-clamp-2">
            {event.title}
          </h3>
          {location && (
            <div className="text-[13.5px] font-semibold text-chk-muted mb-1 truncate">{location}</div>
          )}
          {event.event_date && (
            <div className="text-[13.5px] font-semibold text-chk-muted">
              {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </div>
          )}
          <div className="mt-auto">
            <div style={{ height: 1, background: '#EFE6C8', margin: '13px 0 11px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#9A8F66' }}>From</div>
                {lowestPrice ? (
                  <>
                    <div className="font-baloo" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, color: '#FF6B35' }}>
                      ${Math.ceil(lowestPrice)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9A8F66', marginTop: 3 }}>
                      {platformCount ?? 1} price{platformCount !== 1 ? 's' : ''} compared
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-baloo" style={{ fontWeight: 800, fontSize: 20, lineHeight: 1, color: '#1A1A2E', opacity: 0.4 }}>
                      —
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9A8F66', marginTop: 3 }}>
                      tap to compare
                    </div>
                  </>
                )}
              </div>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFD93D', border: '2.5px solid #1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#1A1A2E', flexShrink: 0 }}>
                →
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
