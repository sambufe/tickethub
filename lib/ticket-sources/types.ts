import { CatalogEvent } from '@/lib/types';

export interface TicketListing {
  platform: string;
  section: string;
  row: string;
  quantity: number;
  listed_price: number;
  estimated_fees: number;
  all_in_price: number;
  url: string;
}

export interface SourceResult {
  platform: string;
  listings: TicketListing[];
  error?: string;
}

export type TicketSource = (event: CatalogEvent) => Promise<SourceResult>;

export function allInPrice(listed: number, fees: number): number {
  return fees > 0 ? listed + fees : Math.round(listed * 1.27 * 100) / 100;
}

export const FETCH_TIMEOUT_MS = 12_000;

export const BROWSER_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const JSON_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Extract __NEXT_DATA__ JSON blob from an HTML string */
export function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Safely fetch with a timeout; returns null on failure */
export async function safeFetch(
  url: string,
  opts: RequestInit = {}
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
