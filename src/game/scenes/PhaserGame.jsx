import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MazeChaseScene from './MazeChaseScene';

export default function PhaserGame() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current && !gameRef.current.children.length) {
      const config = {
        type: Phaser.AUTO,
        parent: gameRef.current,
        width: 800,
        height: 600,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [MazeChaseScene] // Using the new Maze Chase Engine!
      };
      const game = new Phaser.Game(config);
      window.phaserGame = game; 
      
      return () => { game.destroy(true); window.phaserGame = null; };
    }
  }, []);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}