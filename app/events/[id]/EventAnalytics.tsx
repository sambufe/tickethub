'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import { CatalogEvent } from '@/lib/types';

export default function EventAnalytics({ event }: { event: CatalogEvent }) {
  useEffect(() => {
    posthog.capture('event_viewed', {
      event_id: event.id,
      event_title: event.title,
      artist: event.artist,
      venue: event.venue,
      city: event.city,
      event_date: event.event_date,
    });
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
