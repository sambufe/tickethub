import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult, TicketListing } from './types';
import { googleSearchFirstUrl } from '@/lib/google-search';
import { normalizeSection } from '@/lib/utils/normalize-section';

const API_TIMEOUT_MS = 10_000;
const MOBILE_API = 'https://mobile.gametime.co/v1/listings';

interface GTPrice {
  prefee: number;  // listed price in cents
  total: number;   // all-in price in cents
  face_value?: number;
}

interface GTListing {
  id: string;
  row: string;
  section: string;
  section_group: string;
  lots: number[];   // allowed purchase quantities, e.g. [2,4] means buy 2 or 4 only
  seats: string[];  // one entry per available ticket; length = total qty in listing
  price: GTPrice;
  event_id: string;
}

interface GTPayload {
  listings?: GTListing[];
}

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'gametime.co');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'gametime.co');
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  const platformUrls = parsePlatformUrls(event);
  const storedUrl = platformUrls.gametime;

  if (!storedUrl) {
    return { platform: 'Gametime', listings: [], error: 'No Gametime URL stored — add via admin panel' };
  }

  const eventId = storedUrl.match(/\/events\/([a-f0-9]+)/)?.[1];
  if (!eventId) {
    return { platform: 'Gametime', listings: [], error: 'Could not extract event ID from Gametime URL' };
  }

  let payload: GTPayload | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const res = await fetch(`${MOBILE_API}?event_id=${eventId}`, {
      headers: {
        'User-Agent': 'Gametime/6.0 (iPhone; iOS 17.0)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { platform: 'Gametime', listings: [], error: `API returned ${res.status}` };
    }
    payload = (await res.json()) as GTPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'Gametime', listings: [], error: `API error: ${msg}` };
  }

  const items = payload?.listings ?? [];
  if (items.length === 0) {
    return { platform: 'Gametime', listings: [], error: 'No listings found' };
  }

  const listings: TicketListing[] = [];
  for (const t of items) {
    // `lots` lists the exact quantities a buyer may purchase from this listing.
    // A listing with lots=[1,3] can be bought as 1 or 3 tickets, NOT as 2.
    // Gametime does not allow partial purchases unless the seller opted in via splits.
    const canBuy = t.lots.includes(qty);
    if (!canBuy) continue;

    const listed_price = t.price.prefee / 100;
    const all_in_price = t.price.total / 100;
    if (!listed_price || !all_in_price) continue;

    listings.push({
      platform: 'Gametime',
      section: normalizeSection([t.section_group, t.section].filter(Boolean).join(' ')),
      row: t.row,
      quantity: t.seats.length,
      listed_price,
      estimated_fees: all_in_price > listed_price ? Math.round((all_in_price - listed_price) * 100) / 100 : 0,
      all_in_price,
      url: storedUrl,
    });
  }

  if (listings.length === 0) {
    return { platform: 'Gametime', listings: [], error: `No listings available for qty=${qty}` };
  }

  listings.sort((a, b) => a.all_in_price - b.all_in_price);
  return { platform: 'Gametime', listings: [listings[0]] };
}
