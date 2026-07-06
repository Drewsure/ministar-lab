import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/multiplayer/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, nickname, avatar } = body as {
      code: string;
      nickname: string;
      avatar: string;
    };

    if (!code || !nickname) {
      return NextResponse.json({ error: 'Code and nickname required' }, { status: 400 });
    }

    const result = joinRoom({ code, nickname, avatar: avatar ?? '🦊' });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
