import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult } from './types';
import { googleSearchFirstUrl } from '@/lib/google-search';

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'gametime.co');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'gametime.co');
}

export async function fetchListings(event: CatalogEvent): Promise<SourceResult> {
  const urls = parsePlatformUrls(event);
  const storedUrl = urls.gametime;
  return {
    platform: 'Gametime',
    listings: [],
    error: storedUrl
      ? `Gametime scraper temporarily disabled. View at: ${storedUrl}`
      : 'Gametime scraper temporarily disabled',
  };
}
