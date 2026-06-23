import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult } from './types';
import { googleSearchFirstUrl } from '@/lib/google-search';

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'seatgeek.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'seatgeek.com');
}

export async function fetchListings(event: CatalogEvent): Promise<SourceResult> {
  const urls = parsePlatformUrls(event);
  const storedUrl = urls.seatgeek;
  return {
    platform: 'SeatGeek',
    listings: [],
    error: storedUrl
      ? `SeatGeek scraper temporarily disabled. View at: ${storedUrl}`
      : 'SeatGeek scraper temporarily disabled',
  };
}
