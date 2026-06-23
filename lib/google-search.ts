import { CatalogEvent } from '@/lib/types';

function formatSearchDate(eventDate: string | null): string {
  if (!eventDate) return '';
  const [year, mm, dd] = eventDate.split('T')[0].split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[parseInt(mm, 10) - 1] ?? ''} ${parseInt(dd, 10)} ${year}`;
}

/**
 * Search via SerpAPI for the first result URL on a given domain.
 * Query format: "{artist}" "{venue}" "{month day year}" site:{domain}
 * Returns null if SERPAPI_KEY is missing or no results found.
 */
export async function googleSearchFirstUrl(
  event: CatalogEvent,
  domain: string
): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const artist = event.artist ?? event.title ?? '';
  const venue = event.venue ?? '';
  const date = formatSearchDate(event.event_date);
  const q = `"${artist}" "${venue}"${date ? ` "${date}"` : ''} site:${domain}`;

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', q);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', '3');

  const res = await fetch(url.toString()).catch(() => null);
  if (!res?.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    organic_results?: Array<{ link: string }>;
    error?: string;
  } | null;

  if (json?.error) return null;
  return json?.organic_results?.[0]?.link ?? null;
}
