export interface EventResult {
  id: string;
  source: 'ticketmaster' | 'seatgeek' | 'both';
  title: string;
  artist: string;
  venue: string;
  city: string;
  state: string;
  event_date: string;
  image_url: string;
  ticketmaster_id?: string;
  seatgeek_id?: string;
  source_url?: string;
  alreadyAdded: boolean;
}

export interface CatalogEvent {
  id: number;
  canonical_id: string | null;
  title: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  event_date: string | null;
  ticketmaster_id: string | null;
  seatgeek_id: string | null;
  source_url: string | null;
  platform_urls: string | null; // JSON-encoded PlatformUrls
  image_url: string | null;
  added_at: string;
  is_active: number;
}

export interface PlatformUrls {
  ticketmaster?: string | null;
  seatgeek?: string | null;
  stubhub?: string | null;
  vividseats?: string | null;
  axs?: string | null;
  gametime?: string | null;
  tickpick?: string | null;
}

export function parsePlatformUrls(event: CatalogEvent): PlatformUrls {
  if (!event.platform_urls) return {};
  try {
    return JSON.parse(event.platform_urls) as PlatformUrls;
  } catch {
    return {};
  }
}

export interface UsageStats {
  credits_used_month: number;
  credits_total: number;
  events_tracked: number;
  events_active: number;
}
