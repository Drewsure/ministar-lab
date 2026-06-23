'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Phaser from 'phaser';
import type { GameLaunchConfig } from '@/lib/types';
import { THEMES } from '@/lib/themes';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { audioBus } from '@/lib/audio';
import LoadingScreen from './LoadingScreen';

// Dynamic import so Phaser only loads on the client.
// All 17 game scenes are registered here; the active scene is selected
// by the `mode` field in the launch config.

const SCENE_IMPORTS: Record<string, () => Promise<{ default: any }>> = {
  'maze-chase':      () => import('@/game/scenes/MazeChaseScene'),
  'quiz':            () => import('@/game/scenes/QuizScene'),
  'airplane':        () => import('@/game/scenes/AirplaneScene'),
  'gameshow':        () => import('@/game/scenes/GameshowScene'),
  'memory-match':    () => import('@/game/scenes/MemoryMatchScene'),
  'match-up':        () => import('@/game/scenes/MatchUpScene'),
  'balloon-pop':     () => import('@/game/scenes/BalloonPopScene'),
  'whack-a-mole':    () => import('@/game/scenes/WhackAMoleScene'),
  'anagram':         () => import('@/game/scenes/AnagramScene'),
  'wordsearch':      () => import('@/game/scenes/WordsearchScene'),
  'bridge-builder':  () => import('@/game/scenes/BridgeBuilderScene'),
  'crossword':       () => import('@/game/scenes/CrosswordScene'),
  'flash-cards':     () => import('@/game/scenes/FlashCardsScene'),
  'spin-wheel':      () => import('@/game/scenes/SpinWheelScene'),
  'group-sort':      () => import('@/game/scenes/GroupSortScene'),
  'type-answer':     () => import('@/game/scenes/TypeAnswerScene'),
  'spot-it':         () => import('@/game/scenes/SpotItScene'),
};

const SCENE_KEY_BY_MODE: Record<string, string> = {
  'maze-chase':      'MazeChaseScene',
  'quiz':            'QuizScene',
  'airplane':        'AirplaneScene',
  'gameshow':        'GameshowScene',
  'memory-match':    'MemoryMatchScene',
  'match-up':        'MatchUpScene',
  'balloon-pop':     'BalloonPopScene',
  'whack-a-mole':    'WhackAMoleScene',
  'anagram':         'AnagramScene',
  'wordsearch':      'WordsearchScene',
  'bridge-builder':  'BridgeBuilderScene',
  'crossword':       'CrosswordScene',
  'flash-cards':     'FlashCardsScene',
  'spin-wheel':      'SpinWheelScene',
  'group-sort':      'GroupSortScene',
  'type-answer':     'TypeAnswerScene',
  'spot-it':         'SpotItScene',
};

interface GameCanvasProps {
  config: GameLaunchConfig | null;
  onExit?: () => void;
}

export default function GameCanvas({ config, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in transition once loading completes
  const handleLoadingComplete = () => {
    setLoading(false);
    // Small delay then trigger the fade-in
    requestAnimationFrame(() => setFadeIn(true));
  };

  useEffect(() => {
    if (!config || !containerRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      // Phaser 3.80 ESM has no default export — import the namespace and use it directly.
      const Phaser: any = await import('phaser');
      if (cancelled) return;

      const mode = config.mode;
      const sceneKey = SCENE_KEY_BY_MODE[mode];
      const sceneLoader = SCENE_IMPORTS[mode];

      // Resolve theme manifest from ThemeId
      const theme = THEMES[config.theme];

      // Load the scene module (only the active one — keeps bundle light)
      const SceneClass = (await sceneLoader()).default;

      const container = containerRef.current!;
      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');

      // Resolve the launch config BEFORE creating the Phaser.Game.
      // The scene's init() reads from the registry, so it must be populated
      // before boot completes.
      const resolvedConfig = { ...config, theme } as any;

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        // Use AUTO (WebGL with Canvas fallback) — most performant on real browsers.
        // The black-screen bug was caused by a ReferenceError in Juice.ts (Hud.tick),
        // not by the renderer type.
        type: Phaser.AUTO,
        parent: container,
        width: 800,
        height: 600,
        backgroundColor: bgColor,
        physics: {
          default: 'arcade',
          arcade: { debug: false, gravity: { x: 0, y: 0 } },
        },
        // IMPORTANT: leave scene array empty. We register the scene explicitly
        // after the game boots so we can control the scene key. Passing the
        // class directly here causes Phaser to register it under whatever key
        // it can derive from the class (often mangled by Turbopack), which
        // breaks later `game.scene.start('QuizScene', ...)` calls.
        scene: [],
        fps: { target: 60, forceSetTimeOut: false },
        render: {
          antialias: true,
        },
        input: {
          activePointers: 3,
          keyboard: true,
          touch: true,
          mouse: true,
        },
      };

      let game: Phaser.Game;
      try {
        game = new Phaser.Game(sceneConfig);
      } catch (e: any) {
        console.error('[MiniStar] Failed to create Phaser.Game:', e);
        return;
      }
      if (cancelled) {
        try { game.destroy(true); } catch {}
        return;
      }
      gameRef.current = game;
      if (typeof window !== 'undefined') {
        (window as any).__PHASER_GAME = game;
      }

      // Populate the registry before the scene boots so init() can read it.
      game.registry.set('launchConfig', resolvedConfig);

      // Once the game is ready, register the scene under the explicit string
      // key (autoStart=false), then start it with the launch config data.
      game.events.once('ready', () => {
        try {
          // Make the canvas focusable + responsive right after boot.
          const canvas = container.querySelector('canvas');
          if (canvas) {
            canvas.setAttribute('tabindex', '0');
            canvas.style.outline = 'none';
            canvas.style.touchAction = 'none';
            canvas.style.pointerEvents = 'auto';
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '70vh';
            canvas.style.width = 'auto';
            canvas.style.height = 'auto';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
          }

          if (!game.scene.getScene(sceneKey)) {
            game.scene.add(sceneKey, SceneClass, false);
          }
          game.scene.start(sceneKey, { config: resolvedConfig });
        } catch (e: any) {
          console.error('[MiniStar] Failed to start scene:', sceneKey, e);
        }
      });

      // Surface any boot-time errors so they aren't swallowed silently.
      game.events.on('error', (err: any) => {
        console.error('[MiniStar] Phaser game error:', err);
      });
    })();

    return () => {
      cancelled = true;
      // Cancel any in-progress TTS + stop music when game exits
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        audioBus.stopMusic();
      } catch {}
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch {}
        gameRef.current = null;
      }
    };
  }, [config?.mode, config?.theme, config?.terms.length, config?.unit, config?.qrSlug]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (!config) return null;
  const theme = THEMES[config.theme];
  const gameMeta = GAME_MODE_MAP[config.mode];

  return (
    <div
      className="relative w-full h-full transition-opacity duration-500"
      style={{
        touchAction: 'none',
        opacity: fadeIn ? 1 : 0,
        minHeight: '500px',
        // Safe-area insets for notched phones
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-50">
          <LoadingScreen
            gameName={gameMeta.name}
            gameEmoji={gameMeta.emoji}
            themeName={theme.name}
            themeEmoji={theme.emoji ?? '🌟'}
            onReady={handleLoadingComplete}
          />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ touchAction: 'none', pointerEvents: 'auto', minHeight: '500px' }}
      />
    </div>
  );
}
