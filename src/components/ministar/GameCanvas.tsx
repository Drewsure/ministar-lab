'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { GameLaunchConfig } from '@/lib/types';
import { THEMES } from '@/lib/themes';

// Dynamic import so Phaser only loads on the client.
// All 11 game scenes are registered here; the active scene is selected
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
  const loadedScenesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!config || !containerRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      const Phaser = (await import('phaser')).default;
      if (cancelled) return;

      const mode = config.mode;
      const sceneKey = SCENE_KEY_BY_MODE[mode];
      const sceneLoader = SCENE_IMPORTS[mode];

      // Resolve theme manifest from ThemeId
      const theme = THEMES[config.theme];

      // Load the scene module (only the active one — keeps bundle light)
      const SceneClass = (await sceneLoader()).default;

      // Responsive sizing — use FIT mode so the 800x600 game scales to fit
      // any screen (mobile portrait, mobile landscape, desktop) without overflow
      const container = containerRef.current!;

      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: 800,
        height: 600,
        backgroundColor: bgColor,
        physics: {
          default: 'arcade',
          arcade: { debug: false, gravity: { x: 0, y: 0 } },
        },
        scene: [],
        fps: { target: 60, forceSetTimeOut: false },
        render: {
          antialias: true,
        },
        input: {
          activePointers: 3,
          keyboard: true,  // Explicitly enable keyboard
          touch: true,     // Explicitly enable touch
          mouse: true,     // Explicitly enable mouse
        },
      };

      // Make canvas focusable for keyboard input + ensure it receives pointer events
      setTimeout(() => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          canvas.setAttribute('tabindex', '0');
          canvas.style.outline = 'none';
          canvas.style.touchAction = 'none';
          canvas.style.pointerEvents = 'auto';
          // Constrain canvas to fit viewport — critical for mobile and desktop
          canvas.style.maxWidth = '100%';
          canvas.style.maxHeight = '70vh';
          canvas.style.width = 'auto';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto';
        }
      }, 200);

      let game: Phaser.Game;
      try {
        game = new Phaser.Game(sceneConfig);
      } catch (e: any) {
        return;
      }
      gameRef.current = game;
      // Debug: expose game instance
      if (typeof window !== 'undefined') {
        (window as any).__PHASER_GAME = game;
      }

      // Pass launch config via registry — scenes read it in init()
      const resolvedConfig = { ...config, theme } as any;
      game.registry.set('launchConfig', resolvedConfig);

      // Register the active scene class WITHOUT auto-start (autoStart=false),
      // then explicitly start it with the launch config data once the game boots.
      game.events.once('ready', () => {
        game.scene.add(sceneKey, SceneClass, false);
        game.scene.start(sceneKey, { config: resolvedConfig });
      });

      loadedScenesRef.current.add(mode);
    })();

    return () => {
      cancelled = true;
      // Cancel any in-progress TTS when game exits
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {}
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch {}
        gameRef.current = null;
      }
    };
  }, [config?.mode, config?.theme, config?.terms.length, config?.unit, config?.qrSlug]);

  return (
    <div className="relative w-full h-full" style={{ touchAction: 'none' }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ touchAction: 'none', pointerEvents: 'auto' }}
      />
      {/* Exit button removed — the parent page provides a clear "← Back to Library" button.
          Having two exit buttons was confusing users. */}
    </div>
  );
}
