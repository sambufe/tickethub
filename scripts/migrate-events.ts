import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually (tsx doesn't auto-load it)
const envPath = join(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const val = trimmed.slice(eq + 1);
  process.env[key] ??= val;
}

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local');
  process.exit(1);
}

interface EventRow {
  id: number;
  title: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  event_date: string | null;
  ticketmaster_id: string | null;
  seatgeek_id: string | null;
  image_url: string | null;
  added_at: string | null;
  is_active: number;
  source_url: string | null;
  canonical_id: string | null;
  platform_urls: string | null;
}

async function main() {
  const local = new Database(join(process.cwd(), 'tickethub.db'));
  const events = local.prepare('SELECT * FROM events WHERE is_active = 1').all() as EventRow[];
  local.close();

  console.log(`Found ${events.length} active events in local DB. Migrating to Turso...\n`);

  const turso = createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });

  let inserted = 0;
  let skipped = 0;

  for (const e of events) {
    const result = await turso.execute({
      sql: `INSERT OR IGNORE INTO events
              (id, title, artist, venue, city, state, event_date,
               ticketmaster_id, seatgeek_id, image_url, added_at, is_active,
               source_url, canonical_id, platform_urls)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.id, e.title, e.artist, e.venue, e.city, e.state, e.event_date,
        e.ticketmaster_id, e.seatgeek_id, e.image_url, e.added_at, e.is_active,
        e.source_url, e.canonical_id, e.platform_urls,
      ],
    });

    if (result.rowsAffected > 0) {
      console.log(`  ✓ ${e.title}`);
      inserted++;
    } else {
      console.log(`  – ${e.title} (already exists)`);
      skipped++;
    }
  }

  // Verify count in Turso
  const countResult = await turso.execute('SELECT COUNT(*) as n FROM events WHERE is_active = 1');
  const tursoCount = Number(countResult.rows[0][0]);

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`Local active events: ${events.length} | Turso active events: ${tursoCount}`);
  if (tursoCount >= events.length) {
    console.log('✓ Counts match — migration successful.');
  } else {
    console.log('✗ Count mismatch — check for errors above.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
