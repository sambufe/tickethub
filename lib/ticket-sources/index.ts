import { CatalogEvent } from '@/lib/types';
import { TicketListing, SourceResult } from './types';
import { fetchListings as fromTicketmaster } from './ticketmaster';
import { fetchListings as fromVividSeats } from './vividseats';
import { fetchListings as fromTickPick } from './tickpick';
import { fetchListings as fromGametime } from './gametime';
import { fetchListings as fromStubHub } from './stubhub';

export interface AggregatedResult {
  listings: TicketListing[];
  sources: SourceResult[];
}

export async function fetchAllListings(event: CatalogEvent, qty = 2): Promise<AggregatedResult> {
  const settled = await Promise.allSettled([
    fromTicketmaster(event, qty),
    fromVividSeats(event, qty),
    fromTickPick(event, qty),
    fromGametime(event, qty),
    fromStubHub(event, qty),
  ]);

  const sources: SourceResult[] = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { platform: 'Unknown', listings: [], error: String((r as PromiseRejectedResult).reason) }
  );

  const listings: TicketListing[] = sources
    .flatMap((s) => s.listings)
    .sort((a, b) => a.all_in_price - b.all_in_price);

  return { listings, sources };
}

export type { TicketListing, SourceResult };
