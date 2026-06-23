import { NextRequest, NextResponse } from 'next/server';
import { submitDuelAnswer } from '@/lib/multiplayer/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = submitDuelAnswer(body);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
