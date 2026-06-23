/**
 * SeatGeek scraper — injects a DataDome cookie and calls the internal
 * event_listings_v2 API endpoint directly (no full page load needed).
 *
 * How to get the DataDome cookie:
 *  1. Open seatgeek.com in Chrome
 *  2. Solve the CAPTCHA if shown
 *  3. Open DevTools → Application → Cookies → seatgeek.com
 *  4. Copy the value of the `datadome` cookie
 *  5. Paste into Admin → Dashboard → SeatGeek Cookie
 *
 * The cookie expires after ~7 days and must be refreshed when it does.
 */

import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult, TicketListing } from './types';
import { newPage } from '@/lib/browser';
import { googleSearchFirstUrl } from '@/lib/google-search';
import { normalizeSection } from '@/lib/utils/normalize-section';

// SeatGeek's fixed web-app client ID (base64 "1662|1383320158")
const SG_CLIENT_ID = 'MTY2MnwxMzgzMzIwMTU4';
const API_TIMEOUT_MS = 15_000;

interface SGPriceObject {
  average?: number;
  list?: number;
  fees?: number;
  total?: number;
}

interface SGListing {
  id?: string | number;
  section?: string;
  row?: string;
  quantity?: number;
  splits?: number[];       // allowed purchase quantities (like TickPick's sp, Gametime's lots)
  price?: number | SGPriceObject;
  price_fees?: number;
  price_all_in?: number;
}

interface SGPayload {
  listings?: SGListing[];
  data?: { listings?: SGListing[] };
}

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'seatgeek.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'seatgeek.com');
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  const ddCookie = process.env.SEATGEEK_DATADOME_COOKIE;
  if (!ddCookie) {
    return {
      platform: 'SeatGeek',
      listings: [],
      error: 'SeatGeek cookie not configured — add SEATGEEK_DATADOME_COOKIE to .env.local',
    };
  }

  const platformUrls = parsePlatformUrls(event);
  const storedUrl = platformUrls.seatgeek;
  if (!storedUrl) {
    return { platform: 'SeatGeek', listings: [], error: 'No SeatGeek URL stored — add via admin panel' };
  }

  // Pull the numeric event ID from the URL slug (last all-digit path segment)
  const eventId = storedUrl.match(/\/(\d+)(?:[/?#]|$)/)?.[1];
  if (!eventId) {
    return { platform: 'SeatGeek', listings: [], error: 'Could not extract event ID from SeatGeek URL' };
  }

  const apiUrl = new URL('https://seatgeek.com/api/event_listings_v2');
  apiUrl.searchParams.set('_include_seats', '1');
  apiUrl.searchParams.set('client_id', SG_CLIENT_ID);
  apiUrl.searchParams.set('event_page_view_id', crypto.randomUUID());
  apiUrl.searchParams.set('id', eventId);
  apiUrl.searchParams.set('sixpack_client_id', crypto.randomUUID());

  const { page: _page, context } = await newPage();
  try {
    await context.addCookies([{
      name: 'datadome',
      value: ddCookie,
      domain: '.seatgeek.com',
      path: '/',
    }]);

    const res = await context.request.get(apiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://seatgeek.com/',
      },
      timeout: API_TIMEOUT_MS,
    });

    const bodyText = await res.text();

    if (res.status() === 403) {
      return {
        platform: 'SeatGeek',
        listings: [],
        error: 'DataDome blocked request — refresh SEATGEEK_DATADOME_COOKIE in Admin → Dashboard',
      };
    }
    if (!res.ok()) {
      return { platform: 'SeatGeek', listings: [], error: `API returned ${res.status()}` };
    }

    let payload: SGPayload;
    try {
      payload = JSON.parse(bodyText) as SGPayload;
    } catch {
      return { platform: 'SeatGeek', listings: [], error: 'Failed to parse listing JSON' };
    }

    const items: SGListing[] = payload.listings ?? payload.data?.listings ?? [];
    if (items.length === 0) {
      const keys = Object.keys(payload).join(', ');
      return { platform: 'SeatGeek', listings: [], error: `No listings found (response keys: ${keys})` };
    }

    const listings: TicketListing[] = [];
    for (const item of items) {
      const splits = item.splits ?? [];
      // If splits is empty the seller didn't specify — include as a fallback
      if (splits.length > 0 && !splits.includes(qty)) continue;

      let listedPrice: number | null = null;
      let allIn: number | null = null;

      if (typeof item.price === 'object' && item.price !== null) {
        listedPrice = item.price.average ?? item.price.list ?? null;
        allIn = item.price.total ?? null;
      } else if (typeof item.price === 'number') {
        listedPrice = item.price;
      }
      allIn = item.price_all_in ?? allIn ?? listedPrice;
      listedPrice = listedPrice ?? allIn;
      if (!allIn || !listedPrice) continue;

      const fees = item.price_fees ??
        (allIn > listedPrice ? Math.round((allIn - listedPrice) * 100) / 100 : 0);

      listings.push({
        platform: 'SeatGeek',
        section: normalizeSection(item.section ?? ''),
        row: item.row ?? '',
        quantity: item.quantity ?? 0,
        listed_price: listedPrice,
        estimated_fees: fees,
        all_in_price: allIn,
        url: storedUrl,
      });
    }

    if (listings.length === 0) {
      return { platform: 'SeatGeek', listings: [], error: `No listings available for qty=${qty}` };
    }

    listings.sort((a, b) => a.all_in_price - b.all_in_price);
    return { platform: 'SeatGeek', listings: [listings[0]] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'SeatGeek', listings: [], error: `Scraper error: ${msg}` };
  } finally {
    await context.close();
  }
}
