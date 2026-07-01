// NOTE: TM's EPS blocks this even from residential IPs. Kept for future use.

/**
 * Local Ticketmaster scraper — runs on Mac with residential IP, writes merged
 * results into Turso ticket_cache without overwriting other platforms.
 *
 * Run:  npm run scrape:tm
 * Env:  reads TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from .env.local
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, type Client } from '@libsql/client';
import { chromium, type BrowserContext, type Page, type Response as PWResponse } from 'playwright';

// ---------------------------------------------------------------------------
// Env — load .env.local from project root (script always run from project root)
// ---------------------------------------------------------------------------
const ROOT = process.cwd();
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Event {
  id: number;
  title: string;
  ticketmaster_id: string | null;
  platform_urls: string | null;
}

interface TicketListing {
  platform: string;
  section: string;
  row: string;
  quantity: number;
  listed_price: number;
  estimated_fees: number;
  all_in_price: number;
  url: string;
}

interface CachePayload {
  listings: TicketListing[];
  sources: { platform: string; count: number; error: string | null }[];
}

interface SectionFacet {
  section: string;
  row: string;
  count: number;
  offers: string[];
  available?: boolean;
}

interface PriceFacet {
  offers: string[];
  listPriceRange?: { min: number; max: number }[];
  totalPriceRange?: { min: number; max: number }[];
}

// ---------------------------------------------------------------------------
// TM scraping logic (mirrors ticketmaster.ts but uses playwright Page directly)
// ---------------------------------------------------------------------------
const API_TIMEOUT_MS = 20_000;
const FACETS_SETTLE_MS = 400;

function isFacetsUrl(url: string): boolean {
  return (
    url.includes('ismds') &&
    url.includes('/facets') &&
    !url.includes('shape') &&
    !url.includes('inventorytypes+offertypes')
  );
}

function normSection(raw: string): string {
  const s = raw.replace(/^\s*reserved\s*/i, '').trim() || raw.trim();
  const GA_WORD = /\b(ga|general\s+admission|gen\.?\s+admission|standing)\b/i;
  const GA_DOT  = /(?:^|[\s,/])g\.a\.(?:[\s,/]|$)/i;
  return GA_WORD.test(s) || GA_DOT.test(s) ? 'General Admission' : s;
}

function categorizeFacets(body: unknown): {
  sectionFacets: SectionFacet[];
  listPriceFacets: PriceFacet[];
  totalPriceFacets: PriceFacet[];
} {
  const empty = { sectionFacets: [], listPriceFacets: [], totalPriceFacets: [] };
  if (!body || typeof body !== 'object') return empty;
  const d = body as Record<string, unknown>;
  if (!Array.isArray(d.facets) || d.facets.length === 0) return empty;
  const first = d.facets[0] as Record<string, unknown>;
  if ('section' in first && 'row' in first) return { ...empty, sectionFacets: d.facets as SectionFacet[] };
  if ('listPriceRange' in first)  return { ...empty, listPriceFacets:  d.facets as PriceFacet[] };
  if ('totalPriceRange' in first) return { ...empty, totalPriceFacets: d.facets as PriceFacet[] };
  return empty;
}

async function scrapeTMPage(page: Page, eventUrl: string, qty: number): Promise<TicketListing[]> {
  const captured: PWResponse[] = [];
  page.on('response', (r) => { if (isFacetsUrl(r.url())) captured.push(r); });

  const firstFacet = page.waitForResponse((r) => isFacetsUrl(r.url()), { timeout: API_TIMEOUT_MS });
  await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: API_TIMEOUT_MS }).catch(() => {});

  await firstFacet; // throws TimeoutError if TM blocks us — caught by caller

  // Wait for the burst of facet responses to settle
  let timer: ReturnType<typeof setTimeout>;
  await new Promise<void>((resolve) => {
    const reset = () => { clearTimeout(timer); timer = setTimeout(resolve, FACETS_SETTLE_MS); };
    page.on('response', (r) => { if (isFacetsUrl(r.url())) reset(); });
    reset();
  });

  const sectionFacets: SectionFacet[] = [];
  const listPrice  = new Map<string, number>();
  const totalPrice = new Map<string, number>();

  for (const r of captured) {
    if (!(r.headers()['content-type'] ?? '').includes('json')) continue;
    try {
      const body = await r.json();
      const { sectionFacets: sf, listPriceFacets: lf, totalPriceFacets: tf } = categorizeFacets(body);
      sf.forEach((f) => { if (f.offers?.[0] && f.available !== false) sectionFacets.push(f); });
      lf.forEach((f) => { const id = f.offers?.[0]; if (id && f.listPriceRange?.[0]?.min)  listPrice.set(id,  f.listPriceRange[0].min);  });
      tf.forEach((f) => { const id = f.offers?.[0]; if (id && f.totalPriceRange?.[0]?.min) totalPrice.set(id, f.totalPriceRange[0].min); });
    } catch { /* malformed JSON */ }
  }

  const listings: TicketListing[] = [];
  for (const f of sectionFacets) {
    const id = f.offers?.[0];
    if (!id) continue;
    const listed = listPrice.get(id);
    if (!listed) continue;
    const count = f.count ?? 1;
    if (count > 0 && count < qty) continue;
    const allIn = totalPrice.get(id) ?? listed;
    listings.push({
      platform: 'Ticketmaster',
      section: normSection(f.section ?? ''),
      row: f.row ?? '',
      quantity: count,
      listed_price: listed,
      estimated_fees: Math.round((allIn - listed) * 100) / 100,
      all_in_price: allIn,
      url: eventUrl,
    });
  }

  return listings.sort((a, b) => a.all_in_price - b.all_in_price);
}

// ---------------------------------------------------------------------------
// Cache merge — replaces TM entries, leaves other platforms untouched
// ---------------------------------------------------------------------------
async function mergeIntoCache(db: Client, eventId: number, tmListings: TicketListing[], tmError: string | null, qty: number): Promise<void> {
  const row = ((await db.execute({
    sql: 'SELECT raw_json FROM ticket_cache WHERE event_id = ? AND qty = ? ORDER BY fetched_at DESC LIMIT 1',
    args: [eventId, qty],
  })).rows[0] ?? null) as unknown as { raw_json: string } | null;

  let existing: CachePayload = { listings: [], sources: [] };
  if (row?.raw_json) {
    try { existing = JSON.parse(row.raw_json) as CachePayload; } catch { /* corrupt */ }
  }

  const merged: CachePayload = {
    listings: [
      ...(existing.listings ?? []).filter((l) => l.platform !== 'Ticketmaster'),
      ...tmListings,
    ].sort((a, b) => a.all_in_price - b.all_in_price),
    sources: [
      ...(existing.sources ?? []).filter((s) => s.platform !== 'Ticketmaster'),
      { platform: 'Ticketmaster', count: tmListings.length, error: tmError },
    ],
  };

  const fetched_at = new Date().toISOString();
  await db.execute({ sql: 'DELETE FROM ticket_cache WHERE event_id = ? AND qty = ?', args: [eventId, qty] });
  await db.execute({
    sql: 'INSERT INTO ticket_cache (event_id, qty, raw_json, fetched_at) VALUES (?, ?, ?, ?)',
    args: [eventId, qty, JSON.stringify(merged), fetched_at],
  });
}

// ---------------------------------------------------------------------------
// One full pass over all active events
// ---------------------------------------------------------------------------
async function runOnce(db: Client): Promise<void> {
  const ts = new Date().toLocaleTimeString();
  console.log(`\n──────────────────────────────────────────`);
  console.log(`[${ts}] Starting Ticketmaster scrape run`);
  console.log(`──────────────────────────────────────────`);

  const events = (await db.execute({
    sql: 'SELECT id, title, ticketmaster_id, platform_urls FROM events WHERE is_active = 1',
    args: [],
  })).rows.map((r) => ({ ...r })) as unknown as Event[];

  console.log(`${events.length} active event(s)\n`);

  // Use the real Chrome profile so TM sees your actual cookies/history.
  // Chrome MUST be fully quit before running (profile is locked while Chrome is open).
  // launchPersistentContext is required when passing a userDataDir.
  const chromeProfile = `${process.env.HOME}/Library/Application Support/Google/Chrome`;
  const context: BrowserContext = await chromium.launchPersistentContext(chromeProfile, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    for (const event of events) {
      const eventUrl = event.ticketmaster_id
        ? `https://www.ticketmaster.com/event/${event.ticketmaster_id}`
        : null;

      if (!eventUrl) {
        console.log(`  –  ${event.title} — no TM URL, skipping`);
        continue;
      }

      const page = await context.newPage();
      let tmListings: TicketListing[] = [];
      let tmError: string | null = null;

      try {
        tmListings = await scrapeTMPage(page, eventUrl, 2);
        console.log(`  ✓  ${event.title} — ${tmListings.length} listing(s)`);
        if (tmListings.length > 0) {
          console.log(`     cheapest: $${tmListings[0].all_in_price} (${tmListings[0].section} row ${tmListings[0].row})`);
        }
      } catch (err) {
        tmError = err instanceof Error ? err.message : String(err);
        console.log(`  ✗  ${event.title} — ${tmError}`);
      } finally {
        await page.close().catch(() => {});
      }

      await mergeIntoCache(db, event.id, tmListings, tmError, 2);
    }
  } finally {
    await context.close();
  }

  console.log(`\nDone.`);
}

// ---------------------------------------------------------------------------
// Main loop — run once, then repeat every 60 minutes
// ---------------------------------------------------------------------------
const INTERVAL_MS = 60 * 60 * 1000;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

(async () => {
  while (true) {
    await runOnce(db).catch((err) => console.error('Run failed:', err));
    console.log(`\nSleeping 60 min until next run… (Ctrl-C to stop)`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
})();
