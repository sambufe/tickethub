import type { Response as PlaywrightResponse } from 'playwright-core';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult, TicketListing } from './types';
import { newPage } from '@/lib/browser';
import { googleSearchFirstUrl } from '@/lib/google-search';
import { normalizeSection } from '@/lib/utils/normalize-section';

const API_TIMEOUT_MS = 10_000;

interface TPListing {
  p?: number;     // price (no-fee — this is all-in)
  sid?: string;   // section code (e.g. "C")
  lid?: string;   // section label (e.g. "Reserved")
  mk?: string;    // marker key encoding section+row (e.g. "s:c r:ff")
  r?: string;     // row
  q?: number;     // total tickets in listing
  sp?: number[];  // allowed purchase quantities (e.g. [4,2,1] = can buy 4, 2, or 1)
}

interface TPPayload {
  listings?: TPListing[];
}

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'tickpick.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'tickpick.com');
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  const platformUrls = parsePlatformUrls(event);
  const storedUrl = platformUrls.tickpick;

  if (!storedUrl) {
    return { platform: 'TickPick', listings: [], error: 'No TickPick URL stored — add via admin panel' };
  }

  const eventId = storedUrl.match(/\/(\d+)\/?$/)?.[1] ?? '';
  if (!eventId) {
    return { platform: 'TickPick', listings: [], error: 'Could not extract event ID from TickPick URL' };
  }

  const { page, context } = await newPage();
  try {
    const responsePromise = page.waitForResponse(
      (r: PlaywrightResponse) => r.url().includes(`/listings/internal/event-v2/${eventId}`),
      { timeout: API_TIMEOUT_MS }
    );

    await page.goto(storedUrl, { waitUntil: 'domcontentloaded', timeout: API_TIMEOUT_MS }).catch(() => {});

    let payload: TPPayload | null = null;
    try {
      const apiResponse = await responsePromise;
      if (apiResponse.ok()) payload = (await apiResponse.json()) as TPPayload;
    } catch {
      return { platform: 'TickPick', listings: [], error: 'Listings API timed out (10s)' };
    }

    const items = payload?.listings ?? [];
    if (items.length === 0) {
      return { platform: 'TickPick', listings: [], error: 'No listings found' };
    }

    const listings: TicketListing[] = [];
    for (const t of items) {
      const price = Number(t.p ?? 0);
      if (!price) continue;
      const quantity = Number(t.q ?? 1);
      // Filter by total available tickets (q) rather than exact-match sp list,
      // so a listing of 4 tickets shows up when the user requests 2.
      if (quantity < qty) continue;
      listings.push({
        platform: 'TickPick',
        section: normalizeSection(String(t.sid ?? t.lid ?? '')),
        row: String(t.r ?? '').trim(),
        quantity,
        listed_price: price,
        estimated_fees: 0,
        all_in_price: price,
        url: storedUrl,
      });
    }

    if (listings.length === 0) {
      return { platform: 'TickPick', listings: [], error: `No listings with ${qty}+ tickets` };
    }

    listings.sort((a, b) => a.all_in_price - b.all_in_price);
    return { platform: 'TickPick', listings: [listings[0]] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'TickPick', listings: [], error: `Scraper error: ${msg}` };
  } finally {
    await context.close();
  }
}
