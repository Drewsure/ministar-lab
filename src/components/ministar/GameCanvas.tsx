'use client';

import { useEffect, useRef } from 'react';
import type * as Phaser from 'phaser';
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
  'label-it':        () => import('@/game/scenes/LabelItScene'),
  'speak-it':        () => import('@/game/scenes/SpeakItScene'),
  'endless-runner':  () => import('@/game/scenes/EndlessRunnerScene'),
  'physics-puzzler': () => import('@/game/scenes/PhysicsPuzzlerScene'),
  'snaking':         () => import('@/game/scenes/SnakingScene'),
  'training-academy':() => import('@/game/scenes/TrainingAcademyScene'),
  'rescue-quest':    () => import('@/game/scenes/RescueQuestScene'),
  'star-farm':       () => import('@/game/scenes/StarFarmScene'),
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
  'label-it':        'LabelItScene',
  'speak-it':        'SpeakItScene',
  'endless-runner':  'EndlessRunnerScene',
  'physics-puzzler': 'PhysicsPuzzlerScene',
  'snaking':         'SnakingScene',
  'training-academy':'TrainingAcademyScene',
  'rescue-quest':    'RescueQuestScene',
  'star-farm':       'StarFarmScene',
};

interface GameCanvasProps {
  config: GameLaunchConfig | null;
  onExit?: () => void;
}

export default function GameCanvas({ config, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const loadedScenesRef = useRef<Set<string>>(new Set());

  // Listen for "New Game" button presses from inside the Phaser game.
  // The BaseEngine's finishGame() screen has a "New Game" button that
  // dispatches this event. Without it, React never knows the user wants
  // to exit, and the canvas goes blank (stuck state).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleExit = () => {
      onExit?.();
    };
    window.addEventListener('ministar-exit-game', handleExit);
    return () => {
      window.removeEventListener('ministar-exit-game', handleExit);
    };
  }, [onExit]);

  useEffect(() => {
    if (!config || !containerRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      // Phaser 3/4 ESM has no default export — import the namespace and use it directly
      const Phaser: any = await import('phaser');
      if (cancelled) return;

      const mode = config.mode;
      const sceneKey = SCENE_KEY_BY_MODE[mode];
      const sceneLoader = SCENE_IMPORTS[mode];

      // Resolve theme manifest from ThemeId
      const theme = THEMES[config.theme];

      // Load the scene module (only the active one — keeps bundle light)
      const SceneClass = (await sceneLoader()).default;

      // Responsive sizing — FIT mode scales the 800×600 game uniformly to
      // fit inside the container, maintaining 4:3 aspect ratio. No squishing,
      // no zooming. (RESIZE was wrong — it made the canvas match container
      // pixels exactly, causing squished UI on mobile + zoomed UI on PC.)
      const container = containerRef.current!;

      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');

      const gameWidth = 800;
      const gameHeight = 600;

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: gameWidth,
        height: gameHeight,
        backgroundColor: bgColor,
        scale: {
          // FIT = scale uniformly to fit container, maintain aspect ratio.
          // This is the correct mode for responsive game embedding.
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: gameWidth,
          height: gameHeight,
        },
        physics: {
          default: 'arcade',
          arcade: { debug: false, gravity: { x: 0, y: 0 } },
        },
        // AAAA — Don't auto-start the scene. Register it empty, add with
        // explicit key, then start AFTER setting the registry.
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

      // Canvas styling is now handled in the 'ready' event below

      let game: Phaser.Game;
      try {
        game = new Phaser.Game(sceneConfig);
      } catch (e: any) {
        return;
      }
      gameRef.current = game;
      if (typeof window !== 'undefined') {
        (window as any).__PHASER_GAME = game;
      }

      // Pass launch config via registry — scenes read it in init()
      const resolvedConfig = { ...config, theme } as any;
      game.registry.set('launchConfig', resolvedConfig);

      // AAAA — After game boots, add the scene under the correct key and start it
      game.events.once('ready', () => {
        try {
          if (cancelled || !gameRef.current || gameRef.current !== game) return;

          // CRITICAL: Do NOT set any width/height/maxWidth/maxHeight inline
          // styles on the canvas. Phaser's Scale.FIT mode controls the canvas
          // size completely. Any inline style overrides Phaser's scaling →
          // canvas overflows on mobile (zoomed in) or squishes on PC.
          // Only set accessibility + touch styles.
          const canvas = container.querySelector('canvas');
          if (canvas) {
            canvas.setAttribute('tabindex', '0');
            canvas.style.outline = 'none';
            canvas.style.touchAction = 'none';
            canvas.style.pointerEvents = 'auto';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            // Do NOT set width/height — Phaser FIT handles it
          }

          if (!game.scene.getScene(sceneKey)) {
            game.scene.add(sceneKey, SceneClass, false);
          }
          game.scene.start(sceneKey, { config: resolvedConfig });
        } catch (e: any) {
          console.error('[MiniStar] Failed to start scene:', sceneKey, e);
        }
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
    <div style={{ touchAction: 'none', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div
        ref={containerRef}
        style={{ touchAction: 'none', pointerEvents: 'auto', width: '100%', height: '100%' }}
      />
    </div>
  );
}
