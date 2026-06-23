import { NextRequest } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

const ENV_PATH = resolve(process.cwd(), '.env.local');

// Allowed keys that can be updated via this endpoint
const ALLOWED_KEYS = new Set(['SEATGEEK_DATADOME_COOKIE']);

function readEnvFile(): string {
  try { return readFileSync(ENV_PATH, 'utf8'); }
  catch { return ''; }
}

function writeEnvKey(existing: string, key: string, value: string): string {
  const lines = existing.split('\n');
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  const entry = `${key}=${value}`;
  if (idx >= 0) {
    lines[idx] = entry;
  } else {
    // Append; ensure file ends with newline
    if (lines[lines.length - 1] !== '') lines.push('');
    lines.push(entry);
    lines.push('');
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const content = readEnvFile();
  const seatgeekCookieSet = /^SEATGEEK_DATADOME_COOKIE=.+/m.test(content);
  return Response.json({ seatgeekCookieSet });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { key?: string; value?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { key, value } = body;
  if (!key || !ALLOWED_KEYS.has(key)) {
    return Response.json({ error: `Key not allowed: ${key}` }, { status: 400 });
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return Response.json({ error: 'Value must be a non-empty string' }, { status: 400 });
  }

  try {
    const updated = writeEnvKey(readEnvFile(), key, value.trim());
    writeFileSync(ENV_PATH, updated, 'utf8');
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: `Failed to write .env.local: ${err}` }, { status: 500 });
  }
}
