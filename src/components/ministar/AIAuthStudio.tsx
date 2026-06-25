'use client';
import { useState } from 'react';
import type { TermItem } from '@/lib/types';
import { audioBus } from '@/lib/audio';

// AI Authoring Studio — type a topic, AI generates terms
export default function AIAuthStudio({ onPublish, onCancel }: { onPublish: (terms: TermItem[], unit: string) => void; onCancel: () => void }) {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('elementary');
  const [count, setCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<TermItem[] | null>(null);

  const generate = async () => {
    if (!topic.trim()) { setError('Please enter a topic'); return; }
    setLoading(true); setError('');
    audioBus.init(); audioBus.play('launch');
    try {
      const res = await fetch('/api/llm-author/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, level, count, unit: 'unit-1' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setGenerated(data.terms); audioBus.play('correct');
    } catch (e: any) { setError(e.message); audioBus.play('incorrect'); }
    finally { setLoading(false); }
  };

  if (generated) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-bold">📋 {topic} — {generated.length} terms</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {generated.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="text-xs opacity-50 w-6">{i + 1}.</span>
              <span className="text-xl">{t.emoji}</span>
              <span className="text-sm font-bold">{t.term}</span>
              <span className="text-xs opacity-60 flex-1">{t.definition}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { onPublish(generated, 'unit-1'); audioBus.play('win'); }} className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.5)', color: 'var(--brand-text)' }}>✓ Publish & Play</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-bold">🤖 AI Authoring Studio</div>
      <div className="text-xs opacity-70">Type a topic → AI generates ready-to-play terms in 30 seconds</div>
      <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Grade 3 Science — Solar System planets" rows={3} className="w-full rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }} />
      <div className="grid grid-cols-4 gap-2">
        {['elementary', 'middle', 'high', 'esl'].map(l => (
          <button key={l} onClick={() => setLevel(l)} className="rounded-xl p-2 text-xs font-bold" style={{ background: level === l ? 'var(--brand-accent)' : 'rgba(255,255,255,0.05)', color: level === l ? 'var(--brand-bg)' : 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
            {l === 'elementary' ? '🌱 Elem' : l === 'middle' ? '🌿 Mid' : l === 'high' ? '🌳 High' : '🌍 ESL'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-60">Terms: {count}</span>
        <input type="range" min="4" max="20" value={count} onChange={e => setCount(Number(e.target.value))} className="flex-1" style={{ accentColor: 'var(--brand-accent)' }} />
      </div>
      {error && <div className="text-sm" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
      <button onClick={generate} disabled={loading} className="w-full rounded-xl p-3 font-bold" style={{ background: 'linear-gradient(135deg, var(--brand-accent), var(--brand-primary))', color: 'var(--brand-bg)' }}>
        {loading ? '⚡ AI generating...' : '✨ Generate Lesson with AI'}
      </button>
    </div>
  );
}
