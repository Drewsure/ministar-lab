import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/multiplayer/store';
import type { GameModeId, ThemeId, TermItem } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teacherNickname, mode, theme, terms, unit, tenantId } = body as {
      teacherNickname: string;
      mode: GameModeId;
      theme: ThemeId;
      terms: TermItem[];
      unit: string;
      tenantId?: string;
    };

    if (!teacherNickname || !mode || !theme || !terms?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const maxQuestions = Math.min(terms.length, 10);

    const { code, teacherId } = createRoom({
      teacherNickname,
      config: { mode, theme, terms, unit: unit ?? 'unit-1', tenantId, maxQuestions },
    });

    return NextResponse.json({ code, teacherId, maxQuestions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
