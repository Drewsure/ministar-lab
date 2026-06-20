import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MemoryMatchScene from './MemoryMatchScene';

export default function PhaserGame({ gameData, theme }) {
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
        scene: [MemoryMatchScene]
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
      
      if (gameInstance.current.scene.scenes[0]) {
        gameInstance.current.scene.scenes[0].scene.restart();
      }
    }
  }, [gameData, theme]);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}