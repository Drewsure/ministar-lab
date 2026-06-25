'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrandHeader } from '@/components/ministar/BrandHeader';
import { GameLibrary } from '@/components/ministar/GameLibrary';
import { TeacherDashboard } from '@/components/ministar/TeacherDashboard';
import GameCanvas from '@/components/ministar/GameCanvas';
import StarGarden from '@/components/ministar/StarGarden';
import OnboardingFlow from '@/components/ministar/OnboardingFlow';
import ParentGate from '@/components/ministar/ParentGate';
import LaunchCard from '@/components/ministar/LaunchCard';
import ErrorBoundary from '@/components/ministar/ErrorBoundary';
import AIAuthStudio from '@/components/ministar/AIAuthStudio';
import LiveMultiplayer from '@/components/ministar/LiveMultiplayer';
import { useBrand } from '@/components/ministar/useBrand';
import { THEMES } from '@/lib/themes';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { loadStarDust } from '@/lib/stardust';
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

export default function Home() {
  const { brand, setBrandKey } = useBrand();
  const [view, setView] = useState<View>('student');
  const [theme, setTheme] = useState<ThemeId>(brand.defaultTheme);
  const [terms, setTerms] = useState<TermItem[]>(DEFAULT_TERMS);
  const [launch, setLaunch] = useState<GameLaunchConfig | null>(null);
  const [lastBrand, setLastBrand] = useState(brand.subdomain);
  const [showStarGarden, setShowStarGarden] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showParentGate, setShowParentGate] = useState(false);
  const [showLaunchCard, setShowLaunchCard] = useState(false);
  const [showAIStudio, setShowAIStudio] = useState(false);
  const [showLiveMP, setShowLiveMP] = useState(false);
  const [starDust, setStarDust] = useState(0);

  if (brand.subdomain !== lastBrand) {
    setLastBrand(brand.subdomain);
    setTheme(brand.defaultTheme);
  }

  const verifiedTerms = useMemo(() => terms.filter(t => t.verified), [terms]);

  const launchGame = (mode: GameModeId, themeId: ThemeId) => {
    audioBus.init();
    const cfg: GameLaunchConfig = {
      mode, theme: themeId,
      terms: verifiedTerms.length >= GAME_MODE_MAP[mode]?.minTerms ? verifiedTerms : terms,
      unit: 'unit-1', tenantId: brand.id,
    };
    setLaunch(cfg);
    setView('student');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game') as GameModeId | null;
    const autoLaunch = params.get('auto');
    if (game && GAME_MODE_MAP[game]) {
      if (autoLaunch) setTimeout(() => launchGame(game, (params.get('theme') as ThemeId) ?? theme), 200);
      else setTimeout(() => launchGame(game, theme), 100);
    } else {
      const onboarded = localStorage.getItem('ministar_onboarded');
      if (!onboarded) setShowOnboarding(true);
    }
    setStarDust(loadStarDust().available);
  }, [brand.subdomain]);

  const exitGame = () => setLaunch(null);

  return (
    <ErrorBoundary>
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', fontFamily: 'var(--font-display)' }}>
      <BrandHeader brand={brand} onSwitchBrand={(k) => setBrandKey(k)} onOpenTeacher={() => { if (view === 'teacher') setView('student'); else setShowParentGate(true); }} isTeacherOpen={view === 'teacher'} />

      {!launch && (
        <section className="relative overflow-hidden pt-safe">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ background: `color-mix(in oklab, ${brand.accentColor} 18%, transparent)`, color: brand.accentColor, border: `1px solid color-mix(in oklab, ${brand.accentColor} 40%, transparent)` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: brand.accentColor }} />
              AAAA 2029 · 24 Games · 10 Worlds · Audio Learning
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2" style={{ background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.accentColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              The Living Textbook
            </h1>
            <p className="text-sm sm:text-base opacity-80 max-w-2xl mx-auto" style={{ color: 'var(--brand-text)' }}>
              Play amazing games, learn new words, and level up! Every game speaks to you — tap anything to hear it.
            </p>
          </div>
        </section>
      )}

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-12">
        {launch ? (
          <div className="ministar-rise">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: 'var(--brand-text)' }}>
                  Now playing · {THEMES[launch.theme]?.name ?? 'World'}
                </div>
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>
                  {GAME_MODE_MAP[launch.mode]?.emoji ?? '🎮'} {GAME_MODE_MAP[launch.mode]?.name ?? 'Game'}
                </div>
              </div>
              <button onClick={exitGame} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
                ← Back to Library
              </button>
            </div>
            <div className="mx-auto rounded-3xl overflow-hidden shadow-2xl" style={{ maxWidth: '900px', maxHeight: '70vh', border: `1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)` }}>
              <GameCanvas config={launch} onExit={exitGame} />
            </div>
            <div className="text-center mt-4 text-xs opacity-60" style={{ color: 'var(--brand-text)' }}>
              Tap to play · Tap any text to hear it · Press P to pause
            </div>
          </div>
        ) : view === 'teacher' ? (
          <div className="ministar-rise pt-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: 'var(--brand-text)' }}>Teacher Dashboard</div>
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>📚 Content Authoring & Analytics</div>
              </div>
              <button onClick={() => setView('student')} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
                ← Back to Student Library
              </button>
            </div>
            <TeacherDashboard terms={terms} setTerms={setTerms} onLaunch={(m, t) => launchGame(m, t)} tenantId={brand.id}
              onLiveMultiplayer={() => setShowLiveMP(true)}
              onAIStudio={() => setShowAIStudio(true)}
              onLaunchCard={() => setShowLaunchCard(true)} />
          </div>
        ) : (
          <div className="ministar-rise pt-2">
            {/* Star Garden CTA */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, #fbbf24 25%, var(--brand-card)), color-mix(in oklab, #a855f7 20%, var(--brand-card)))', border: '2px solid color-mix(in oklab, #fbbf24 50%, transparent)' }}>
              <div className="text-4xl">✨</div>
              <div className="flex-1 min-w-0"><div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>Star Garden</div><div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>Earn Star Dust · Grow plants · Evolve your Cloud Dog · {starDust} ⭐ available</div></div>
              <button onClick={() => { setShowStarGarden(true); audioBus.init(); audioBus.play('tap'); }} className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: 'linear-gradient(135deg, #fbbf24, #a855f7)', color: '#fff', border: 'none', boxShadow: '0 4px 12px -2px rgba(251,191,36,0.6)' }}>✨ Open Garden</button>
            </div>

            {/* Launch Card CTA */}
            <div className="rounded-2xl mb-3 p-4 flex items-center gap-4 flex-wrap" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, #06b6d4 25%, var(--brand-card)), color-mix(in oklab, #3b82f6 20%, var(--brand-card)))', border: '2px solid color-mix(in oklab, #06b6d4 50%, transparent)' }}>
              <div className="text-4xl">🚀</div>
              <div className="flex-1 min-w-0"><div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>Launch Card</div><div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>QR code + magic link · Students scan → instant game launch</div></div>
              <button onClick={() => { setShowLaunchCard(true); audioBus.init(); audioBus.play('tap'); }} className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', border: 'none', boxShadow: '0 4px 12px -2px rgba(6,182,212,0.6)' }}>🚀 Create Card</button>
            </div>

            {/* Daily Challenge */}
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--brand-accent) 30%, var(--brand-card)), var(--brand-card))', border: '2px solid color-mix(in oklab, var(--brand-accent) 50%, transparent)' }}>
              <div className="text-4xl">🎯</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>Daily Challenge!</div>
                <div className="text-xs opacity-80" style={{ color: 'var(--brand-text)' }}>Play today's featured game for DOUBLE XP + bonus badges</div>
              </div>
              <button onClick={() => {
                const today = new Date();
                const gameIds: GameModeId[] = ['maze-chase','quiz','balloon-pop','gameshow','spin-wheel','memory-match','airplane','whack-a-mole','flash-cards','anagram','group-sort','bridge-builder','wordsearch','crossword','type-answer','match-up','spot-it','endless-runner','physics-puzzler','snaking','training-academy','rescue-quest','label-it','speak-it'];
                launchGame(gameIds[today.getDate() % gameIds.length], theme);
              }} className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)', border: 'none', boxShadow: '0 4px 12px -2px var(--brand-accent)' }}>
                ▶ Play Now!
              </button>
            </div>

            {/* Unit info */}
            <div className="rounded-2xl mb-6 p-4 flex items-center gap-4 flex-wrap" style={{ background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 25%, transparent)' }}>
              <div className="text-3xl">📚</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--brand-text)' }}>Unit 1 · Fruits</div>
                <div className="text-xs opacity-70" style={{ color: 'var(--brand-text)' }}>{verifiedTerms.length} verified terms ready to play</div>
              </div>
              <button onClick={() => setView('teacher')} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
                Teacher Dashboard →
              </button>
            </div>

            <GameLibrary onPick={(m, t) => launchGame(m, t)} selectedTheme={theme} onSelectTheme={setTheme} termCount={verifiedTerms.length} />
          </div>
        )}
      </main>

      <footer className="mt-auto border-t pt-6 pb-8 px-4 sm:px-6" style={{ borderColor: 'color-mix(in oklab, var(--brand-accent) 15%, transparent)' }}>
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-60" style={{ color: 'var(--brand-text)' }}>
          <div>© 2029 {brand.displayName} · MiniStar Learning Games</div>
          <div className="flex items-center gap-4">
            <span>24 Games</span><span>·</span><span>10 Worlds</span><span>·</span><span>Audio Enabled</span>
          </div>
        </div>
      </footer>

      {/* Onboarding Flow (first visit only) */}
      {showOnboarding && <OnboardingFlow onComplete={() => { setShowOnboarding(false); try { localStorage.setItem('ministar_onboarded', '1'); } catch {} }} />}

      {/* Parent Gate */}
      <ParentGate open={showParentGate} onSuccess={() => { setShowParentGate(false); setView('teacher'); }} onCancel={() => setShowParentGate(false)} />

      {/* Launch Card */}
      <LaunchCard open={showLaunchCard} onClose={() => setShowLaunchCard(false)} onLaunch={(m, t) => launchGame(m, t)} />

      {/* AI Studio */}
      {showAIStudio && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowAIStudio(false)}>
          <div className="max-w-2xl w-full rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#1a1535', border: '1px solid rgba(168,85,247,0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div className="font-bold text-lg" style={{ color: '#fff' }}>🤖 AI Authoring Studio</div><button onClick={() => setShowAIStudio(false)} className="rounded-lg p-2 text-sm opacity-70" style={{ color: '#fff', background: 'rgba(255,255,255,0.1)' }}>✕</button></div>
            <AIAuthStudio onPublish={(newTerms) => { setTerms(prev => [...prev, ...newTerms]); setShowAIStudio(false); setView('student'); }} onCancel={() => setShowAIStudio(false)} />
          </div>
        </div>
      )}

      {/* Live Multiplayer */}
      {showLiveMP && (
        <LiveMultiplayer mode="quiz" theme={theme} terms={verifiedTerms.length > 0 ? verifiedTerms : terms} unit="unit-1" tenantId={brand.id} onExit={() => setShowLiveMP(false)} />
      )}

      {/* Star Garden (full-screen takeover) */}
      {showStarGarden && <StarGarden onClose={() => { setShowStarGarden(false); setStarDust(loadStarDust().available); }} />}
    </div>
    </ErrorBoundary>
  );
}
