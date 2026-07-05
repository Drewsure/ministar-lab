import { NextRequest, NextResponse } from 'next/server';
import type { TermItem } from '@/lib/types';

// POST /api/llm-author
// Teacher pastes raw chapter text → LLM extracts unified JSON term schema.
// Uses z-ai-web-dev-sdk (server-side only — never client).
export async function POST(req: NextRequest) {
  let body: { rawText?: string; unit?: string; tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const rawText = (body.rawText ?? '').trim();
  const unit = body.unit ?? 'unit-1';
  if (!rawText) {
    return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
  }

  // Try LLM extraction via z-ai-web-dev-sdk
  let terms: TermItem[] = [];
  try {
    terms = await extractWithLlm(rawText, unit);
  } catch {
    // Fallback: deterministic naive extraction (split on comma/semicolon/newline)
    terms = naiveExtract(rawText, unit);
  }

  return NextResponse.json({ terms, unit, count: terms.length });
}

async function extractWithLlm(rawText: string, unit: string): Promise<TermItem[]> {
  // z-ai-web-dev-sdk is server-only.
  // We dynamically import to keep the bundler honest about server-only use.
  const mod: any = await import('z-ai-web-dev-sdk').catch(() => null);
  if (!mod) throw new Error('sdk unavailable');

  const ZAI = mod.default ?? mod.ZAI ?? mod;
  const zai = typeof ZAI === 'function' ? await ZAI.create() : ZAI;

  const systemPrompt = `You are a curriculum extraction engine for an English learning platform.
Read the user's raw text and extract every distinct vocabulary term.
Output STRICT JSON only — no prose, no code fences — matching this TypeScript type:
  interface TermItem {
    id: string;          // stable unique id, e.g. "term-1"
    term: string;        // the vocabulary word (max 40 chars)
    definition?: string; // short definition if the text provides one
    emoji?: string;      // a single emoji that best represents the term
    verified: boolean;   // always false — teacher verifies later
  }
Return: { "terms": TermItem[] }
Limit to the 12 most important terms.`;

  const userPrompt = `Raw chapter text:\n"""${rawText.slice(0, 4000)}"""`;

  const resp = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const content: string = resp.choices?.[0]?.message?.content ?? '';
  // Try to parse JSON out of the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in LLM response');
  const parsed = JSON.parse(jsonMatch[0]);
  const list: any[] = parsed.terms ?? parsed ?? [];
  return list.slice(0, 12).map((t, i) => ({
    id: t.id ?? `term-${i + 1}`,
    term: String(t.term ?? '').slice(0, 40),
    definition: t.definition ? String(t.definition).slice(0, 200) : undefined,
    emoji: t.emoji ?? pickEmoji(String(t.term ?? '')),
    verified: false,
  }));
}

function naiveExtract(rawText: string, unit: string): TermItem[] {
  const pieces = rawText
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 40);
  return pieces.slice(0, 12).map((term, i) => ({
    id: `term-${i + 1}`,
    term,
    emoji: pickEmoji(term),
    verified: false,
  }));
}

function pickEmoji(word: string): string {
  const map: Record<string, string> = {
    apple: '🍎', banana: '🍌', cherry: '🍒', grape: '🍇', lemon: '🍋', mango: '🥭',
    orange: '🍊', peach: '🍑', pear: '🍐', watermelon: '🍉', strawberry: '🍓',
    cat: '🐱', dog: '🐶', bird: '🐦', fish: '🐟', rabbit: '🐰', fox: '🦊', bear: '🐻',
    book: '📚', pen: '🖊️', pencil: '✏️', desk: '🪑', chair: '🪑', school: '🏫',
    run: '🏃', jump: '🤸', swim: '🏊', eat: '🍽️', drink: '🥤', sleep: '😴',
    red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', black: '⚫', white: '⚪',
    sun: '☀️', moon: '🌙', star: '⭐', cloud: '☁️', rain: '🌧️', snow: '❄️',
  };
  const key = word.toLowerCase().replace(/[^a-z]/g, '');
  return map[key] ?? '❓';
}
