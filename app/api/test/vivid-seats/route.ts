import { fetchListings } from '@/lib/ticket-sources/vividseats';
import { CatalogEvent } from '@/lib/types';

// Hardcoded test event: Ed Sheeran at SoFi Stadium, Inglewood — productionId 6049710
const TEST_EVENT: CatalogEvent = {
  id: 0,
  title: 'Ed Sheeran',
  artist: 'Ed Sheeran',
  venue: 'SoFi Stadium',
  city: 'Inglewood',
  state: 'CA',
  event_date: '2026-08-08T00:00:00',
  ticketmaster_id: null,
  seatgeek_id: null,
  source_url: null,
  platform_urls: null,
  canonical_id: null,
  image_url: null,
  added_at: new Date().toISOString(),
  is_active: 1,
};

export async function GET() {
  const start = Date.now();
  const result = await fetchListings(TEST_EVENT);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  return Response.json({
    platform: result.platform,
    listing_count: result.listings.length,
    error: result.error ?? null,
    elapsed_seconds: elapsed,
    first_5: result.listings.slice(0, 5),
  });
}
