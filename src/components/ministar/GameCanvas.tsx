'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Phaser from 'phaser';
import type { GameLaunchConfig } from '@/lib/types';
import { THEMES } from '@/lib/themes';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { audioBus } from '@/lib/audio';

// Dynamic import so Phaser only loads on the client.
// All 24 game scenes are registered here.

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
};

interface GameCanvasProps {
  config: GameLaunchConfig | null;
  onExit?: () => void;
}

export default function GameCanvas({ config, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!config || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const Phaser: any = await import('phaser');
      if (cancelled) return;

      const mode = config.mode;
      const sceneKey = SCENE_KEY_BY_MODE[mode];
      const sceneLoader = SCENE_IMPORTS[mode];
      const theme = THEMES[config.theme] ?? THEMES.space;
      const SceneClass = (await sceneLoader()).default;
      const container = containerRef.current!;
      const bgColor = '#' + (theme?.bg ?? 0x000000).toString(16).padStart(6, '0');
      const resolvedConfig = { ...config, theme } as any;

      const sceneConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
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

      let game: Phaser.Game;
      try { game = new Phaser.Game(sceneConfig); } catch { return; }
      if (cancelled) { try { game.destroy(true); } catch {} return; }
      gameRef.current = game;
      if (typeof window !== 'undefined') (window as any).__PHASER_GAME = game;
      game.registry.set('launchConfig', resolvedConfig);

      game.events.once('ready', () => {
        try {
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
          if (!game.scene.getScene(sceneKey)) game.scene.add(sceneKey, SceneClass, false);
          game.scene.start(sceneKey, { config: resolvedConfig });
        } catch (e: any) { console.error('[MiniStar] Failed to start scene:', sceneKey, e); }
      });
    })();

    return () => {
      cancelled = true;
      try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch {}
      try { audioBus.stopMusic(); } catch {}
      if (gameRef.current) { try { gameRef.current.destroy(true); } catch {} gameRef.current = null; }
    };
  }, [config?.mode, config?.theme, config?.terms.length, config?.unit, config?.qrSlug]);

  if (!config) return null;
  const theme = THEMES[config.theme] ?? THEMES.space;
  const gameMeta = GAME_MODE_MAP[config.mode] ?? { name: 'Game', emoji: '🎮' };

  return (
    <div className="relative w-full h-full" style={{ touchAction: 'none', minHeight: '500px' }}>
      <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'none', pointerEvents: 'auto', minHeight: '500px' }} />
    </div>
  );
}
