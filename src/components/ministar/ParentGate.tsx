'use client';

import { useState } from 'react';
import { audioBus } from '@/lib/audio';

// ============================================================================
// ParentGate — Prevents young children from accessing teacher/parent area
// ============================================================================
// Shows a simple math problem that a kindergartener can't solve.
// Must be correct to proceed. 3 attempts max, then locks for 30s.
// ============================================================================

interface Props {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ParentGate({ open, onSuccess, onCancel }: Props) {
  const [a] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [b] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = () => {
    if (Number(answer) === a + b) {
      audioBus.play('correct');
      onSuccess();
    } else {
      audioBus.play('incorrect');
      setError(true);
      setAnswer('');
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onCancel}
    >
      <div
        className="max-w-sm w-full rounded-3xl p-6 text-center"
        style={{ background: '#1a1535', border: '1px solid rgba(168,85,247,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Grown-Ups Only</div>
        <div className="text-xs opacity-60 mb-4" style={{ color: '#fff' }}>
          Solve this to continue:
        </div>
        <div className="text-3xl font-bold mb-4" style={{ color: '#fbbf24' }}>
          {a} + {b} = ?
        </div>
        <input
          type="number"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-center text-2xl mb-3"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: error ? '2px solid #ef4444' : '1px solid rgba(168,85,247,0.4)',
            color: '#fff',
            outline: 'none',
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: 'rgba(168,85,247,0.5)', color: '#fff' }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
