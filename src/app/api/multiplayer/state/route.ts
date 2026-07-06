import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/multiplayer/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
  const snap = getSnapshot(code);
  if (!snap) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json(snap);
}
