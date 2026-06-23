import { NextRequest } from 'next/server';
import { restartBrowser } from '@/lib/browser';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await restartBrowser();
    return Response.json({ ok: true, message: 'Browser restarted' });
  } catch (err) {
    return Response.json({ error: `Restart failed: ${err}` }, { status: 500 });
  }
}
