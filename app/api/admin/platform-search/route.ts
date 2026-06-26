import { NextRequest } from 'next/server';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

interface SearchPayload {
  platform: string;
  url?: string;
}

// Manual-entry only: no external search calls on this branch.
// The admin UI (EventConfirmModal) provides 7 URL paste fields; this route
// is a thin passthrough that validates the submission and returns the URL as-is.
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as SearchPayload;
  const url = body.url?.trim() || null;

  return Response.json({ url, found: !!url });
}
