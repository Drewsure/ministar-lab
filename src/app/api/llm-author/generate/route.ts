import { NextRequest, NextResponse } from 'next/server';
import type { TermItem } from '@/lib/types';

// POST /api/llm-author/generate
// Teacher types a topic prompt (e.g. "Grade 3 Science — Solar System") →
// AI generates 12 ready-to-play vocabulary terms with definitions, emojis,
// and difficulty tags. Turns content creation from 30 minutes → 30 seconds.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { topic?: string; count?: number; level?: string; unit?: string; tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const topic = (body.topic ?? '').trim();
  const count = Math.min(20, Math.max(4, body.count ?? 12));
  const level = body.level ?? 'elementary';
  const unit = body.unit ?? 'unit-1';
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  let terms: TermItem[] = [];
  let usedFallback = false;
  try {
    terms = await generateWithLlm(topic, count, level, unit);
  } catch (e: any) {
    usedFallback = true;
    terms = fallbackGenerate(topic, count, unit);
  }

  return NextResponse.json({
    terms,
    unit,
    count: terms.length,
    topic,
    level,
    fallback: usedFallback,
  });
}

async function generateWithLlm(topic: string, count: number, level: string, unit: string): Promise<TermItem[]> {
  const mod: any = await import('z-ai-web-dev-sdk').catch(() => null);
  if (!mod) throw new Error('sdk unavailable');

  const ZAI = mod.default ?? mod.ZAI ?? mod;
  const zai = typeof ZAI === 'function' ? await ZAI.create() : ZAI;

  const levelGuide: Record<string, string> = {
    elementary: 'Grade 3-5 (ages 8-11). Simple words, concrete definitions.',
    middle: 'Grade 6-8 (ages 11-14). Moderate vocabulary, abstract concepts OK.',
    high: 'Grade 9-12 (ages 14-18). Advanced vocabulary, nuanced definitions.',
    esl: 'ESL learners (CEFR A2-B1). High-frequency words, picture-friendly.',
  };

  const systemPrompt = `You are an expert curriculum designer for English vocabulary learning.
Generate ${count} vocabulary terms for the topic: "${topic}"
Target level: ${levelGuide[level] ?? levelGuide.elementary}

Output STRICT JSON only — no prose, no code fences — matching:
{
  "terms": [
    {
      "id": "term-1",
      "term": "the vocabulary word (max 40 chars)",
      "definition": "a short, kid-friendly definition (max 120 chars)",
      "emoji": "a single emoji that best represents the term",
      "difficulty": 1 | 2 | 3,
      "verified": false
    }
  ]
}

Rules:
- Terms must be directly relevant to the topic
- Definitions should help a student understand and remember the word
- Emojis should be universally recognizable
- Mix difficulty levels: ~40% easy, ~40% medium, ~20% hard
- Each term must be unique (no duplicates)
- Terms should span the breadth of the topic`;

  const userPrompt = `Topic: ${topic}\nLevel: ${level}\nCount: ${count}\nUnit: ${unit}`;

  const resp = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const content: string = resp.choices?.[0]?.message?.content ?? '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in LLM response');
  const parsed = JSON.parse(jsonMatch[0]);
  const list: any[] = parsed.terms ?? parsed ?? [];
  return list.slice(0, count).map((t, i) => ({
    id: t.id ?? `term-${i + 1}`,
    term: String(t.term ?? '').slice(0, 40),
    definition: t.definition ? String(t.definition).slice(0, 200) : undefined,
    emoji: t.emoji ?? pickEmoji(String(t.term ?? '')),
    difficulty: (typeof t.difficulty === 'number' && t.difficulty >= 1 && t.difficulty <= 3) ? t.difficulty : 1,
    verified: false,
  }));
}

function fallbackGenerate(topic: string, count: number, unit: string): TermItem[] {
  const templateTerms = [
    'Introduction', 'Foundation', 'Structure', 'Process', 'System', 'Method',
    'Practice', 'Application', 'Analysis', 'Evaluation', 'Synthesis', 'Mastery',
    'Concept', 'Principle', 'Theory', 'Framework', 'Model', 'Strategy',
    'Technique', 'Procedure',
  ];
  return templateTerms.slice(0, count).map((term, i) => ({
    id: `term-${i + 1}`,
    term,
    definition: `A key concept related to ${topic}.`,
    emoji: pickEmoji(term),
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
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
    planet: '🪐', earth: '🌍', mars: '🔴', jupiter: '🪐', saturn: '🪐',
    introduction: '✨', foundation: '🏗️', structure: '🏛️', process: '⚙️',
    system: '🔧', method: '📐', practice: '🎯', application: '🚀',
    analysis: '🔍', evaluation: '📊', synthesis: '🧩', mastery: '🏆',
    concept: '💭', principle: '📜', theory: '🔬', framework: '🗂️',
    model: '🧠', strategy: '♟️', technique: '🛠️', procedure: '📋',
  };
  const key = word.toLowerCase().replace(/[^a-z]/g, '');
  return map[key] ?? '📚';
}
