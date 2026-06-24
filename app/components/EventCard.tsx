'use client';

import Link from 'next/link';
import { CatalogEvent } from '@/lib/types';
import { posthog } from '@/lib/posthog';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return time === '12:00 AM' ? '' : time;
}

export default function EventCard({ event }: { event: CatalogEvent }) {
  const time = formatTime(event.event_date);
  const location = [event.venue, [event.city, event.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block"
      onClick={() => posthog.capture('event_card_clicked', {
        event_id: event.id,
        event_title: event.title,
      })}
    >
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-video bg-slate-100 overflow-hidden">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-30">🎵</span>
            </div>
          )}
          {/* Date badge */}
          {event.event_date && (
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
              {formatDate(event.event_date)}
              {time && <span className="text-slate-500 font-normal ml-1">· {time}</span>}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {event.artist && event.artist !== event.title && (
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
              {event.artist}
            </p>
          )}
          <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2 mb-1.5">
            {event.title}
          </h3>
          {location && (
            <p className="text-sm text-slate-500 line-clamp-1">{location}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">View tickets →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
