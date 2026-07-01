import { NextRequest } from 'next/server';
import { CatalogEvent } from '@/lib/types';
import { searchPlatformUrls } from '@/lib/search-platform-urls';

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stub = {
    title: searchParams.get('title') ?? '',
    artist: searchParams.get('artist'),
    venue: searchParams.get('venue'),
    city: searchParams.get('city'),
    state: searchParams.get('state'),
    event_date: searchParams.get('event_date'),
  } as unknown as CatalogEvent;

  const urls = await searchPlatformUrls(stub);
  return Response.json({ urls });
}
