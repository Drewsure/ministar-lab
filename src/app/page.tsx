'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrandHeader } from '@/components/ministar/BrandHeader';
import { GameLibrary } from '@/components/ministar/GameLibrary';
import { TeacherDashboard } from '@/components/ministar/TeacherDashboard';
import GameCanvas from '@/components/ministar/GameCanvas';
import { useBrand } from '@/components/ministar/useBrand';
import { THEMES } from '@/lib/themes';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import type { GameLaunchConfig, GameModeId, ThemeId, TermItem } from '@/lib/types';
import { audioBus } from '@/lib/audio';

type View = 'student' | 'teacher';

const DEFAULT_TERMS: TermItem[] = [
  { id: 't1', term: 'Apple', emoji: '🍎', definition: 'A red or green fruit', verified: true },
  { id: 't2', term: 'Banana', emoji: '🍌', definition: 'A long yellow fruit', verified: true },
  { id: 't3', term: 'Cherry', emoji: '🍒', definition: 'A small red fruit', verified: true },
  { id: 't4', term: 'Grape', emoji: '🍇', definition: 'A small purple fruit', verified: true },
  { id: 't5', term: 'Lemon', emoji: '🍋', definition: 'A sour yellow fruit', verified: true },
  { id: 't6', term: 'Mango', emoji: '🥭', definition: 'A tropical orange fruit', verified: true },
];

// AAA 2029 — Student progression stats (persisted in localStorage)
interface StudentStats {
  xp: number;
  level: number;
  streak: number;
  lastPlayed: string; // ISO date
  gamesPlayed: number;
  bestStreak: number;
}

function loadStats(): StudentStats {
  if (typeof window === 'undefined') return { xp: 0, level: 1, streak: 0, lastPlayed: '', gamesPlayed: 0, bestStreak: 0 };
  try {
    const raw = localStorage.getItem('ministar_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { xp: 0, level: 1, streak: 0, lastPlayed: '', gamesPlayed: 0, bestStreak: 0 };
}

function saveStats(stats: StudentStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ministar_stats', JSON.stringify(stats));
  } catch {}
}

export default function Home() {
  const { brand, setBrandKey } = useBrand();
  const [view, setView] = useState<View>('student');
  const [theme, setTheme] = useState<ThemeId>(brand.defaultTheme);
  const [terms, setTerms] = useState<TermItem[]>(DEFAULT_TERMS);
  const [launch, setLaunch] = useState<GameLaunchConfig | null>(null);
  const [lastBrand, setLastBrand] = useState(brand.subdomain);
  const [stats, setStats] = useState<StudentStats>(() => loadStats());

  // Sync theme when brand changes
  if (brand.subdomain !== lastBrand) {
    setLastBrand(brand.subdomain);
    setTheme(brand.defaultTheme);
  }

  const verifiedTerms = useMemo(() => terms.filter(t => t.verified), [terms]);

  const launchGame = (mode: GameModeId, themeId: ThemeId) => {
    audioBus.init();
    const cfg: GameLaunchConfig = {
      mode,
      theme: themeId,
      terms: verifiedTerms.length >= GAME_MODE_MAP[mode].minTerms ? verifiedTerms : terms,
      unit: 'unit-1',
      tenantId: brand.id,
    };
    setLaunch(cfg);
    setView('student');

    // Update stats on game launch
    const today = new Date().toISOString().split('T')[0];
    const newStats = { ...stats };
    newStats.gamesPlayed++;
    // Streak: if played yesterday, increment; if played today, keep; else reset
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (stats.lastPlayed === yesterday) {
      newStats.streak = stats.streak + 1;
    } else if (stats.lastPlayed !== today) {
      newStats.streak = 1;
    }
    newStats.lastPlayed = today;
    newStats.xp += 10; // +10 XP per game played
    newStats.level = Math.floor(newStats.xp / 100) + 1;
    if (newStats.streak > newStats.bestStreak) newStats.bestStreak = newStats.streak;
    setStats(newStats);
    saveStats(newStats);
  };

  // Pick up ?game= shortcut from URL (PWA shortcut support)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game') as GameModeId | null;
    if (game && GAME_MODE_MAP[game]) {
      setTimeout(() => launchGame(game, theme), 100);
    }
  }, [brand.subdomain]);

  const exitGame = () => {
    setLaunch(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--brand-bg)',
        color: 'var(--brand-text)',
        fontFamily: 'var(--font-display)',
      }}
    >
      <BrandHeader
        brand={brand}
        onSwitchBrand={(k) => { setBrandKey(k); }}
        onOpenTeacher={() => setView(v => v === 'teacher' ? 'student' : 'teacher')}
        isTeacherOpen={view === 'teacher'}
      />

      {/* Hero band */}
      {!launch && (
        <section className="relative overflow-hidden pt-safe">
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background: `radial-gradient(80% 60% at 50% 0%, ${brand.primaryColor}40 0%, transparent 60%),
                           radial-gradient(60% 50% at 80% 20%, ${brand.accentColor}30 0%, transparent 60%)`,
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-6 text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{
                background: `color-mix(in oklab, ${brand.accentColor} 18%, transparent)`,
                color: brand.accentColor,
                border: `1px solid color-mix(in oklab, ${brand.accentColor} 40%, transparent)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: brand.accentColor }} />
              AAA 2029 · PWA · 16 Engines · 10 Worlds
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black tracking-tight mb-2"
              style={{
                background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.accentColor})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              The Living Textbook
            </h1>
            <p className="text-sm sm:text-base opacity-80 max-w-2xl mx-auto" style={{ color: 'var(--brand-text)' }}>
              Physics-driven vocabulary games. AI-authored content. Server-authoritative anti-cheat.
              Whitelabel-ready for every B2B purchaser.
            </p>

            {/* AAA 2029 — Student Stats Bar */}
            {!launch && stats.gamesPlayed > 0 && (
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  ⭐ Level {stats.level}
                </div>
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  ✨ {stats.xp} XP
                </div>
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  🔥 {stats.streak} day streak
                </div>
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  🎮 {stats.gamesPlayed} games
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-12">
        {launch ? (
          // -----------------------------------------------------------------
          // GAME VIEW
          // -----------------------------------------------------------------
          <div className="ministar-rise">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: 'var(--brand-text)' }}>
                  Now playing · {THEMES[launch.theme].name}
                </div>
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  {GAME_MODE_MAP[launch.mode].emoji} {GAME_MODE_MAP[launch.mode].name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Restart the game by toggling launch
                    const cfg = launch;
                    setLaunch(null);
                    setTimeout(() => setLaunch(cfg), 100);
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 25%, transparent)',
                    color: 'var(--brand-text)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 50%, transparent)',
                  }}
                  title="Start a fresh game"
                >
                  🔄 New Game
                </button>
                <button
                  onClick={() => {
                    const enabled = !audioBus.isTTSEnabled();
                    audioBus.setTTSEnabled(enabled);
                    if (enabled) audioBus.speak('Audio enabled');
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)',
                    color: 'var(--brand-text)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
                  }}
                  title="Toggle text-to-speech for ESL learners"
                >
                  🔊 Audio
                </button>
                <button
                  onClick={exitGame}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)',
                    color: 'var(--brand-text)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
                  }}
                >
                  ← Back to Library
                </button>
              </div>
            </div>

            <div
              className="mx-auto rounded-3xl overflow-hidden shadow-2xl"
              style={{
                maxWidth: '900px',
                maxHeight: '70vh',
                border: `1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)`,
                boxShadow: `0 30px 80px -20px ${brand.primaryColor}80`,
              }}
            >
              <GameCanvas config={launch} onExit={exitGame} />
            </div>

            <div className="text-center mt-4 text-xs opacity-60" style={{ color: 'var(--brand-text)' }}>
              WASD / Arrow keys to move · Tap to steer · Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 mx-1">P</kbd> to pause
            </div>
          </div>
        ) : view === 'teacher' ? (
          // -----------------------------------------------------------------
          // TEACHER VIEW
          // -----------------------------------------------------------------
          <div className="ministar-rise pt-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: 'var(--brand-text)' }}>
                  Teacher Dashboard
                </div>
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  📚 Content Authoring & Analytics
                </div>
              </div>
              <button
                onClick={() => setView('student')}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)',
                  color: 'var(--brand-text)',
                  border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
                }}
              >
                ← Back to Student Library
              </button>
            </div>
            <TeacherDashboard
              terms={terms}
              setTerms={setTerms}
              onLaunch={(m, t) => launchGame(m, t)}
              tenantId={brand.id}
            />
          </div>
        ) : (
          // -----------------------------------------------------------------
          // STUDENT VIEW — game library
          // -----------------------------------------------------------------
          <div className="ministar-rise pt-2">
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)',
              }}
            >
              <div className="text-3xl">📚</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--brand-text)' }}>
                  Unit 1 · Fruits & Animals
                </div>
                <div className="text-xs opacity-70" style={{ color: 'var(--brand-text)' }}>
                  {verifiedTerms.length} verified terms ready to play
                </div>
              </div>
              <button
                onClick={() => setView('teacher')}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)',
                  color: 'var(--brand-text)',
                  border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
                }}
              >
                Teacher Dashboard →
              </button>
            </div>

            <GameLibrary
              onPick={(m, t) => launchGame(m, t)}
              selectedTheme={theme}
              onSelectTheme={setTheme}
              termCount={verifiedTerms.length}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="mt-auto border-t pt-6 pb-8 px-4 sm:px-6"
        style={{ borderColor: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)' }}
      >
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-60"
          style={{ color: 'var(--brand-text)' }}>
          <div>
            © 2029 {brand.displayName} · Powered by MiniStar Living Textbook Engine
          </div>
          <div className="flex items-center gap-4">
            <span>16 Engines</span>
            <span>·</span>
            <span>10 Worlds</span>
            <span>·</span>
            <span>xAPI Telemetry</span>
            <span>·</span>
            <span>White-Label PWA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
