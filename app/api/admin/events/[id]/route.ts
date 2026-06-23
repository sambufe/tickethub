import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const db = getDb();
    db.prepare('DELETE FROM ticket_cache WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM api_usage WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /api/admin/events/[id]]', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (body.is_active !== undefined) {
    db.prepare('UPDATE events SET is_active = ? WHERE id = ?').run(body.is_active ? 1 : 0, id);
  }
  if (body.platform_urls !== undefined) {
    // Merge into existing platform_urls so a partial update doesn't wipe other keys
    const existing = db.prepare('SELECT platform_urls FROM events WHERE id = ?').get(id) as { platform_urls: string | null } | undefined;
    const current = existing?.platform_urls ? (JSON.parse(existing.platform_urls) as Record<string, string | null>) : {};
    const merged = { ...current, ...body.platform_urls };
    db.prepare('UPDATE events SET platform_urls = ? WHERE id = ?').run(JSON.stringify(merged), id);
  }

  return Response.json({ ok: true });
}
