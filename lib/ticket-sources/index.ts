import { CatalogEvent } from '@/lib/types';
import { TicketListing, SourceResult } from './types';
// import { fetchListings as fromTicketmaster } from './ticketmaster'; // disabled: blocked by TM EPS
import { fetchListings as fromVividSeats } from './vividseats';
import { fetchListings as fromTickPick } from './tickpick';
import { fetchListings as fromGametime } from './gametime';
import { fetchListings as fromStubHub } from './stubhub';
// import { fetchListings as fromSeatGeek } from './seatgeek'; // disabled: no active integration

export interface AggregatedResult {
  listings: TicketListing[];
  sources: SourceResult[];
}

function wrap(platform: string, fn: () => Promise<SourceResult>): Promise<SourceResult> {
  return fn().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tickets] ${platform} error:`, msg);
    return { platform, listings: [], error: msg };
  });
}

export async function fetchAllListings(event: CatalogEvent, qty = 2): Promise<AggregatedResult> {
  const results = await Promise.all([
    // wrap('Ticketmaster', () => fromTicketmaster(event, qty)), // disabled: blocked by TM EPS
    wrap('VividSeats',  () => fromVividSeats(event, qty)),
    wrap('TickPick',    () => fromTickPick(event, qty)),
    wrap('Gametime',    () => fromGametime(event, qty)),
    wrap('StubHub',     () => fromStubHub(event, qty)),
    // wrap('SeatGeek',    () => fromSeatGeek(event, qty)), // disabled: no active integration
  ]);

  const listings: TicketListing[] = results
    .flatMap((s) => s.listings)
    .sort((a, b) => a.all_in_price - b.all_in_price);

  return { listings, sources: results };
}

export type { TicketListing, SourceResult };
