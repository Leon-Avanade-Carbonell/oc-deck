import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const url = new URL(_req.url);
  const includeGround = url.searchParams.get('include_ground') ?? 'false';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/opensky/trips/${requestId}?include_ground=${includeGround}`, { cache: 'no-store' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Upstream HTTP ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
