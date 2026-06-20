import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

function App() {
  const gameRef = useRef(null);
  const [theme, setTheme] = useState({
    name: 'Default School',
    primary: '#6366f1',
    secondary: '#1e1b4b',
    radius: '16px'
  });

  useEffect(() => {
    // Inject CSS Variables at the :root level (Simulating ThemeConfig)
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', theme.primary);
    root.style.setProperty('--brand-secondary', theme.secondary);
    root.style.setProperty('--ui-radius', theme.radius);

    if (gameRef.current && !gameRef.current.children.length) {
      const config = {
        type: Phaser.AUTO,
        parent: gameRef.current,
        width: 800,
        height: 500,
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: { preload: preload, create: create, update: update }
      };
      new Phaser.Game(config);
    }
  }, [theme]);

  let player, cursors, targets, streak = 0;
  let mascotText;

  function preload() {
    const g = this.make.graphics();
    // Dynamically color the player based on the current theme
    const hexColor = Phaser.Display.Color.HexToColor(theme.primary.replace('#', '0x'));
    g.fillStyle(hexColor.color, 1); g.fillCircle(20, 20, 20); g.generateTexture('player', 40, 40); g.clear();
    g.fillStyle(0xffffff, 0.1); g.lineStyle(2, hexColor.color, 1); g.fillCircle(35, 35, 35); g.strokeCircle(35, 35, 35); g.generateTexture('orb', 70, 70); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('particle', 4, 4);
  }

  function create() {
    this.cameras.main.setBackgroundColor(theme.secondary);
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

  // Function to simulate fetching a new B2B tenant's brand manifest
  const switchTenant = (newTheme) => {
    setTheme(newTheme);
    // Force Phaser to restart and apply new colors
    if (gameRef.current && gameRef.current.children[0]) {
      gameRef.current.children[0].destroy(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'var(--brand-secondary)', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', transition: 'background-color 0.3s' }}>
      
      {/* B2B Header & Brand Switcher */}
      <header style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)' }}>
        <h1 style={{ color: 'var(--brand-primary)', margin: 0 }}>{theme.name}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => switchTenant({ name: 'Default School', primary: '#6366f1', secondary: '#1e1b4b', radius: '16px' })} style={btnStyle}>Default</button>
          <button onClick={() => switchTenant({ name: 'Space Academy', primary: '#22d3ee', secondary: '#042f2e', radius: '4px' })} style={btnStyle}>Space</button>
          <button onClick={() => switchTenant({ name: 'Festival Prep', primary: '#f59e0b', secondary: '#7c2d12', radius: '32px' })} style={btnStyle}>Festival</button>
        </div>
      </header>

      <div ref={gameRef} style={{ marginTop: '20px', border: '2px solid var(--brand-primary)', borderRadius: 'var(--ui-radius)', transition: 'border 0.3s, border-radius 0.3s' }} />
      <p style={{ marginTop: '15px', opacity: 0.7 }}>Use Arrow Keys or Click/Tap to move.</p>
    </div>
  );
}

const btnStyle = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px'
};

export default App;