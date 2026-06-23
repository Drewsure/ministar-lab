import { NextRequest, NextResponse } from 'next/server';
import { getArenaSnapshot } from '@/lib/multiplayer/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
  const snap = getArenaSnapshot(code);
  if (!snap) return NextResponse.json({ error: 'Arena not found' }, { status: 404 });
  return NextResponse.json(snap);
}
