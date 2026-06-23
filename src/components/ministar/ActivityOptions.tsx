'use client';

import { useState, useEffect } from 'react';
import type { TermItem, ThemeId, GameModeId } from '@/lib/types';
import { THEMES } from '@/lib/themes';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { audioBus } from '@/lib/audio';

// ============================================================================
// ActivityOptions — Wordwall-style options panel for any activity
// ============================================================================
// Tabs: Edit Content | Print | Embed | Set Assignment | Visual Style | Timer | Leaderboard
// Appears as a modal overlay when user clicks "Options" button
// ============================================================================

interface Props {
  open: boolean;
  onClose: () => void;
  mode: GameModeId;
  theme: ThemeId;
  terms: TermItem[];
  unit: string;
  tenantId?: string;
  lastScore?: number;
  lastDurationMs?: number;
  onEditTerms: (terms: TermItem[]) => void;
  onChangeTheme: (theme: ThemeId) => void;
  onChangeTimer: (ms: number) => void;
  onPrint: () => void;
}

type Tab = 'edit' | 'print' | 'embed' | 'assign' | 'style' | 'timer' | 'leaderboard';

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  time: string;
  date: string;
}

export default function ActivityOptions(props: Props) {
  const { open, onClose, mode, theme, terms, unit, tenantId, lastScore, lastDurationMs } = props;
  const [tab, setTab] = useState<Tab>('edit');
  const [editTerms, setEditTerms] = useState<TermItem[]>(terms);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [assignCopied, setAssignCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [timerMs, setTimerMs] = useState(300000);
  const [assignmentName, setAssignmentName] = useState('');

  // Load leaderboard from localStorage on open
  useEffect(() => {
    if (!open) return;
    const key = `ministar_leaderboard_${mode}_${unit}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setLeaderboard(JSON.parse(raw));
      } else {
        setLeaderboard([]);
      }
    } catch {
      setLeaderboard([]);
    }
  }, [open, mode, unit]);

  // If we have a lastScore, add it to the leaderboard
  useEffect(() => {
    if (!open || lastScore === undefined || lastScore === 0) return;
    const key = `ministar_leaderboard_${mode}_${unit}`;
    const name = playerName || 'Anonymous';
    const time = lastDurationMs ? `${(lastDurationMs / 1000).toFixed(1)}s` : '-';
    const date = new Date().toLocaleDateString();
    const entry: LeaderboardEntry = { rank: 0, name, score: lastScore, time, date };

    try {
      const raw = localStorage.getItem(key);
      const existing: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
      existing.push({ ...entry, rank: existing.length + 1 });
      // Sort by score descending, then by time ascending
      existing.sort((a, b) => b.score - a.score);
      // Re-rank
      existing.forEach((e, i) => { e.rank = i + 1; });
      // Keep top 10
      const top10 = existing.slice(0, 10);
      localStorage.setItem(key, JSON.stringify(top10));
      setLeaderboard(top10);
    } catch {}
  }, [open, lastScore, mode, unit, playerName]);

  if (!open) return null;

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'edit', label: 'Edit Content', emoji: '✏️' },
    { id: 'print', label: 'Print', emoji: '🖨️' },
    { id: 'embed', label: 'Embed', emoji: '📋' },
    { id: 'assign', label: 'Set Assignment', emoji: '📝' },
    { id: 'style', label: 'Visual Style', emoji: '🎨' },
    { id: 'timer', label: 'Timer', emoji: '⏱️' },
    { id: 'leaderboard', label: 'Leaderboard', emoji: '🏆' },
  ];

  const embedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?game=${mode}&theme=${theme}&embed=1`
    : '';
  const embedCode = `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" allow="microphone; speaker" style="border:none; border-radius:16px;"></iframe>`;
  const assignUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?game=${mode}&theme=${theme}&assignment=${unit}`
    : '';

  const copyToClipboard = (text: string, which: 'embed' | 'assign') => {
    try {
      navigator.clipboard.writeText(text);
      if (which === 'embed') {
        setEmbedCopied(true);
        setTimeout(() => setEmbedCopied(false), 2000);
      } else {
        setAssignCopied(true);
        setTimeout(() => setAssignCopied(false), 2000);
      }
      audioBus.play('tap');
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
        style={{
          background: 'var(--brand-bg, #0a0a0a)',
          color: 'var(--brand-text, #fff)',
          border: '1px solid rgba(168,85,247,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{GAME_MODE_MAP[mode]?.emoji}</span>
            <div>
              <div className="font-bold text-sm">Activity Options</div>
              <div className="text-xs opacity-60">{GAME_MODE_MAP[mode]?.name} · {terms.length} terms</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-sm opacity-70 hover:opacity-100" style={{ background: 'rgba(255,255,255,0.1)' }}>✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-2 overflow-x-auto border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); audioBus.play('tap'); }}
              className="rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: tab === t.id ? 'rgba(168,85,247,0.3)' : 'transparent',
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.6)',
                border: tab === t.id ? '1px solid rgba(168,85,247,0.5)' : '1px solid transparent',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* EDIT CONTENT */}
          {tab === 'edit' && (
            <div>
              <div className="text-sm font-bold mb-3">Edit Terms ({editTerms.length})</div>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {editTerms.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-xs opacity-50 w-6">{i + 1}.</span>
                    <span className="text-xl">{t.emoji}</span>
                    <input
                      value={t.term}
                      onChange={e => setEditTerms(prev => prev.map(x => x.id === t.id ? { ...x, term: e.target.value } : x))}
                      className="flex-1 rounded px-2 py-1 text-sm"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                    />
                    <input
                      value={t.definition ?? ''}
                      onChange={e => setEditTerms(prev => prev.map(x => x.id === t.id ? { ...x, definition: e.target.value } : x))}
                      placeholder="Definition"
                      className="flex-1 rounded px-2 py-1 text-xs"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                    />
                    <button
                      onClick={() => setEditTerms(prev => prev.filter(x => x.id !== t.id))}
                      className="rounded p-1 text-xs"
                      style={{ background: 'rgba(239,68,68,0.2)' }}
                    >🗑</button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditTerms(prev => [...prev, { id: `new-${Date.now()}`, term: 'New Term', emoji: '📝', definition: '', verified: true }])}
                className="rounded-lg px-3 py-2 text-sm font-semibold mr-2"
                style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)' }}
              >+ Add Term</button>
              <button
                onClick={() => { props.onEditTerms(editTerms); audioBus.play('correct'); onClose(); }}
                className="rounded-lg px-4 py-2 text-sm font-bold"
                style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.5)' }}
              >✓ Save Changes</button>
            </div>
          )}

          {/* PRINT */}
          {tab === 'print' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🖨️</div>
              <div className="text-lg font-bold mb-2">Print Worksheet</div>
              <div className="text-sm opacity-70 mb-6">Generate a printable PDF of this activity</div>
              <button
                onClick={() => { props.onPrint(); onClose(); }}
                className="rounded-xl px-6 py-3 font-bold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff' }}
              >Generate PDF</button>
            </div>
          )}

          {/* EMBED */}
          {tab === 'embed' && (
            <div>
              <div className="text-sm font-bold mb-2">Embed Code</div>
              <div className="text-xs opacity-70 mb-3">Paste this HTML on your blog, LMS, or school website to embed the activity.</div>
              <pre
                className="rounded-lg p-3 text-xs font-mono overflow-x-auto mb-3"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: '#a5f3fc' }}
              >{embedCode}</pre>
              <button
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className="rounded-lg px-4 py-2 text-sm font-bold"
                style={{ background: embedCopied ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.5)' }}
              >{embedCopied ? '✓ Copied!' : '📋 Copy Code'}</button>
              <div className="mt-4 text-xs opacity-60">
                Preview: <a href={embedUrl} target="_blank" style={{ color: '#a5f3fc' }}>{embedUrl}</a>
              </div>
            </div>
          )}

          {/* SET ASSIGNMENT */}
          {tab === 'assign' && (
            <div>
              <div className="text-sm font-bold mb-2">Set Assignment</div>
              <div className="text-xs opacity-70 mb-3">Students open this link and complete the activity. Their results are saved to the leaderboard.</div>
              <input
                value={assignmentName}
                onChange={e => setAssignmentName(e.target.value)}
                placeholder="Assignment name (e.g. Homework Week 3)"
                className="w-full rounded-lg px-3 py-2 text-sm mb-3"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
              />
              <div
                className="rounded-lg p-3 text-xs font-mono break-all mb-3"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: '#a5f3fc' }}
              >{assignUrl}{assignmentName ? `&name=${encodeURIComponent(assignmentName)}` : ''}</div>
              <button
                onClick={() => copyToClipboard(assignUrl + (assignmentName ? `&name=${encodeURIComponent(assignmentName)}` : ''), 'assign')}
                className="rounded-lg px-4 py-2 text-sm font-bold mr-2"
                style={{ background: assignCopied ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.5)' }}
              >{assignCopied ? '✓ Copied!' : '📋 Copy Link'}</button>
              <a
                href={assignUrl}
                target="_blank"
                className="inline-block rounded-lg px-4 py-2 text-sm font-bold"
                style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.5)' }}
              >▶ Preview Assignment</a>
            </div>
          )}

          {/* VISUAL STYLE */}
          {tab === 'style' && (
            <div>
              <div className="text-sm font-bold mb-3">Visual Style</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(THEMES) as ThemeId[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { props.onChangeTheme(t); audioBus.play('tap'); }}
                    className="rounded-xl p-3 text-center transition-all"
                    style={{
                      background: theme === t ? `#${THEMES[t].accent.toString(16).padStart(6, '0')}` : 'rgba(255,255,255,0.05)',
                      border: theme === t ? `2px solid #${THEMES[t].accent.toString(16).padStart(6, '0')}` : '1px solid rgba(255,255,255,0.1)',
                      color: theme === t ? '#000' : '#fff',
                    }}
                  >
                    <div className="text-xs font-bold">{THEMES[t].name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TIMER */}
          {tab === 'timer' && (
            <div>
              <div className="text-sm font-bold mb-3">Timer Options</div>
              <div className="text-xs opacity-70 mb-4">Set how long students have to complete the activity</div>
              {[
                { label: 'No timer', ms: 0, emoji: '∞' },
                { label: '1 minute', ms: 60000, emoji: '⏱' },
                { label: '3 minutes', ms: 180000, emoji: '⏱' },
                { label: '5 minutes', ms: 300000, emoji: '⏱' },
                { label: '10 minutes', ms: 600000, emoji: '⏱' },
                { label: '15 minutes', ms: 900000, emoji: '⏱' },
              ].map(opt => (
                <button
                  key={opt.ms}
                  onClick={() => { setTimerMs(opt.ms); props.onChangeTimer(opt.ms); audioBus.play('tap'); }}
                  className="w-full rounded-lg p-3 text-left mb-2 transition-all"
                  style={{
                    background: timerMs === opt.ms ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)',
                    border: timerMs === opt.ms ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span className="text-xl mr-3">{opt.emoji}</span>
                  <span className="text-sm font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* LEADERBOARD */}
          {tab === 'leaderboard' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold">🏆 Leaderboard</div>
                <div className="text-xs opacity-60">Top 10 · {mode} · {unit}</div>
              </div>
              {lastScore !== undefined && lastScore > 0 && (
                <div className="rounded-lg p-2 mb-3" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="Your name (to save score)"
                    maxLength={20}
                    className="w-full rounded px-2 py-1 text-sm"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  />
                  <div className="text-xs opacity-70 mt-1">Score: {lastScore} · {lastDurationMs ? `${(lastDurationMs/1000).toFixed(1)}s` : ''}</div>
                </div>
              )}
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 opacity-50 text-sm">
                  No scores yet. Be the first!
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[50px_1fr_80px_60px] gap-2 text-xs font-bold opacity-60 px-2 pb-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <span>Rank</span>
                    <span>Name</span>
                    <span>Score</span>
                    <span>Time</span>
                  </div>
                  {leaderboard.map((e, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${e.rank}`;
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[50px_1fr_80px_60px] gap-2 text-sm px-2 py-1 rounded"
                        style={{
                          background: i < 3 ? 'rgba(168,85,247,0.1)' : 'transparent',
                        }}
                      >
                        <span className="font-bold">{medal}</span>
                        <span className="truncate">{e.name}</span>
                        <span className="font-mono font-bold" style={{ color: '#fbbf24' }}>{e.score}</span>
                        <span className="text-xs opacity-70">{e.time}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-xs opacity-50 mt-3 text-center">
                This leaderboard is currently private. Scores are stored locally.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
