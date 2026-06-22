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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {THEME_LIST.map(t => {
            const active = t.id === selectedTheme;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTheme(t.id)}
                className="group relative overflow-hidden rounded-3xl p-4 text-center transition-all"
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${t.css['--brand-primary']}, ${t.css['--brand-accent']})`
                    : 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                  border: `2px solid ${active ? 'transparent' : 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'}`,
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: active
                    ? `0 12px 30px -8px ${t.css['--brand-primary']}`
                    : '0 2px 8px -2px rgba(0,0,0,0.3)',
                  minHeight: '90px',
                }}
              >
                <div className="text-2xl mb-1">
                  {t.id === 'space' && '🚀'}
                  {t.id === 'jungle' && '🌴'}
                  {t.id === 'festival' && '🎪'}
                  {t.id === 'cityscape' && '🌃'}
                  {t.id === 'ocean' && '🌊'}
                  {t.id === 'candy' && '🍬'}
                  {t.id === 'haunted' && '👻'}
                  {t.id === 'sports' && '⚽'}
                  {t.id === 'christmas' && '🎄'}
                  {t.id === 'easter' && '🐰'}
                </div>
                <div className="font-bold text-sm" style={{ color: active ? '#fff' : 'var(--brand-text)' }}>
                  {t.name}
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
                  className="group relative overflow-hidden rounded-3xl p-6 text-left transition-all"
                  style={{
                    background: locked
                      ? 'color-mix(in oklab, var(--brand-card) 50%, transparent)'
                      : `linear-gradient(135deg, color-mix(in oklab, ${mode.accent} 25%, var(--brand-card)), var(--brand-card))`,
                    border: `2px solid ${locked ? 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' : `color-mix(in oklab, ${mode.accent} 50%, transparent)`}`,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.5 : 1,
                    minHeight: '140px',
                  }}
                  onMouseEnter={e => {
                    if (locked) return;
                    (e.currentTarget as HTMLElement).style.borderColor = mode.accent;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px) scale(1.03)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 15px 30px -8px ${mode.accent}`;
                  }}
                  onMouseLeave={e => {
                    if (locked) return;
                    (e.currentTarget as HTMLElement).style.borderColor = `color-mix(in oklab, ${mode.accent} 50%, transparent)`;
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                  }}
                >
                  <div className="text-5xl mb-3" style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{mode.emoji}</div>
                  <div className="font-bold text-lg mb-1" style={{ color: 'var(--brand-text)' }}>
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
