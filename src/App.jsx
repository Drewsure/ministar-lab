import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

function App() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current && !gameRef.current.children.length) {
      const config = {
        type: Phaser.AUTO,
        parent: gameRef.current,
        width: 800,
        height: 500,
        physics: {
          default: 'arcade',
          arcade: { debug: false }
        },
        scene: {
          preload: preload,
          create: create,
          update: update
        }
      };
      new Phaser.Game(config);
    }
  }, []);

  let player, cursors, targets, streak = 0;
  let mascotText;

  function preload() {
    const g = this.make.graphics();
    g.fillStyle(0x6366f1, 1); g.fillCircle(20, 20, 20); g.generateTexture('player', 40, 40); g.clear();
    g.fillStyle(0xffffff, 0.1); g.lineStyle(2, 0x6366f1, 1); g.fillCircle(35, 35, 35); g.strokeCircle(35, 35, 35); g.generateTexture('orb', 70, 70); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('particle', 4, 4);
  }

  function create() {
    this.cameras.main.setBackgroundColor('#1e1b4b');
    this.add.text(400, 50, 'Fly into the correct answer!', { fill: '#fff', fontSize: '24px' }).setOrigin(0.5);
    mascotText = this.add.text(750, 80, '🐶', { fontSize: '40px' }).setOrigin(0.5);

    player = this.physics.add.sprite(100, 250, 'player');
    player.setCollideWorldBounds(true);
    player.setCircle(20);

    cursors = this.input.keyboard.createCursorKeys();
    this.input.on('pointerdown', (p) => this.physics.moveTo(player, p.x, p.y, 300));
    this.input.on('pointerup', () => player.setVelocity(0, 0));

    targets = this.physics.add.staticGroup();
    spawnTarget.call(this, 600, 150, 'Sun', true);
    spawnTarget.call(this, 650, 350, 'Moon', false);
    spawnTarget.call(this, 400, 400, 'Mars', false);

    this.physics.add.overlap(player, targets, handleCollision, null, this);
  }

  function spawnTarget(x, y, text, isCorrect) {
    let t = targets.create(x, y, 'orb');
    t.setCircle(35);
    t.setData('isCorrect', isCorrect);
    t.setData('text', text);
    t.setData('hit', false);
    this.add.text(x, y, text, { fill: '#fff', fontSize: '18px' }).setOrigin(0.5);
  }

  function handleCollision(player, target) {
    if (target.getData('hit')) return;
    target.setData('hit', true);
    target.destroy();

    let isCorrect = target.getData('isCorrect');
    let color = isCorrect ? 0x10b981 : 0xef4444;

    let emitter = this.add.particles(target.x, target.y, 'particle', {
      speed: 300, lifespan: 800, tint: color, quantity: 30, emitting: false
    });
    emitter.explode(30);
    this.cameras.main.shake(200, isCorrect ? 0.01 : 0.005);

    streak = isCorrect ? streak + 1 : 0;
    mascotText.setText(streak >= 2 ? '⭐' : '🐶');

    this.time.delayedCall(1000, () => this.scene.restart());
  }

  function update() {
    if (cursors.left.isDown) player.setVelocityX(-300);
    else if (cursors.right.isDown) player.setVelocityX(300);
    else if (!this.input.activePointer.isDown) player.setVelocityX(0);

    if (cursors.up.isDown) player.setVelocityY(-300);
    else if (cursors.down.isDown) player.setVelocityY(300);
    else if (!this.input.activePointer.isDown) player.setVelocityY(0);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e1b4b', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#6366f1' }}>MiniStar Global Lab</h1>
      <div ref={gameRef} style={{ marginTop: '20px', border: '1px solid #333', borderRadius: '16px' }} />
      <p>Use Arrow Keys or Click/Tap to move.</p>
    </div>
  );
}

export default App;