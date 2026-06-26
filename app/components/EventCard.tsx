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

export default function EventCard({ event }: { event: CatalogEvent }) {
  const band = BAND_COLORS[event.id % 4];
  const genreLabel = (event.artist && event.artist !== event.title ? event.artist : 'LIVE CONCERT').toUpperCase();
  const location = [event.venue, [event.city, event.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/events/${event.id}`}
      className="block no-underline group"
      onClick={() => posthog.capture('event_card_clicked', { event_id: event.id, event_title: event.title })}
    >
      <div
        className="bg-white rounded-[18px] overflow-hidden border-[3px] border-chk-navy transition-transform duration-100 hover:-translate-y-0.5"
        style={{ boxShadow: '5px 5px 0 #1A1A2E' }}
      >
        {/* Header band */}
        <div
          className="relative h-32 flex items-end p-3.5 border-b-[3px] border-chk-navy overflow-hidden"
          style={{ background: band.bg }}
        >
          {event.image_url && (
            <img
              src={event.image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-[2px] scale-105"
            />
          )}
          {event.event_date && (
            <span className="absolute top-3 right-3 bg-white border-[2px] border-chk-navy text-chk-navy text-[11px] font-extrabold px-2.5 py-0.5 rounded-full z-10">
              {formatDate(event.event_date)}
            </span>
          )}
          <span className="relative font-baloo font-bold text-[13px] z-10" style={{ color: band.text, opacity: 0.9 }}>
            {genreLabel}
          </span>
        </div>

        {/* Card body */}
        <div className="p-4">
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
          <div className="h-px my-3" style={{ background: '#EFE6C8' }} />
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9A8F66' }}>From</div>
              <div className="font-baloo font-extrabold text-2xl leading-none text-chk-orange">Compare →</div>
              <div className="text-[11px] font-semibold mt-1" style={{ color: '#9A8F66' }}>tap to compare all sites</div>
            </div>
            <span
              className="w-9 h-9 rounded-full bg-chk-yellow border-[2.5px] border-chk-navy flex items-center justify-center font-extrabold text-lg text-chk-navy"
            >
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
