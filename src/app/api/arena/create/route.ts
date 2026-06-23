import { NextRequest, NextResponse } from 'next/server';
import { createDuel } from '@/lib/multiplayer/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = createDuel({
      nickname: body.nickname,
      avatar: body.avatar ?? '🦊',
      config: {
        gameMode: body.gameMode ?? 'quiz',
        theme: body.theme ?? 'space',
        terms: body.terms,
        unit: body.unit ?? 'unit-1',
        maxQuestions: body.maxQuestions ?? 10,
      },
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
