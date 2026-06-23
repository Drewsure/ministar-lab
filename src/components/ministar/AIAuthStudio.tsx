'use client';

import { useState } from 'react';
import type { TermItem } from '@/lib/types';
import { audioBus } from '@/lib/audio';

// ============================================================================
// AI Authoring Studio — 1-click lesson generation
// ============================================================================
// Teacher types a topic prompt → AI generates vocabulary terms with
// definitions, emojis, difficulty tags → 1-click verify & play.
// Turns content creation from 30 minutes → 30 seconds.
// ============================================================================

interface Props {
  onPublish: (terms: TermItem[], unit: string) => void;
  onCancel: () => void;
}

const EXAMPLE_PROMPTS = [
  { emoji: '🌍', label: 'Solar System', prompt: 'Grade 3 Science — Solar System planets and space objects' },
  { emoji: '🦁', label: 'African Animals', prompt: 'Elementary ESL — African safari animals' },
  { emoji: '🍳', label: 'Kitchen Verbs', prompt: 'ESL beginners — cooking and kitchen action verbs' },
  { emoji: '🎵', label: 'Music Instruments', prompt: 'Middle school — musical instruments and their families' },
  { emoji: '🏛️', label: 'Ancient Greece', prompt: 'Grade 6 Social Studies — Ancient Greek civilization terms' },
  { emoji: '🧪', label: 'Chemistry Basics', prompt: 'High school — introductory chemistry terms and elements' },
  { emoji: '🌧️', label: 'Weather Words', prompt: 'Grade 2 — weather and seasons vocabulary' },
  { emoji: '⚽', label: 'Sports Verbs', prompt: 'ESL — action verbs used in sports and games' },
];

const LEVELS = [
  { id: 'elementary', label: 'Elementary', emoji: '🌱', desc: 'Grades 3-5 · ages 8-11' },
  { id: 'middle', label: 'Middle School', emoji: '🌿', desc: 'Grades 6-8 · ages 11-14' },
  { id: 'high', label: 'High School', emoji: '🌳', desc: 'Grades 9-12 · ages 14-18' },
  { id: 'esl', label: 'ESL', emoji: '🌍', desc: 'CEFR A2-B1 · high-frequency words' },
];

export default function AIAuthStudio({ onPublish, onCancel }: Props) {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('elementary');
  const [count, setCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<TermItem[] | null>(null);
  const [generatedMeta, setGeneratedMeta] = useState<{ topic: string; level: string; fallback: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) { setError('Please enter a topic'); return; }
    setLoading(true);
    setError('');
    audioBus.init();
    audioBus.play('launch');
    try {
      const res = await fetch('/api/llm-author/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, count, unit: 'unit-1' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setGenerated(data.terms);
      setGeneratedMeta({ topic: data.topic, level: data.level, fallback: data.fallback });
      audioBus.play('correct');
    } catch (e: any) {
      setError(e.message);
      audioBus.play('incorrect');
    } finally {
      setLoading(false);
    }
  };

  const updateTerm = (id: string, patch: Partial<TermItem>) => {
    if (!generated) return;
    setGenerated(generated.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTerm = (id: string) => {
    if (!generated) return;
    setGenerated(generated.filter(t => t.id !== id));
  };

  const addTerm = () => {
    if (!generated) return;
    const newId = `term-new-${Date.now()}`;
    setGenerated([...generated, {
      id: newId,
      term: 'New Term',
      definition: 'Add a definition',
      emoji: '📝',
      difficulty: 1,
      verified: false,
    }]);
    setEditingId(newId);
  };

  const verifyAll = () => {
    if (!generated) return;
    setGenerated(generated.map(t => ({ ...t, verified: true })));
    audioBus.play('correct');
  };

  const publish = () => {
    if (!generated || generated.length === 0) return;
    onPublish(generated.filter(t => t.verified), 'unit-1');
    audioBus.play('win');
  };

  // ===========================================================================
  // GENERATE SCREEN
  // ===========================================================================
  if (!generated) {
    return (
      <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-60">AI Authoring Studio</div>
              <div className="font-black text-2xl">🤖 Generate a Lesson in 30 Seconds</div>
            </div>
            <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
              ← Back
            </button>
          </div>

          {/* Main input card */}
          <div className="rounded-3xl p-6 shadow-2xl mb-4"
            style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
            <label className="block text-sm font-bold mb-2">📚 What do you want to teach?</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Grade 3 Science — Solar System planets and space objects"
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm mb-4"
              style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}
            />

            {/* Level selector */}
            <label className="block text-sm font-bold mb-2">🎯 Target level</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {LEVELS.map(l => (
                <button key={l.id} onClick={() => setLevel(l.id)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    background: level === l.id ? 'var(--brand-accent)' : 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                    color: level === l.id ? 'var(--brand-bg)' : 'var(--brand-text)',
                    border: '1px solid ' + (level === l.id ? 'var(--brand-accent)' : 'color-mix(in oklab, var(--brand-accent) 30%, transparent)'),
                    transform: level === l.id ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  <div className="text-2xl mb-1">{l.emoji}</div>
                  <div className="text-xs font-bold">{l.label}</div>
                  <div className="text-[10px] opacity-70">{l.desc}</div>
                </button>
              ))}
            </div>

            {/* Count slider */}
            <label className="block text-sm font-bold mb-2">🔢 Number of terms: <span style={{ color: 'var(--brand-accent)' }}>{count}</span></label>
            <input type="range" min="4" max="20" value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full mb-4" style={{ accentColor: 'var(--brand-accent)' }} />

            {error && <div className="text-sm mb-3 p-2 rounded-lg" style={{ background: '#fca5a5', color: '#000' }}>⚠ {error}</div>}

            <button onClick={generate} disabled={loading || !topic.trim()}
              className="w-full rounded-xl p-4 font-bold text-lg disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, var(--brand-accent), var(--brand-primary))', color: 'var(--brand-bg)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⚡</span> AI is generating your lesson...
                </span>
              ) : '✨ Generate Lesson with AI'}
            </button>
          </div>

          {/* Example prompts */}
          <div className="rounded-3xl p-6 shadow-xl"
            style={{ background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
            <div className="text-sm font-bold mb-3 opacity-80">💡 Try an example prompt:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXAMPLE_PROMPTS.map(ex => (
                <button key={ex.label} onClick={() => { setTopic(ex.prompt); setLevel('elementary'); }}
                  className="rounded-xl p-3 text-left text-xs transition-all hover:scale-[1.02]"
                  style={{ background: 'color-mix(in oklab, var(--brand-accent) 12%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)' }}>
                  <div className="text-2xl mb-1">{ex.emoji}</div>
                  <div className="font-bold">{ex.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // EDIT / REVIEW SCREEN
  // ===========================================================================
  const verifiedCount = generated.filter(t => t.verified).length;
  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60">
              {generatedMeta?.fallback ? '⚠ Fallback mode' : '✨ AI Generated'}
            </div>
            <div className="font-black text-xl">📋 {generatedMeta?.topic}</div>
            <div className="text-xs opacity-70">{generated.length} terms · {verifiedCount} verified</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setGenerated(null)} className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
              ↺ Regenerate
            </button>
            <button onClick={onCancel} className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
              ← Cancel
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={verifyAll} className="rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
            ✓ Verify All
          </button>
          <button onClick={addTerm} className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
            + Add Term
          </button>
          <div className="flex-1" />
          <button onClick={publish} disabled={verifiedCount === 0}
            className="rounded-xl px-6 py-2 text-sm font-bold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}>
            🚀 Publish & Play ({verifiedCount})
          </button>
        </div>

        {/* Term list */}
        <div className="space-y-2">
          {generated.map((t, i) => (
            <div key={t.id} className="rounded-2xl p-3 flex items-center gap-3"
              style={{
                background: t.verified ? 'color-mix(in oklab, #22c55e 12%, var(--brand-card))' : 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
                border: '1px solid ' + (t.verified ? 'color-mix(in oklab, #22c55e 40%, transparent)' : 'color-mix(in oklab, var(--brand-accent) 20%, transparent)'),
              }}>
              <span className="text-xs opacity-50 font-mono w-6">{i + 1}.</span>
              <span className="text-3xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                {editingId === t.id ? (
                  <div className="space-y-1">
                    <input value={t.term} onChange={e => updateTerm(t.id, { term: e.target.value })}
                      className="w-full rounded px-2 py-1 text-sm font-bold"
                      style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid var(--brand-accent)' }} />
                    <input value={t.definition ?? ''} onChange={e => updateTerm(t.id, { definition: e.target.value })}
                      placeholder="Definition"
                      className="w-full rounded px-2 py-1 text-xs"
                      style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid var(--brand-accent)' }} />
                    <div className="flex gap-2 items-center">
                      <input value={t.emoji ?? ''} onChange={e => updateTerm(t.id, { emoji: e.target.value })} maxLength={2}
                        className="w-12 rounded px-2 py-1 text-sm text-center"
                        style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid var(--brand-accent)' }} />
                      <select value={t.difficulty ?? 1} onChange={e => updateTerm(t.id, { difficulty: Number(e.target.value) as 1|2|3 })}
                        className="rounded px-2 py-1 text-xs"
                        style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid var(--brand-accent)' }}>
                        <option value={1}>Easy</option>
                        <option value={2}>Medium</option>
                        <option value={3}>Hard</option>
                      </select>
                      <button onClick={() => setEditingId(null)} className="text-xs font-bold" style={{ color: 'var(--brand-accent)' }}>Done</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-sm flex items-center gap-2">
                      {t.term}
                      {t.difficulty === 3 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#ef4444', color: '#fff' }}>HARD</span>}
                      {t.difficulty === 2 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#f59e0b', color: '#000' }}>MED</span>}
                      {t.difficulty === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e', color: '#fff' }}>EASY</span>}
                    </div>
                    <div className="text-xs opacity-70 truncate">{t.definition}</div>
                  </>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                  className="rounded-lg p-2 text-xs"
                  style={{ background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)' }}>✏️</button>
                <button onClick={() => updateTerm(t.id, { verified: !t.verified })}
                  className="rounded-lg p-2 text-xs"
                  style={{ background: t.verified ? '#22c55e' : 'color-mix(in oklab, var(--brand-accent) 15%, transparent)', color: t.verified ? '#fff' : 'inherit' }}>
                  {t.verified ? '✓' : '○'}
                </button>
                <button onClick={() => removeTerm(t.id)}
                  className="rounded-lg p-2 text-xs"
                  style={{ background: 'color-mix(in oklab, #ef4444 15%, transparent)' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
