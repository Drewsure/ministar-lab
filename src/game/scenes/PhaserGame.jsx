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
        scene: [MemoryMatchScene, MazeChaseScene] // Load both engines
      };
      gameInstance.current = new Phaser.Game(config);
      // Start the default scene
      gameInstance.current.scene.start('MemoryMatchScene');
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
      
      // Stop all active scenes, then start the requested one
      gameInstance.current.scene.stop('MemoryMatchScene');
      gameInstance.current.scene.stop('MazeChaseScene');
      gameInstance.current.scene.start(gameMode === 'MazeChase' ? 'MazeChaseScene' : 'MemoryMatchScene');
    }
  }, [gameData, theme, gameMode]);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}