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
      
      const targetScene = gameMode === 'MazeChase' ? 'MazeChaseScene' : 'MemoryMatchScene';
      const activeScene = gameInstance.current.scene.getAt(0); // Get currently active scene
      
      if (activeScene && activeScene.sys.settings.key !== targetScene) {
        // Use switch to properly sleep the old scene and wake the new one
        gameInstance.current.scene.switch(activeScene.sys.settings.key, targetScene);
      } else if (activeScene) {
        // If it's the same scene, just restart it to apply new data
        activeScene.scene.restart();
      } else {
        gameInstance.current.scene.start(targetScene);
      }
    }
  }, [gameData, theme, gameMode]);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}