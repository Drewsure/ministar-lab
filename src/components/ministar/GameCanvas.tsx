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
    if (!config || !containerRef.current) return;

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

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: 800,
        height: 600,
        backgroundColor: '#' + theme.bg.toString(16).padStart(6, '0'),
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'arcade',
          arcade: { debug: false, gravity: { x: 0, y: 0 } },
        },
        // IMPORTANT: pass an EMPTY scene array. We register the active scene
        // manually after the game boots so we can control its init data.
        scene: [],
        fps: { target: 60, forceSetTimeOut: false },
        render: {
          antialias: true,
          powerPreference: 'high-performance',
        },
        input: {
          activePointers: 3,
        },
      };

      const game = new Phaser.Game(sceneConfig);
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
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch {}
        gameRef.current = null;
      }
    };
  }, [config?.mode, config?.theme, config?.terms.length, config?.unit, config?.qrSlug]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {onExit && (
        <button
          onClick={onExit}
          className="absolute top-2 right-2 z-10 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 backdrop-blur-md transition"
          aria-label="Exit game"
        >
          ✕ Exit
        </button>
      )}
    </div>
  );
}
