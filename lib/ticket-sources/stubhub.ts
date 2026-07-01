import type { Response as PlaywrightResponse } from 'playwright-core';
import { CatalogEvent, parsePlatformUrls } from '@/lib/types';
import { SourceResult, TicketListing } from './types';
import { newPage } from '@/lib/browser';
import { googleSearchFirstUrl } from '@/lib/google-search';
import { normalizeSection } from '@/lib/utils/normalize-section';

const PAGE_TIMEOUT_MS = 25_000;
const MIN_HTML_BYTES = 50_000;

interface SHListing {
  id: number;
  section: string;
  rowContent?: string;
  availableTickets: number;
  availableQuantities: number[];
  rawPrice: number;
}

interface SHIndexData {
  grid?: {
    items: SHListing[];
    quantity: number;
    totalCount: number;
  };
}

export async function findEventCandidates(event: CatalogEvent): Promise<string[]> {
  const url = await googleSearchFirstUrl(event, 'stubhub.com');
  return url ? [url] : [];
}

export async function findEventUrl(event: CatalogEvent): Promise<string | null> {
  return googleSearchFirstUrl(event, 'stubhub.com');
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  const platformUrls = parsePlatformUrls(event);
  const storedUrl = platformUrls.stubhub;

  if (!storedUrl) {
    return { platform: 'StubHub', listings: [], error: 'No StubHub URL stored — add via admin panel' };
  }

  // Build a quantity-aware URL so StubHub's server returns listings for the right qty.
  // Also strips any stale ?quantity= param already in the stored URL.
  const parsedUrl = new URL(storedUrl);
  parsedUrl.searchParams.set('quantity', String(qty));
  const pageUrl = parsedUrl.toString();

  const { page, context } = await newPage();
  try {
    // StubHub uses DataDome bot challenge: first request → 202 challenge HTML;
    // after JS validates, a second request → 200 full HTML with embedded listing data.
    // We wait for the real 200 response (> 50KB) to get the listing data.
    const htmlPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('StubHub HTML response timed out')),
        PAGE_TIMEOUT_MS
      );
      page.on('response', async (res: PlaywrightResponse) => {
        if (res.status() !== 200) return;
        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('html')) return;
        const url = res.url();
        if (!url.includes('/event/')) return;
        const text = await res.text().catch(() => '');
        if (text.length >= MIN_HTML_BYTES) {
          clearTimeout(timer);
          resolve(text);
        }
      });
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }).catch(() => {});

    let rawHtml: string;
    try {
      rawHtml = await htmlPromise;
    } catch {
      return { platform: 'StubHub', listings: [], error: 'Page load timed out (25s)' };
    }

    // Listing data is embedded in <script id="index-data" type="application/json">
    const scriptMatch = /<script id="index-data" type="application\/json">([\s\S]*?)<\/script>/.exec(rawHtml);
    if (!scriptMatch) {
      return { platform: 'StubHub', listings: [], error: 'Could not find index-data in page HTML' };
    }

    let data: SHIndexData;
    try {
      data = JSON.parse(scriptMatch[1]) as SHIndexData;
    } catch {
      return { platform: 'StubHub', listings: [], error: 'Failed to parse listing data JSON' };
    }

    const items = data?.grid?.items ?? [];
    if (items.length === 0) {
      return { platform: 'StubHub', listings: [], error: 'No listings found' };
    }

    const listings: TicketListing[] = [];
    for (const item of items) {
      // Filter by total available tickets rather than exact-match purchase quantities,
      // so a listing of 4 tickets shows up when the user requests 2.
      if (item.availableTickets < qty) continue;
      const price = item.rawPrice;
      if (!price) continue;

      // rowContent is "Row AA", "Row EE", etc.; strip the "Row " prefix for a clean row label.
      const row = (item.rowContent ?? '').replace(/^Row\s*/i, '').trim();

      listings.push({
        platform: 'StubHub',
        section: normalizeSection(item.section ?? ''),
        row,
        quantity: item.availableTickets,
        listed_price: price,
        estimated_fees: 0,
        all_in_price: price,
        url: pageUrl,
      });
    }

    if (listings.length === 0) {
      return { platform: 'StubHub', listings: [], error: `No listings available for qty=${qty}` };
    }

    listings.sort((a, b) => a.all_in_price - b.all_in_price);
    return { platform: 'StubHub', listings: listings.slice(0, 5) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'StubHub', listings: [], error: `Scraper error: ${msg}` };
  } finally {
    await context.close().catch(() => {});
  }
}
