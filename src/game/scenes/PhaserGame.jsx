import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MemoryMatchScene from './scenes/MemoryMatchScene';

export default function PhaserGame() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current && !gameRef.current.children.length) {
      const config = {
        type: Phaser.AUTO,
        parent: gameRef.current,
        width: 800,
        height: 600,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        },
        scene: [MemoryMatchScene]
      };
      const game = new Phaser.Game(config);
      return () => {
        game.destroy(true);
      };
    }
  }, []);

  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}