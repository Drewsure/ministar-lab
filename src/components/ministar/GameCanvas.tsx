'use client';

import { useEffect, useRef } from 'react';
import type { GameLaunchConfig } from '@/lib/types';
import { THEMES } from '@/lib/themes';

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
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (!config || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const Phaser: any = window.Phaser;
      if (!Phaser || cancelled) return;

      // Patch: Phaser CDN build puts renderer classes under Phaser.Renderer.Canvas.CanvasRenderer
      // but the game boot sequence expects them at Phaser.CanvasRenderer
      if (Phaser.Renderer && Phaser.Renderer.Canvas && Phaser.Renderer.Canvas.CanvasRenderer) {
        Phaser.CanvasRenderer = Phaser.Renderer.Canvas.CanvasRenderer;
      }
      if (Phaser.Renderer && Phaser.Renderer.WebGL && Phaser.Renderer.WebGL.WebGLRenderer) {
        Phaser.WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer;
      }

      const mode = config.mode;
      const sceneKey = SCENE_KEY_BY_MODE[mode];
      const sceneLoader = SCENE_IMPORTS[mode];
      const theme = THEMES[config.theme];
      const SceneClass = (await sceneLoader()).default;
      const container = containerRef.current!;
      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');

      const sceneConfig = {
        type: Phaser.CANVAS,
        parent: container,
        width: 800,
        height: 600,
        backgroundColor: bgColor,
        physics: { default: 'arcade', arcade: { debug: false, gravity: { x: 0, y: 0 } } },
        scene: [],
        fps: { target: 60, forceSetTimeOut: false },
        render: { antialias: true },
        input: { activePointers: 3, keyboard: true, touch: true, mouse: true },
      };

      setTimeout(() => {
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
      }, 200);

      let game: any;
      try {
        game = new Phaser.Game(sceneConfig);
      } catch (e: any) {
        return;
      }
      gameRef.current = game;
      if (typeof window !== 'undefined') (window as any).__PHASER_GAME = game;

      const resolvedConfig = { ...config, theme } as any;
      game.registry.set('launchConfig', resolvedConfig);

      game.events.once('ready', () => {
        game.scene.add(sceneKey, SceneClass, false);
        game.scene.start(sceneKey, { config: resolvedConfig });
      });
    })();

    return () => {
      cancelled = true;
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
      <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'none', pointerEvents: 'auto' }} />
    </div>
  );
}