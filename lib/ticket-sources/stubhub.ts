import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult } from './types';
import { googleSearchFirstUrl } from '@/lib/google-search';

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'stubhub.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'stubhub.com');
}

export async function fetchListings(event: CatalogEvent): Promise<SourceResult> {
  const urls = parsePlatformUrls(event);
  const storedUrl = urls.stubhub;
  return {
    platform: 'StubHub',
    listings: [],
    error: storedUrl
      ? `StubHub scraper temporarily disabled. View at: ${storedUrl}`
      : 'StubHub scraper temporarily disabled',
  };
}
