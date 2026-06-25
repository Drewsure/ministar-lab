'use client';

import { useState } from 'react';
import type { TermItem, GameModeId, ThemeId } from '@/lib/types';
import { GAME_MODES } from '@/lib/gameModes';
import { THEME_LIST } from '@/lib/themes';

interface TeacherDashboardProps {
  terms: TermItem[];
  setTerms: (t: TermItem[]) => void;
  onLaunch: (mode: GameModeId, theme: ThemeId) => void;
  tenantId?: string;
}

type Tab = 'author' | 'verify' | 'launch' | 'qr' | 'telemetry';

export function TeacherDashboard({ terms, setTerms, onLaunch, tenantId }: TeacherDashboardProps) {
  const [tab, setTab] = useState<Tab>('author');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'author',    label: 'AI Author',    icon: '✨' },
    { id: 'verify',    label: 'Verify & Audio', icon: '🎧' },
    { id: 'launch',    label: 'Launch Game',  icon: '🚀' },
    { id: 'qr',        label: 'QR Routing',   icon: '📱' },
    { id: 'telemetry', label: 'Telemetry',    icon: '📊' },
  ];

  return (
    <div className="rounded-3xl overflow-hidden" style={{
      background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
      border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)',
    }}>
      {/* Tab bar */}
      <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2"
            style={{
              color: tab === t.id ? 'var(--brand-accent)' : 'var(--brand-text)',
              borderColor: tab === t.id ? 'var(--brand-accent)' : 'transparent',
              background: tab === t.id ? 'color-mix(in oklab, var(--brand-accent) 8%, transparent)' : 'transparent',
            }}
          >
            <span className="mr-2">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-7">
        {tab === 'author'    && <AuthorTab terms={terms} setTerms={setTerms} tenantId={tenantId} />}
        {tab === 'verify'    && <VerifyTab terms={terms} setTerms={setTerms} />}
        {tab === 'launch'    && <LaunchTab terms={terms} onLaunch={onLaunch} />}
        {tab === 'qr'        && <QrTab terms={terms} tenantId={tenantId} />}
        {tab === 'telemetry' && <TelemetryTab tenantId={tenantId} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. AI Author — LLM extracts terms from raw chapter text
// ---------------------------------------------------------------------------
function AuthorTab({ terms, setTerms, tenantId }: { terms: TermItem[]; setTerms: (t: TermItem[]) => void; tenantId?: string }) {
  const [rawText, setRawText] = useState('Apple, Banana, Cherry, Grape, Lemon, Mango');
  const [unit, setUnit] = useState('unit-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/llm-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, unit, tenantId }),
      });
      if (!res.ok) throw new Error('Author API failed');
      const data = await res.json();
      setTerms(data.terms as TermItem[]);
    } catch (e: any) {
      setError(e.message ?? 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--brand-text)' }}>
          Zero-Prep AI Authoring
        </h3>
        <p className="text-sm opacity-70" style={{ color: 'var(--brand-text)' }}>
          Paste raw chapter text, homework, or vocabulary lists. The LLM extracts terms into the unified schema. The teacher verifies spelling + audio before any term reaches a game.
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider opacity-60 mb-1 block" style={{ color: 'var(--brand-text)' }}>
          Unit
        </label>
        <input
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="w-full sm:w-48 rounded-xl px-4 py-2.5 text-sm"
          style={{
            background: 'color-mix(in oklab, var(--brand-bg) 50%, transparent)',
            border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)',
            color: 'var(--brand-text)',
          }}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider opacity-60 mb-1 block" style={{ color: 'var(--brand-text)' }}>
          Raw text
        </label>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          rows={5}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono"
          style={{
            background: 'color-mix(in oklab, var(--brand-bg) 50%, transparent)',
            border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)',
            color: 'var(--brand-text)',
            resize: 'vertical',
          }}
        />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'color-mix(in oklab, #ef4444 20%, transparent)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <button
        onClick={extract}
        disabled={loading}
        className="rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))`,
          color: '#fff',
          boxShadow: '0 8px 20px -4px var(--brand-primary)',
        }}
      >
        {loading ? '⏳ LLM extracting…' : '✨ Extract Terms with LLM'}
      </button>

      {terms.length > 0 && (
        <div className="rounded-xl p-4 text-sm" style={{
          background: 'color-mix(in oklab, #22c55e 12%, transparent)',
          border: '1px solid color-mix(in oklab, #22c55e 40%, transparent)',
          color: 'var(--brand-text)',
        }}>
          ✓ {terms.length} terms extracted. Move to <strong>Verify & Audio</strong> to lock them in.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Verify — teacher verifies spelling + maps audio per term
// ---------------------------------------------------------------------------
function VerifyTab({ terms, setTerms }: { terms: TermItem[]; setTerms: (t: TermItem[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);

  const toggleVerified = (id: string) => {
    setTerms(terms.map(t => t.id === id ? { ...t, verified: !t.verified } : t));
  };

  const updateTerm = (id: string, patch: Partial<TermItem>) => {
    setTerms(terms.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const addTerm = () => {
    const newId = `term-${Date.now()}`;
    setTerms([...terms, { id: newId, term: 'New Term', emoji: '❓', verified: false }]);
    setEditing(newId);
  };

  const removeTerm = (id: string) => {
    setTerms(terms.filter(t => t.id !== id));
  };

  const verifiedCount = terms.filter(t => t.verified).length;

  if (terms.length === 0) {
    return (
      <div className="text-center py-12 opacity-60" style={{ color: 'var(--brand-text)' }}>
        <div className="text-4xl mb-3">📚</div>
        <div>No terms yet. Use the <strong>AI Author</strong> tab to extract some.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>Verify & Audio Mapping</h3>
          <p className="text-sm opacity-70" style={{ color: 'var(--brand-text)' }}>
            Lock spelling, attach audio files, and approve. Only verified terms enter game engines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--brand-text)' }}>
            <strong style={{ color: 'var(--brand-accent)' }}>{verifiedCount}</strong> / {terms.length} verified
          </span>
          <button
            onClick={addTerm}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{
              background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)',
              color: 'var(--brand-text)',
              border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
            }}
          >+ Add Term</button>
        </div>
      </div>

      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2">
        {terms.map(t => (
          <div
            key={t.id}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: 'color-mix(in oklab, var(--brand-bg) 40%, transparent)',
              border: `1px solid ${t.verified ? 'color-mix(in oklab, #22c55e 50%, transparent)' : 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'}`,
            }}
          >
            <button
              onClick={() => toggleVerified(t.id)}
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{
                background: t.verified ? '#22c55e' : 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
                color: t.verified ? '#000' : 'var(--brand-text)',
                border: `1px solid ${t.verified ? '#22c55e' : 'color-mix(in oklab, var(--brand-accent) 40%, transparent)'}`,
              }}
            >
              {t.verified ? '✓' : '?'}
            </button>
            <div className="flex-1 min-w-0">
              {editing === t.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={t.term}
                      onChange={e => updateTerm(t.id, { term: e.target.value })}
                      className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                      style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }}
                    />
                    <input
                      value={t.emoji ?? ''}
                      onChange={e => updateTerm(t.id, { emoji: e.target.value })}
                      placeholder="Emoji"
                      className="w-16 rounded-lg px-3 py-1.5 text-sm text-center"
                      style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }}
                    />
                  </div>
                  <input
                    value={t.definition ?? ''}
                    onChange={e => updateTerm(t.id, { definition: e.target.value })}
                    placeholder="Definition (optional)"
                    className="w-full rounded-lg px-3 py-1.5 text-sm"
                    style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }}
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: 'var(--brand-text)' }}>
                    {t.emoji} {t.term}
                  </div>
                  {t.definition && (
                    <div className="text-xs opacity-60 truncate" style={{ color: 'var(--brand-text)' }}>
                      {t.definition}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(editing === t.id ? null : t.id)}
                className="px-2 py-1 text-xs rounded-md opacity-70 hover:opacity-100"
                style={{ color: 'var(--brand-text)' }}
              >
                {editing === t.id ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={() => removeTerm(t.id)}
                className="px-2 py-1 text-xs rounded-md opacity-70 hover:opacity-100"
                style={{ color: '#fca5a5' }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Launch — pick a verified game + theme and play
// ---------------------------------------------------------------------------
function LaunchTab({ terms, onLaunch }: { terms: TermItem[]; onLaunch: (m: GameModeId, t: ThemeId) => void }) {
  const [mode, setMode] = useState<GameModeId>('maze-chase');
  const [theme, setTheme] = useState<ThemeId>('space');
  const verifiedTerms = terms.filter(t => t.verified);
  const meta = GAME_MODES.find(m => m.id === mode)!;
  const canLaunch = verifiedTerms.length >= meta.minTerms;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>Launch a Game Session</h3>
        <p className="text-sm opacity-70" style={{ color: 'var(--brand-text)' }}>
          {verifiedTerms.length} verified terms available. Pick an engine + world.
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider opacity-60 mb-2 block" style={{ color: 'var(--brand-text)' }}>
          Engine
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {GAME_MODES.map(m => {
            const active = m.id === mode;
            const locked = verifiedTerms.length < m.minTerms;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={locked}
                className="rounded-xl p-3 text-left text-sm transition-all disabled:opacity-40"
                style={{
                  background: active ? `color-mix(in oklab, ${m.accent} 25%, transparent)` : 'color-mix(in oklab, var(--brand-bg) 40%, transparent)',
                  border: `1px solid ${active ? m.accent : 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'}`,
                  color: 'var(--brand-text)',
                }}
              >
                <div className="text-xl mb-1">{m.emoji}</div>
                <div className="font-semibold text-xs">{m.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider opacity-60 mb-2 block" style={{ color: 'var(--brand-text)' }}>
          World
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEME_LIST.map(t => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="rounded-xl p-3 text-left text-sm transition-all"
                style={{
                  background: active ? `linear-gradient(135deg, ${t.css['--brand-primary']}, ${t.css['--brand-accent']})` : 'color-mix(in oklab, var(--brand-bg) 40%, transparent)',
                  border: `1px solid ${active ? 'transparent' : 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'}`,
                  color: active ? '#fff' : 'var(--brand-text)',
                }}
              >
                <div className="font-semibold text-xs">{t.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onLaunch(mode, theme)}
        disabled={!canLaunch}
        className="w-full sm:w-auto rounded-xl px-6 py-3 text-sm font-bold transition-all disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))`,
          color: '#fff',
          boxShadow: '0 8px 20px -4px var(--brand-primary)',
        }}
      >
        {canLaunch ? `▶ Launch ${meta.name}` : `Need ${meta.minTerms - verifiedTerms.length} more verified term(s)`}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. QR Routing — bake-in vs dynamic
// ---------------------------------------------------------------------------
function QrTab({ terms, tenantId }: { terms: TermItem[]; tenantId?: string }) {
  const [routes, setRoutes] = useState<{ slug: string; unit: string; gameMode: GameModeId; themeId: ThemeId; bakeIn: boolean }[]>([
    { slug: 'unit-1', unit: 'unit-1', gameMode: 'maze-chase', themeId: 'space', bakeIn: true },
  ]);

  const add = () => {
    setRoutes([...routes, { slug: `unit-${routes.length + 1}`, unit: `unit-${routes.length + 1}`, gameMode: 'memory-match', themeId: 'jungle', bakeIn: false }]);
  };
  const update = (i: number, patch: Partial<typeof routes[number]>) => {
    setRoutes(routes.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const remove = (i: number) => setRoutes(routes.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>QR Routing</h3>
        <p className="text-sm opacity-70" style={{ color: 'var(--brand-text)' }}>
          Printed tabletop books contain static QR codes. Teachers control the destination:
          <strong> Bake-In</strong> locks the route permanently; <strong>Dynamic</strong> lets admins swap the game/theme without reprinting.
        </p>
      </div>

      <div className="space-y-3">
        {routes.map((r, i) => (
          <div key={i} className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
            style={{ background: 'color-mix(in oklab, var(--brand-bg) 40%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)' }}>
            <div>
              <label className="text-[10px] uppercase tracking-wider opacity-60 block mb-1" style={{ color: 'var(--brand-text)' }}>Route slug</label>
              <input value={r.slug} onChange={e => update(i, { slug: e.target.value })} className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
                style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }} />
              <div className="text-[10px] mt-1 opacity-60" style={{ color: 'var(--brand-text)' }}>
                QR URL: portal.purchaser.com/route/{r.slug || '…'}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider opacity-60 block mb-1" style={{ color: 'var(--brand-text)' }}>Unit</label>
              <input value={r.unit} onChange={e => update(i, { unit: e.target.value })} className="w-full rounded-lg px-3 py-1.5 text-sm"
                style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider opacity-60 block mb-1" style={{ color: 'var(--brand-text)' }}>Game</label>
              <select value={r.gameMode} onChange={e => update(i, { gameMode: e.target.value as GameModeId })} className="w-full rounded-lg px-3 py-1.5 text-sm"
                style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }}>
                {GAME_MODES.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider opacity-60 block mb-1" style={{ color: 'var(--brand-text)' }}>Theme</label>
              <select value={r.themeId} onChange={e => update(i, { themeId: e.target.value as ThemeId })} className="w-full rounded-lg px-3 py-1.5 text-sm"
                style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-accent)', color: 'var(--brand-text)' }}>
                {THEME_LIST.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--brand-text)' }}>
                <input type="checkbox" checked={r.bakeIn} onChange={e => update(i, { bakeIn: e.target.checked })} />
                <span>🔒 Bake-In (lock permanently)</span>
              </label>
              <button onClick={() => remove(i)} className="ml-auto text-xs px-2 py-1 rounded-md opacity-70 hover:opacity-100" style={{ color: '#fca5a5' }}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={add} className="rounded-xl px-4 py-2 text-sm font-semibold"
        style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
        + Add Route
      </button>

      <div className="text-xs opacity-60" style={{ color: 'var(--brand-text)' }}>
        {terms.filter(t => t.verified).length} verified terms · tenant: {tenantId ?? 'demo'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Telemetry — live xAPI stream + quarantined scores
// ---------------------------------------------------------------------------
function TelemetryTab({ tenantId }: { tenantId?: string }) {
  const [events, setEvents] = useState<any[] | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch('/api/telemetry/verify?tenantId=' + (tenantId ?? ''));
      const data = await r.json();
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>Live xAPI Telemetry</h3>
          <p className="text-sm opacity-70" style={{ color: 'var(--brand-text)' }}>
            Every interaction dispatches an xAPI event. The server-authoritative gate quarantines anomalies.
          </p>
        </div>
        <button onClick={refresh} className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
          ↻ Refresh
        </button>
      </div>

      {events === null ? (
        <div className="text-center py-12 opacity-60 text-sm" style={{ color: 'var(--brand-text)' }}>
          Click <strong>Refresh</strong> to load recent events from the serverless endpoint.
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 opacity-60 text-sm" style={{ color: 'var(--brand-text)' }}>
          No telemetry events yet. Play a game — every tap dispatches an xAPI payload.
        </div>
      ) : (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2">
          {events.map((e, i) => {
            const status = e.status ?? 'ok';
            const color = status === 'quarantine' ? '#ef4444' : status === 'review' ? '#fbbf24' : '#22c55e';
            return (
              <div key={i} className="rounded-xl p-3 flex items-center gap-3 text-xs"
                style={{ background: 'color-mix(in oklab, var(--brand-bg) 40%, transparent)', border: `1px solid color-mix(in oklab, ${color} 40%, transparent)` }}>
                <span className="px-2 py-1 rounded font-bold uppercase tracking-wider" style={{ background: `color-mix(in oklab, ${color} 25%, transparent)`, color }}>
                  {status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate" style={{ color: 'var(--brand-text)' }}>
                    {e.gameMode} · {e.unit} · score {e.score ?? '—'}
                  </div>
                  {e.anomalyReason && (
                    <div className="opacity-70 truncate" style={{ color }}>
                      ⚠ {e.anomalyReason}
                    </div>
                  )}
                </div>
                <div className="opacity-50 whitespace-nowrap" style={{ color: 'var(--brand-text)' }}>
                  {new Date(e.createdAt).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
