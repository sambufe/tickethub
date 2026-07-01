/**
 * Backfill platform URLs for active events missing stubhub/vividseats/gametime/tickpick.
 * Run: npm run backfill:urls
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { searchPlatformUrls } from '../lib/search-platform-urls';

// Load .env.local before any network calls (env vars are read lazily by search fn)
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const PLATFORMS = ['stubhub', 'vividseats', 'gametime', 'tickpick'] as const;

type EventRow = {
  id: number;
  title: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  event_date: string | null;
  platform_urls: string | null;
};

(async () => {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const rows = (await db.execute({
    sql: 'SELECT id, title, artist, venue, city, state, event_date, platform_urls FROM events WHERE is_active = 1',
    args: [],
  })).rows.map((r) => ({ ...r })) as unknown as EventRow[];

  const toBackfill = rows.filter((row) => {
    if (!row.platform_urls) return true;
    try {
      const urls = JSON.parse(row.platform_urls) as Record<string, string | null>;
      return PLATFORMS.some((p) => urls[p] == null);
    } catch {
      return true;
    }
  });

  console.log(`${rows.length} active event(s), ${toBackfill.length} need backfill\n`);

  for (const row of toBackfill) {
    console.log(`Searching: ${row.title}`);
    const existing = row.platform_urls
      ? (JSON.parse(row.platform_urls) as Record<string, string | null>)
      : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await searchPlatformUrls(row as any);

    const merged = { ...existing };
    let newCount = 0;

    for (const [platform, url] of Object.entries(found)) {
      if (url && !existing[platform]) {
        merged[platform] = url;
        newCount++;
        console.log(`  ✓ ${platform}: ${url}`);
      } else if (!url) {
        console.log(`  – ${platform}: not found`);
      } else {
        console.log(`  · ${platform}: already set`);
      }
    }

    await db.execute({
      sql: 'UPDATE events SET platform_urls = ? WHERE id = ?',
      args: [JSON.stringify(merged), row.id],
    });

    console.log(`  → saved (${newCount} new URL(s))\n`);
  }

  console.log('Done.');
  process.exit(0);
})().catch((err) => { console.error('Fatal:', err); process.exit(1); });
