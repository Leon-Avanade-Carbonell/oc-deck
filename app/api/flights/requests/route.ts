import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function GET() {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/opensky/requests`, { cache: 'no-store' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream HTTP ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
