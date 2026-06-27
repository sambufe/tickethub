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
    const db = await getDb();
    await db.execute({ sql: 'DELETE FROM ticket_cache WHERE event_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM api_usage WHERE event_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
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
  const db = await getDb();

  if (body.is_active !== undefined) {
    await db.execute({
      sql: 'UPDATE events SET is_active = ? WHERE id = ?',
      args: [body.is_active ? 1 : 0, id],
    });
  }
  if (body.platform_urls !== undefined) {
    const existingRow = ((await db.execute({ sql: 'SELECT platform_urls FROM events WHERE id = ?', args: [id] })).rows[0] ?? undefined) as unknown as { platform_urls: string | null } | undefined;
    const current = existingRow?.platform_urls ? (JSON.parse(existingRow.platform_urls) as Record<string, string | null>) : {};
    const merged = { ...current, ...body.platform_urls };
    await db.execute({
      sql: 'UPDATE events SET platform_urls = ? WHERE id = ?',
      args: [JSON.stringify(merged), id],
    });
  }

  return Response.json({ ok: true });
}
