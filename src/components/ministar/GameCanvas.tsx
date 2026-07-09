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
    // ORIENTATION CHANGE: When phone rotates, Phaser needs to resize.
    // Listen for resize + orientationchange events and call game.scale.refresh().
    const handleResize = () => {
      if (gameRef.current) {
        try {
          // Delay slightly so the browser finishes rotating
          setTimeout(() => {
            if (gameRef.current) {
              gameRef.current.scale.refresh();
              gameRef.current.scale.resize(
                gameRef.current.scale.parent?.clientWidth || window.innerWidth,
                gameRef.current.scale.parent?.clientHeight || window.innerHeight
              );
            }
          }, 200);
        } catch {}
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('ministar-exit-game', handleExit);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
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

      // FULLSCREEN FIX: Phaser follows the PARENT CONTAINER's dimensions,
      // not window size. The parent must have explicit width/height.
      // Scale.RESIZE makes the canvas match the parent exactly.
      const container = containerRef.current!;

      // FORCE the container to fill its parent completely
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.display = 'block';
      container.style.overflow = 'hidden';

      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');

      // Get actual parent dimensions for the game
      const parentW = container.parentElement?.clientWidth || container.clientWidth || 800;
      const parentH = container.parentElement?.clientHeight || container.clientHeight || 600;

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: parentW,
        height: parentH,
        backgroundColor: bgColor,
        scale: {
          // RESIZE = canvas matches parent exactly, fills 100%
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: parentW,
          height: parentH,
          parent: container,
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

          // FULLSCREEN FIX: Force canvas to fill parent 100%.
          // Phaser RESIZE mode + these styles = canvas always fills container.
          const canvas = container.querySelector('canvas');
          if (canvas) {
            canvas.setAttribute('tabindex', '0');
            canvas.style.outline = 'none';
            canvas.style.touchAction = 'none';
            canvas.style.pointerEvents = 'auto';
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
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
    <div style={{ touchAction: 'none', width: '100%', height: '100%', display: 'block', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ touchAction: 'none', pointerEvents: 'auto', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
