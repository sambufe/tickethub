import type { Response as PlaywrightResponse } from 'playwright';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { TicketListing, SourceResult } from './types';
import { newFastPage } from '@/lib/browser';
import { googleSearchFirstUrl } from '@/lib/google-search';
import { normalizeSection } from '@/lib/utils/normalize-section';

const API_TIMEOUT_MS = 10_000;

interface VSTicket {
  s?: string;
  sectionName?: string;
  r?: string;
  row?: string;
  q?: string | number;
  quantity?: string | number;
  p?: string | number;
  aip?: string | number;
  allInPricePerTicket?: string | number;
}

interface VSListingsPayload {
  tickets?: VSTicket[];
}

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'vividseats.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'vividseats.com');
}

function normalizeListings(tickets: VSTicket[], eventPageUrl: string, qty: number): TicketListing[] {
  const results: TicketListing[] = [];
  for (const t of tickets) {
    const quantity = Number(t.quantity ?? t.q ?? 0);
    if (quantity > 0 && quantity < qty) continue; // qty filter
    const listed = Number(t.p ?? 0);
    const allIn = Number(t.allInPricePerTicket ?? t.aip ?? 0);
    if (!listed || !allIn) continue;
    results.push({
      platform: 'Vivid Seats',
      section: normalizeSection(String(t.sectionName ?? t.s ?? '')),
      row: String(t.row ?? t.r ?? '').trim(),
      quantity,
      listed_price: listed,
      estimated_fees: allIn > listed ? Math.round((allIn - listed) * 100) / 100 : 0,
      all_in_price: allIn,
      url: eventPageUrl,
    });
  }
  return results;
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  const platformUrls = parsePlatformUrls(event);
  const storedUrl = platformUrls.vividseats;

  if (!storedUrl) {
    return { platform: 'Vivid Seats', listings: [], error: 'No Vivid Seats URL stored — add via admin panel' };
  }

  const match = storedUrl.match(/\/production\/(\d+)/);
  if (!match) {
    return { platform: 'Vivid Seats', listings: [], error: 'Invalid stored Vivid Seats URL' };
  }
  const productionId = match[1];

  const { page, context } = await newFastPage();
  try {
    const responsePromise = page.waitForResponse(
      (r: PlaywrightResponse) =>
        r.url().includes('/hermes/api/v1/listings') && r.url().includes(`productionId=${productionId}`),
      { timeout: API_TIMEOUT_MS }
    );

    await page.goto(storedUrl, { waitUntil: 'domcontentloaded', timeout: API_TIMEOUT_MS }).catch(() => {});

    let payload: VSListingsPayload | null = null;
    try {
      const apiResponse = await responsePromise;
      if (apiResponse.ok()) payload = (await apiResponse.json()) as VSListingsPayload;
    } catch {
      return { platform: 'Vivid Seats', listings: [], error: 'Listings API timed out (10s)' };
    }

    const tickets = payload?.tickets ?? [];
    if (tickets.length === 0) {
      return { platform: 'Vivid Seats', listings: [], error: 'No listings found' };
    }

    const listings = normalizeListings(tickets, storedUrl, qty);
    if (listings.length === 0) {
      return { platform: 'Vivid Seats', listings: [], error: `No listings with ${qty}+ tickets` };
    }

    listings.sort((a, b) => a.all_in_price - b.all_in_price);
    return { platform: 'Vivid Seats', listings: [listings[0]] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'Vivid Seats', listings: [], error: `Scraper error: ${msg}` };
  } finally {
    await context.close();
  }
}
