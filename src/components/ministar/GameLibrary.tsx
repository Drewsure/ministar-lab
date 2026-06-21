'use client';

import { useMemo } from 'react';
import { GAME_MODES } from '@/lib/gameModes';
import type { GameModeId, ThemeId } from '@/lib/types';
import { THEME_LIST } from '@/lib/themes';

interface GameLibraryProps {
  onPick: (mode: GameModeId, theme: ThemeId) => void;
  selectedTheme: ThemeId;
  onSelectTheme: (t: ThemeId) => void;
  termCount: number;
}

const ENGINE_BADGE: Record<'Selection' | 'Pairing' | 'Text', { label: string; color: string }> = {
  Selection: { label: 'Selection', color: '#22d3ee' },
  Pairing:   { label: 'Pairing',   color: '#22c55e' },
  Text:      { label: 'Text',      color: '#fbbf24' },
};

export function GameLibrary({ onPick, selectedTheme, onSelectTheme, termCount }: GameLibraryProps) {
  const groups = useMemo(() => {
    return {
      Selection: GAME_MODES.filter(m => m.engine === 'Selection'),
      Pairing:   GAME_MODES.filter(m => m.engine === 'Pairing'),
      Text:      GAME_MODES.filter(m => m.engine === 'Text'),
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Theme selector */}
      <section>
        <h2 className="text-xs uppercase tracking-widest opacity-60 mb-3" style={{ color: 'var(--brand-text)' }}>
          Choose a world
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {THEME_LIST.map(t => {
            const active = t.id === selectedTheme;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTheme(t.id)}
                className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all"
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${t.css['--brand-primary']}, ${t.css['--brand-accent']})`
                    : 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                  border: `1px solid ${active ? 'transparent' : 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'}`,
                  transform: active ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: active
                    ? `0 12px 30px -8px ${t.css['--brand-primary']}`
                    : '0 2px 8px -2px rgba(0,0,0,0.3)',
                }}
              >
                <div className="font-bold text-sm mb-1" style={{ color: active ? '#fff' : 'var(--brand-text)' }}>
                  {t.name}
                </div>
                <div className="text-xs leading-tight opacity-80" style={{ color: active ? '#fff' : 'var(--brand-text)' }}>
                  {t.tagline}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Game library, grouped by engine */}
      {(['Selection', 'Pairing', 'Text'] as const).map(engine => (
        <section key={engine}>
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{
                color: ENGINE_BADGE[engine].color,
                background: `color-mix(in oklab, ${ENGINE_BADGE[engine].color} 15%, transparent)`,
                border: `1px solid color-mix(in oklab, ${ENGINE_BADGE[engine].color} 40%, transparent)`,
              }}
            >
              {ENGINE_BADGE[engine].label} Engine
            </span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>
              {engine === 'Selection' && 'Physics & Choice'}
              {engine === 'Pairing' && 'Match & Compare'}
              {engine === 'Text' && 'Spelling & Words'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups[engine].map(mode => {
              const locked = termCount < mode.minTerms;
              return (
                <button
                  key={mode.id}
                  disabled={locked}
                  onClick={() => onPick(mode.id, selectedTheme)}
                  className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-card) 70%, transparent)',
                    border: `1px solid color-mix(in oklab, ${mode.accent} 30%, transparent)`,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                  }}
                  onMouseEnter={e => {
                    if (locked) return;
                    (e.currentTarget as HTMLElement).style.borderColor = mode.accent;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 24px -8px ${mode.accent}`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `color-mix(in oklab, ${mode.accent} 30%, transparent)`;
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                  }}
                >
                  <div className="text-3xl mb-2">{mode.emoji}</div>
                  <div className="font-bold text-base mb-1" style={{ color: 'var(--brand-text)' }}>
                    {mode.name}
                  </div>
                  <div className="text-xs leading-snug opacity-70 mb-3" style={{ color: 'var(--brand-text)' }}>
                    {mode.description}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider opacity-50" style={{ color: 'var(--brand-text)' }}>
                    {locked ? `needs ${mode.minTerms}+ terms` : `${mode.minTerms}-${mode.maxTerms} terms`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
