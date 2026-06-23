import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return Response.json(
      { ok: false, error: 'ADMIN_PASSWORD not set in .env.local' },
      { status: 500 }
    );
  }

  if (password === adminPassword) {
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
}
