import type { Response as PlaywrightResponse } from 'playwright-core';
import { CatalogEvent } from '@/lib/types';
import { SourceResult, TicketListing } from './types';
import { newFastPage } from '@/lib/browser';
import { normalizeSection } from '@/lib/utils/normalize-section';

const API_TIMEOUT_MS = 10_000;
const FACETS_SETTLE_MS = 400; // max gap between consecutive facets responses

interface SectionFacet {
  section: string;
  row: string;
  count: number;
  offers: string[];
  available?: boolean;
}

interface PriceFacet {
  offers: string[];
  listPriceRange?: Array<{ min: number; max: number }>;
  totalPriceRange?: Array<{ min: number; max: number }>;
}

function isFacetsUrl(url: string): boolean {
  return (
    url.includes('ismds') &&
    url.includes('/facets') &&
    !url.includes('shape') &&
    !url.includes('inventorytypes+offertypes')
  );
}

function categorizeFacets(body: unknown): {
  sectionFacets: SectionFacet[];
  listPriceFacets: PriceFacet[];
  totalPriceFacets: PriceFacet[];
} {
  const empty = { sectionFacets: [], listPriceFacets: [], totalPriceFacets: [] };
  if (!body || typeof body !== 'object') return empty;
  const data = body as Record<string, unknown>;
  if (!Array.isArray(data.facets) || data.facets.length === 0) return empty;
  const first = data.facets[0] as Record<string, unknown>;
  if ('section' in first && 'row' in first) return { ...empty, sectionFacets: data.facets as SectionFacet[] };
  if ('listPriceRange' in first) return { ...empty, listPriceFacets: data.facets as PriceFacet[] };
  if ('totalPriceRange' in first) return { ...empty, totalPriceFacets: data.facets as PriceFacet[] };
  return empty;
}

export async function fetchListings(event: CatalogEvent, qty = 2): Promise<SourceResult> {
  if (!event.ticketmaster_id) {
    return { platform: 'Ticketmaster', listings: [], error: 'No Ticketmaster event ID stored' };
  }

  const eventUrl = `https://www.ticketmaster.com/event/${event.ticketmaster_id}`;

  const { page, context } = await newFastPage();
  try {
    const capturedFacets: PlaywrightResponse[] = [];
    const allResponseUrls: string[] = [];

    page.on('response', (r: PlaywrightResponse) => {
      const url = r.url();
      allResponseUrls.push(`${r.status()} ${url.substring(0, 120)}`);
      if (isFacetsUrl(url)) capturedFacets.push(r);
    });

    // Set up trigger BEFORE goto so we don't race the first facets response
    const firstFacetPromise = page.waitForResponse(
      (r: PlaywrightResponse) => isFacetsUrl(r.url()),
      { timeout: API_TIMEOUT_MS }
    );

    console.log('[TM] navigating to', eventUrl);
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: API_TIMEOUT_MS }).catch(() => {});
    console.log('[TM] page loaded, waiting for facets...');

    try {
      await firstFacetPromise;
      // Wait for burst of facets responses to settle rather than sleeping a fixed amount
      let settleTimer: ReturnType<typeof setTimeout>;
      await new Promise<void>((resolve) => {
        const reset = () => {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(resolve, FACETS_SETTLE_MS);
        };
        page.on('response', (r: PlaywrightResponse) => { if (isFacetsUrl(r.url())) reset(); });
        reset(); // start the timer immediately after first facet
      });
    } catch {
      console.log('[TM] timed out. All response URLs seen:');
      allResponseUrls.forEach((u) => console.log('  ', u));
      return { platform: 'Ticketmaster', listings: [], error: 'Listings API timed out (10s)' };
    }

    console.log('[TM] captured', capturedFacets.length, 'facets responses');
    const allSectionFacets: SectionFacet[] = [];
    const listPriceMap = new Map<string, number>();
    const totalPriceMap = new Map<string, number>();

    for (const r of capturedFacets) {
      if (!(r.headers()['content-type'] ?? '').includes('json')) continue;
      try {
        const body = await r.json();
        const { sectionFacets, listPriceFacets, totalPriceFacets } = categorizeFacets(body);
        for (const f of sectionFacets) {
          if (f.offers?.[0] && f.available !== false) allSectionFacets.push(f);
        }
        for (const f of listPriceFacets) {
          const id = f.offers?.[0];
          if (id && f.listPriceRange?.[0]?.min) listPriceMap.set(id, f.listPriceRange[0].min);
        }
        for (const f of totalPriceFacets) {
          const id = f.offers?.[0];
          if (id && f.totalPriceRange?.[0]?.min) totalPriceMap.set(id, f.totalPriceRange[0].min);
        }
      } catch { /* body parse error */ }
    }

    const listings: TicketListing[] = [];
    for (const facet of allSectionFacets) {
      const offerId = facet.offers?.[0];
      if (!offerId) continue;
      const listedPrice = listPriceMap.get(offerId);
      if (!listedPrice) continue;
      const count = facet.count ?? 1;
      if (count > 0 && count < qty) continue; // qty filter
      const allInPrice = totalPriceMap.get(offerId) ?? listedPrice;
      listings.push({
        platform: 'Ticketmaster',
        section: normalizeSection(facet.section ?? ''),
        row: facet.row ?? '',
        quantity: count,
        listed_price: listedPrice,
        estimated_fees: Math.round((allInPrice - listedPrice) * 100) / 100,
        all_in_price: allInPrice,
        url: eventUrl,
      });
    }

    console.log('[TM] sectionFacets:', allSectionFacets.length, 'listPrices:', listPriceMap.size, 'totalPrices:', totalPriceMap.size, 'listings built:', listings.length);

    if (listings.length === 0) {
      return { platform: 'Ticketmaster', listings: [], error: 'No listings found (10s window)' };
    }

    listings.sort((a, b) => a.all_in_price - b.all_in_price);
    return { platform: 'Ticketmaster', listings: [listings[0]] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { platform: 'Ticketmaster', listings: [], error: `Scraper error: ${msg}` };
  } finally {
    await context.close().catch(() => {});
  }
}
