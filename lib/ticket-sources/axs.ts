import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult } from './types';
import { googleSearchFirstUrl } from '@/lib/google-search';

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'axs.com');
  // AXS event URLs are /events/{id}/{slug} — filter out promo and venue sub-paths
  if (url && /axs\.com\/events\/\d+\/[^/]+\/?$/.test(url.replace(/\/$/, ''))) return [url];
  return [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  const candidates = await findEventCandidates(event);
  return candidates[0] ?? null;
}

export async function fetchListings(event: CatalogEvent): Promise<SourceResult> {
  const urls = parsePlatformUrls(event);
  const storedUrl = urls.axs;
  return {
    platform: 'AXS',
    listings: [],
    error: storedUrl
      ? `AXS scraper temporarily disabled. View at: ${storedUrl}`
      : 'AXS scraper temporarily disabled',
  };
}
