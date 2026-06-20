import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MemoryMatchScene from './MemoryMatchScene';
import MazeChaseScene from './MazeChaseScene';

export default function PhaserGame({ gameData, theme, gameMode }) {
  const gameRef = useRef(null);
  const gameInstance = useRef(null);

  useEffect(() => {
    if (gameRef.current && !gameInstance.current) {
      const config = {
        type: Phaser.AUTO,
        parent: gameRef.current,
        width: 800,
        height: 600,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [MemoryMatchScene, MazeChaseScene]
      };
      gameInstance.current = new Phaser.Game(config);
    }
    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true);
        gameInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gameInstance.current) {
      if (theme) gameInstance.current.registry.set('theme', theme);
      if (gameData) gameInstance.current.registry.set('gameData', gameData);
      
      // Directly start the target scene. Phaser automatically stops the current one.
      const targetScene = gameMode === 'MazeChase' ? 'MazeChaseScene' : 'MemoryMatchScene';
      gameInstance.current.scene.start(targetScene);
    }
  }, [gameData, theme, gameMode]);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}