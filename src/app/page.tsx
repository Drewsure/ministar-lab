'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrandHeader } from '@/components/ministar/BrandHeader';
import { GameLibrary } from '@/components/ministar/GameLibrary';
import { TeacherDashboard } from '@/components/ministar/TeacherDashboard';
import GameCanvas from '@/components/ministar/GameCanvas';
import LiveMultiplayer from '@/components/ministar/LiveMultiplayer';
import LiveArena from '@/components/ministar/LiveArena';
import AIAuthStudio from '@/components/ministar/AIAuthStudio';
import ActivityOptions from '@/components/ministar/ActivityOptions';
import StarGarden from '@/components/ministar/StarGarden';
import OnboardingFlow from '@/components/ministar/OnboardingFlow';
import ParentGate from '@/components/ministar/ParentGate';
import LaunchCard from '@/components/ministar/LaunchCard';
import ErrorBoundary from '@/components/ministar/ErrorBoundary';
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
  { id: 't7', term: 'Orange', emoji: '🍊', definition: 'A round citrus fruit', verified: true },
  { id: 't8', term: 'Strawberry', emoji: '🍓', definition: 'A small sweet red fruit', verified: true },
];

// AAA 2029 — Student progression stats (persisted in localStorage)
interface StudentStats {
  xp: number;
  level: number;
  streak: number;
  lastPlayed: string; // ISO date
  gamesPlayed: number;
  bestStreak: number;
  streakFreezes: number; // Duolingo-style: protects streak on missed days
  tokens: number; // Blooket-style: spendable currency for mystery boxes
  mysteryBoxesOpened: number;
}

function loadStats(): StudentStats {
  if (typeof window === 'undefined') return { xp: 0, level: 1, streak: 0, lastPlayed: '', gamesPlayed: 0, bestStreak: 0, streakFreezes: 1, tokens: 0, mysteryBoxesOpened: 0 };
  try {
    const raw = localStorage.getItem('ministar_stats');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Grant 1 streak freeze per month (max 2)
      const now = new Date();
      const lastGrant = parsed.lastFreezeGrant ? new Date(parsed.lastFreezeGrant) : new Date(0);
      if (now.getMonth() !== lastGrant.getMonth() || now.getFullYear() !== lastGrant.getFullYear()) {
        parsed.streakFreezes = Math.min(2, (parsed.streakFreezes ?? 0) + 1);
        parsed.lastFreezeGrant = now.toISOString();
      }
      return { xp: 0, level: 1, streak: 0, lastPlayed: '', gamesPlayed: 0, bestStreak: 0, streakFreezes: 1, tokens: 0, mysteryBoxesOpened: 0, ...parsed };
    }
  } catch {}
  return { xp: 0, level: 1, streak: 0, lastPlayed: '', gamesPlayed: 0, bestStreak: 0, streakFreezes: 1, tokens: 0, mysteryBoxesOpened: 0 };
}

function saveStats(stats: StudentStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ministar_stats', JSON.stringify(stats));
  } catch {}
}

// AAA 2029 — Achievement badges (Blooket-grade engagement)
interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
}

function loadAchievements(stats: StudentStats): Achievement[] {
  const achievements: Achievement[] = [
    { id: 'first_game', name: 'First Steps', emoji: '🌱', description: 'Play your first game', unlocked: stats.gamesPlayed >= 1 },
    { id: 'five_games', name: 'Getting Started', emoji: '⭐', description: 'Play 5 games', unlocked: stats.gamesPlayed >= 5 },
    { id: 'ten_games', name: 'Game Explorer', emoji: '🎮', description: 'Play 10 games', unlocked: stats.gamesPlayed >= 10 },
    { id: 'level_5', name: 'Rising Star', emoji: '✨', description: 'Reach Level 5', unlocked: stats.level >= 5 },
    { id: 'level_10', name: 'Super Star', emoji: '🏆', description: 'Reach Level 10', unlocked: stats.level >= 10 },
    { id: 'streak_3', name: 'On Fire', emoji: '🔥', description: '3-day streak', unlocked: stats.streak >= 3 },
    { id: 'streak_7', name: 'Week Warrior', emoji: '⚔️', description: '7-day streak', unlocked: stats.streak >= 7 },
    { id: 'streak_best', name: 'Unstoppable', emoji: '💎', description: 'Best streak of 5+ days', unlocked: stats.bestStreak >= 5 },
    { id: 'xp_500', name: 'Scholar', emoji: '📚', description: 'Earn 500 XP', unlocked: stats.xp >= 500 },
    { id: 'xp_1000', name: 'Master', emoji: '👑', description: 'Earn 1000 XP', unlocked: stats.xp >= 1000 },
    { id: 'tokens_100', name: 'Collector', emoji: '🪙', description: 'Earn 100 tokens', unlocked: stats.tokens >= 100 || stats.mysteryBoxesOpened * 20 + stats.tokens >= 100 },
    { id: 'mystery_1', name: 'Treasure Hunter', emoji: '🎁', description: 'Open your first mystery box', unlocked: stats.mysteryBoxesOpened >= 1 },
    { id: 'mystery_5', name: 'Lucky Opener', emoji: '🍀', description: 'Open 5 mystery boxes', unlocked: stats.mysteryBoxesOpened >= 5 },
    { id: 'freeze_used', name: 'Protected', emoji: '❄️', description: 'Use a streak freeze', unlocked: stats.streakFreezes < 2 },
  ];
  return achievements;
}

export default function Home() {
  const { brand, setBrandKey } = useBrand();
  const [view, setView] = useState<View>('student');
  const [theme, setTheme] = useState<ThemeId>(brand.defaultTheme);
  const [terms, setTerms] = useState<TermItem[]>(DEFAULT_TERMS);
  const [launch, setLaunch] = useState<GameLaunchConfig | null>(null);
  const [liveMode, setLiveMode] = useState<{ mode: GameModeId; theme: ThemeId } | null>(null);
  const [arenaMode, setArenaMode] = useState<{ mode: GameModeId; theme: ThemeId } | null>(null);
  const [aiStudio, setAiStudio] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showStarGarden, setShowStarGarden] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showParentGate, setShowParentGate] = useState<boolean>(false);
  const [showLaunchCard, setShowLaunchCard] = useState<boolean>(false);
  const [lastScore, setLastScore] = useState<number>(0);
  const [lastDurationMs, setLastDurationMs] = useState<number>(0);
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
    // Streak logic with freeze protection (Duolingo-style)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (stats.lastPlayed === yesterday) {
      newStats.streak = stats.streak + 1;
    } else if (stats.lastPlayed !== today) {
      // Check if we missed a day and have a streak freeze
      if (stats.streak > 0 && stats.streakFreezes > 0) {
        // Consume a freeze — streak continues
        newStats.streakFreezes--;
      } else {
        newStats.streak = 1;
      }
    }
    newStats.lastPlayed = today;
    newStats.xp += 10; // +10 XP per game played
    newStats.tokens += 5; // +5 tokens per game (Blooket-style currency)
    newStats.level = Math.floor(newStats.xp / 100) + 1;
    if (newStats.streak > newStats.bestStreak) newStats.bestStreak = newStats.streak;
    setStats(newStats);
    saveStats(newStats);
  };

  // Pick up ?game= shortcut from URL (PWA shortcut support)
  // Also pick up ?room=XXXX for multiplayer join + ?auto=1 for launch card
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game') as GameModeId | null;
    const room = params.get('room');
    const autoLaunch = params.get('auto');
    if (room) {
      setLiveMode({ mode: game ?? 'quiz', theme: (params.get('theme') as ThemeId) ?? 'space' });
    } else if (game && GAME_MODE_MAP[game]) {
      // auto=1 means instant launch from a LaunchCard QR (skip onboarding)
      if (autoLaunch) {
        setTimeout(() => launchGame(game, (params.get('theme') as ThemeId) ?? theme), 200);
      } else {
        setTimeout(() => launchGame(game, theme), 100);
      }
    } else {
      // Check if this is the first visit (show onboarding)
      const onboarded = localStorage.getItem('ministar_onboarded');
      if (!onboarded) {
        setShowOnboarding(true);
      }
    }
  }, [brand.subdomain]);

  const launchLiveGame = (mode: GameModeId, themeId: ThemeId) => {
    audioBus.init();
    setLiveMode({ mode, theme: themeId });
    setLaunch(null);
  };

  const launchArena = (mode: GameModeId, themeId: ThemeId) => {
    audioBus.init();
    setArenaMode({ mode, theme: themeId });
    setLaunch(null);
  };

  const exitLive = () => {
    setLiveMode(null);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const exitArena = () => {
    setArenaMode(null);
  };

  const exitGame = () => {
    setLaunch(null);
  };

  // AAAA — Listen for game-ended events to capture score for leaderboard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLastScore(detail.score ?? 0);
      setLastDurationMs(detail.durationMs ?? 0);
    };
    window.addEventListener('ministar-game-ended', handler);
    return () => window.removeEventListener('ministar-game-ended', handler);
  }, []);

  return (
    <ErrorBoundary>
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--brand-bg)',
        color: 'var(--brand-text)',
        fontFamily: 'var(--font-display)',
      }}
    >
      {/* LIVE MULTIPLAYER MODE — takes over the whole screen */}
      {liveMode ? (
        <LiveMultiplayer
          mode={liveMode.mode}
          theme={liveMode.theme}
          terms={verifiedTerms.length > 0 ? verifiedTerms : terms}
          unit="unit-1"
          tenantId={brand.id}
          onExit={exitLive}
        />
      ) : arenaMode ? (
        <LiveArena
          mode={arenaMode.mode}
          theme={arenaMode.theme}
          terms={verifiedTerms.length > 0 ? verifiedTerms : terms}
          unit="unit-1"
          tenantId={brand.id}
          onExit={exitArena}
        />
      ) : aiStudio ? (
        <AIAuthStudio
          onPublish={(newTerms, unit) => {
            setTerms(prev => [...prev, ...newTerms]);
            setAiStudio(false);
            setView('student');
          }}
          onCancel={() => setAiStudio(false)}
        />
      ) : showStarGarden ? (
        <StarGarden onClose={() => setShowStarGarden(false)} />
      ) : (
        <>
      <BrandHeader
        brand={brand}
        onSwitchBrand={(k) => { setBrandKey(k); }}
        onOpenTeacher={() => {
          // AAAA — Parent Gate protects teacher area from young children
          if (view === 'teacher') {
            setView('student');
          } else {
            setShowParentGate(true);
          }
        }}
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
              AAA 2029 · 16 Games · 10 Worlds · Audio Learning
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
              Play amazing games, learn new words, and level up! Every game speaks to you — tap anything to hear it.
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
                  🔥 {stats.streak} day streak {stats.streakFreezes > 0 && `❄️${stats.streakFreezes}`}
                </div>
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  🎮 {stats.gamesPlayed} games
                </div>
                <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 35%, transparent)',
                    color: 'var(--brand-text)',
                  }}>
                  🪙 {stats.tokens} tokens
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
                  onClick={() => { setShowOptions(true); audioBus.play('tap'); }}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{
                    background: 'color-mix(in oklab, var(--brand-accent) 25%, transparent)',
                    color: 'var(--brand-text)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 50%, transparent)',
                  }}
                  title="Activity options: edit, print, embed, assign, style, timer, leaderboard"
                >
                  ⚙️ Options
                </button>
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
              <GameCanvas
              config={launch}
              onExit={exitGame}
              onSwitchGame={(data) => {
                // Switch template: relaunch with same terms but different game mode
                setLaunch({
                  mode: data.mode as GameModeId,
                  theme: data.theme,
                  terms: data.terms,
                  unit: data.unit,
                  tenantId: data.tenantId,
                });
              }}
              onPrint={(data) => {
                // Open print PDF in new tab via API
                const params = new URLSearchParams({
                  mode: data.mode,
                  theme: typeof data.theme === 'string' ? data.theme : 'space',
                });
                // Encode terms as URL-safe base64 (replace + with -, / with _)
                const termsJson = JSON.stringify(data.terms);
                const termsB64 = btoa(unescape(encodeURIComponent(termsJson))).replace(/\+/g, '-').replace(/\//g, '_');
                window.open(`/api/print?${params.toString()}&terms=${termsB64}`, '_blank');
                setLaunch(null);
              }}
            />
            </div>

            <div className="text-center mt-4 text-xs opacity-60" style={{ color: 'var(--brand-text)' }}>
              Tap to play · Tap any text to hear it · Press P to pause
            </div>

            {/* AAAA — Activity Options Modal (Wordwall-style) */}
            <ActivityOptions
              open={showOptions}
              onClose={() => setShowOptions(false)}
              mode={launch.mode}
              theme={launch.theme}
              terms={launch.terms}
              unit={launch.unit}
              tenantId={launch.tenantId}
              lastScore={lastScore}
              lastDurationMs={lastDurationMs}
              onEditTerms={(newTerms) => {
                setLaunch({ ...launch, terms: newTerms });
                setTerms(newTerms);
              }}
              onChangeTheme={(newTheme) => {
                setLaunch({ ...launch, theme: newTheme });
                setTheme(newTheme);
              }}
              onChangeTimer={(ms) => {
                // Timer change applies to next game launch
                localStorage.setItem('ministar_timer_override', String(ms));
              }}
              onPrint={() => {
                const params = new URLSearchParams({
                  mode: launch.mode,
                  theme: launch.theme,
                });
                const termsJson = JSON.stringify(launch.terms);
                const termsB64 = btoa(unescape(encodeURIComponent(termsJson))).replace(/\+/g, '-').replace(/\//g, '_');
                window.open(`/api/print?${params.toString()}&terms=${termsB64}`, '_blank');
              }}
            />
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
            {/* AAAA — Launch Card CTA (classroom QR instant-launch) */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, #06b6d4 25%, var(--brand-card)), color-mix(in oklab, #3b82f6 20%, var(--brand-card)))',
                border: '2px solid color-mix(in oklab, #06b6d4 50%, transparent)',
              }}>
              <div className="text-4xl">🚀</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  Launch Card
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  QR code + magic link · Students scan → instant game launch
                </div>
              </div>
              <button
                onClick={() => { setShowLaunchCard(true); audioBus.init(); audioBus.play('tap'); }}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px rgba(6,182,212,0.6)',
                }}
              >
                🚀 Create Card
              </button>
            </div>

            {/* AAAA — Star Garden CTA (progression system) */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, #fbbf24 25%, var(--brand-card)), color-mix(in oklab, #a855f7 20%, var(--brand-card)))',
                border: '2px solid color-mix(in oklab, #fbbf24 50%, transparent)',
              }}>
              <div className="text-4xl">✨</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  Star Garden
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  Earn Star Dust · Grow plants · Evolve your Cloud Dog
                </div>
              </div>
              <button
                onClick={() => { setShowStarGarden(true); audioBus.init(); audioBus.play('tap'); }}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #a855f7)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px rgba(251,191,36,0.6)',
                }}
              >
                ✨ Open Garden
              </button>
            </div>

            {/* AAAA — AI Authoring Studio CTA (the Wordwall killer) */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, #8b5cf6 25%, var(--brand-card)), color-mix(in oklab, #ec4899 20%, var(--brand-card)))',
                border: '2px solid color-mix(in oklab, #8b5cf6 50%, transparent)',
              }}>
              <div className="text-4xl">🤖</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  AI Authoring Studio
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  Type a topic → get 12 ready-to-play terms in 30 seconds
                </div>
              </div>
              <button
                onClick={() => { setAiStudio(true); audioBus.init(); audioBus.play('tap'); }}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px rgba(139,92,246,0.6)',
                }}
              >
                ✨ Generate a Lesson
              </button>
            </div>

            {/* AAAA — Competitive Arena CTA (1v1 duels) */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, #f43f5e 25%, var(--brand-card)), color-mix(in oklab, #8b5cf6 20%, var(--brand-card)))',
                border: '2px solid color-mix(in oklab, #f43f5e 50%, transparent)',
              }}>
              <div className="text-4xl">⚔️</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  Arena — 1v1 Duel
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  Battle a friend · HP-based combat · Sabotage power-ups
                </div>
              </div>
              <button
                onClick={() => launchArena('quiz', theme)}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px rgba(244,63,94,0.6)',
                }}
              >
                ⚔️ Start Duel
              </button>
            </div>

            {/* AAAA — Live Multiplayer CTA (the Blooket killer) */}
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, #ef4444 25%, var(--brand-card)), color-mix(in oklab, #f59e0b 20%, var(--brand-card)))',
                border: '2px solid color-mix(in oklab, #ef4444 50%, transparent)',
              }}>
              <div className="text-4xl">🔴</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  Live Multiplayer Classroom!
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  Host a live game · Students join with a 6-digit code · Real-time leaderboard
                </div>
              </div>
              <button
                onClick={() => launchLiveGame('quiz', theme)}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px rgba(239,68,68,0.6)',
                }}
              >
                ▶ Host Live Game
              </button>
            </div>

            {/* Daily Challenge — featured game with bonus XP */}
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, var(--brand-accent) 30%, var(--brand-card)), var(--brand-card))',
                border: '2px solid color-mix(in oklab, var(--brand-accent) 50%, transparent)',
              }}
            >
              <div className="text-4xl">🎯</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  Daily Challenge!
                </div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>
                  Play today's featured game for <span className="font-bold">DOUBLE XP</span> + bonus badges
                </div>
              </div>
              <button
                onClick={() => {
                  const today = new Date();
                  const gameIds: GameModeId[] = ['maze-chase', 'quiz', 'balloon-pop', 'gameshow', 'spin-wheel', 'memory-match', 'airplane', 'whack-a-mole', 'flash-cards', 'anagram', 'group-sort', 'bridge-builder', 'wordsearch', 'crossword', 'type-answer', 'match-up'];
                  const dailyGame = gameIds[today.getDate() % gameIds.length];
                  launchGame(dailyGame, theme);
                }}
                className="rounded-xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'var(--brand-accent)',
                  color: 'var(--brand-bg)',
                  border: 'none',
                  boxShadow: '0 4px 12px -2px var(--brand-accent)',
                }}
              >
                ▶ Play Now!
              </button>
            </div>

            {/* Unit info */}
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap"
              style={{
                background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)',
              }}
            >
              <div className="text-3xl">📚</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--brand-text)' }}>
                  Unit 1 · Fruits
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

            {/* Achievement Badges — Blooket-grade engagement */}
            {stats.gamesPlayed > 0 && (
              <div className="rounded-2xl mb-6 p-4"
                style={{
                  background: 'color-mix(in oklab, var(--brand-card) 50%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)',
                }}
              >
                <div className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-text)' }}>
                  <span className="text-xl">🏅</span> Achievements
                  <span className="ml-auto flex items-center gap-2">
                    {/* Mystery Box — Blooket-style reward */}
                    <button
                      onClick={() => {
                        if (stats.tokens >= 20) {
                          const newStats = { ...stats, tokens: stats.tokens - 20, mysteryBoxesOpened: stats.mysteryBoxesOpened + 1, xp: stats.xp + 50 };
                          setStats(newStats);
                          saveStats(newStats);
                          audioBus.init();
                          audioBus.speak('You opened a mystery box! Plus fifty XP!');
                        }
                      }}
                      disabled={stats.tokens < 20}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                      style={{
                        background: stats.tokens >= 20 ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'var(--brand-card)',
                        color: stats.tokens >= 20 ? '#fff' : 'var(--brand-text)',
                        opacity: stats.tokens >= 20 ? 1 : 0.4,
                        border: '1px solid rgba(255,255,255,0.2)',
                        cursor: stats.tokens >= 20 ? 'pointer' : 'not-allowed',
                      }}
                      title="Open a mystery box for 20 tokens — get 50 bonus XP!"
                    >
                      🎁 Mystery Box (20🪙)
                    </button>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {loadAchievements(stats).map(a => (
                    <div
                      key={a.id}
                      className="rounded-xl p-2 text-center transition-all"
                      style={{
                        background: a.unlocked
                          ? 'color-mix(in oklab, var(--brand-accent) 25%, transparent)'
                          : 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
                        border: `1px solid ${a.unlocked ? 'color-mix(in oklab, var(--brand-accent) 50%, transparent)' : 'color-mix(in oklab, var(--brand-accent) 15%, transparent)'}`,
                        opacity: a.unlocked ? 1 : 0.4,
                        width: '80px',
                      }}
                      title={a.description}
                    >
                      <div className="text-2xl mb-1" style={{ filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{a.emoji}</div>
                      <div className="text-[10px] font-semibold leading-tight" style={{ color: 'var(--brand-text)' }}>{a.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            © 2029 {brand.displayName} · MiniStar Learning Games
          </div>
          <div className="flex items-center gap-4">
            <span>16 Games</span>
            <span>·</span>
            <span>10 Worlds</span>
            <span>·</span>
            <span>Audio Enabled</span>
            <span>·</span>
            <span>Level Up!</span>
          </div>
        </div>
      </footer>
        </>
      )}

      {/* AAAA — Onboarding Flow (first visit only) */}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem('ministar_onboarded', '1');
        }} />
      )}

      {/* AAAA — Parent Gate (protects teacher area) */}
      <ParentGate
        open={showParentGate}
        onSuccess={() => {
          setShowParentGate(false);
          setView('teacher');
        }}
        onCancel={() => setShowParentGate(false)}
      />

      {/* AAAA — Launch Card (QR + magic link for classroom) */}
      <LaunchCard
        open={showLaunchCard}
        onClose={() => setShowLaunchCard(false)}
        onLaunch={(m, t) => launchGame(m, t)}
      />
    </div>
    </ErrorBoundary>
  );
}
