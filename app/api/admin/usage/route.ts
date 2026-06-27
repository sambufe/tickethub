import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageRow = ((await db.execute({
    sql: `SELECT COALESCE(SUM(credits_used), 0) as total FROM api_usage WHERE called_at >= ?`,
    args: [startOfMonth.toISOString()],
  })).rows[0] ?? {}) as unknown as { total: number };

  const eventsRow = ((await db.execute({
    sql: 'SELECT COUNT(*) as total, SUM(is_active) as active FROM events',
    args: [],
  })).rows[0] ?? {}) as unknown as { total: number; active: number };

  const MONTHLY_CREDITS = 10000;
  const CREDITS_PER_EVENT = 12;
  const creditsUsed = Number(usageRow.total);
  const creditsRemaining = MONTHLY_CREDITS - creditsUsed;
  const estimatedCapacity = Math.floor(creditsRemaining / CREDITS_PER_EVENT);

  return Response.json({
    credits_used_month: creditsUsed,
    credits_total: MONTHLY_CREDITS,
    credits_remaining: creditsRemaining,
    events_tracked: Number(eventsRow.total),
    events_active: Number(eventsRow.active),
    estimated_capacity: estimatedCapacity,
  });
}
