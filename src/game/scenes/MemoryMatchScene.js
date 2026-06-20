import Phaser from 'phaser';

const AudioManager = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  play(freq, type = 'sine', duration = 0.2) {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
};

export default class MemoryMatchScene extends Phaser.Scene {
  constructor() { super('MemoryMatchScene'); }

  create() {
    // 1. Fetch the active theme from the Phaser Registry
    const theme = this.registry.get('theme') || { bg: '#1e1b4b', card: '#6366f1', accent: '#ffffff' };

    // Phaser 3.60+ accepts CSS hex strings directly! No conversion needed.
    this.cameras.main.setBackgroundColor(theme.bg);
    this.add.text(400, 50, 'MiniStar Memory Match', { fill: theme.accent, fontSize: '32px', fontFamily: 'sans-serif' }).setOrigin(0.5);

    this.canInteract = true;
    this.flippedCards = [];
    this.matches = 0;
    this.streak = 0;

    this.mascot = this.add.text(750, 80, '🐶', { fontSize: '40px' }).setOrigin(0.5);

    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('particle', 4, 4);

    this.cardData = [
      { id: 1, emoji: '🍎', color: 0xef4444 },
      { id: 2, emoji: '🍌', color: 0xeab308 },
      { id: 3, emoji: '🍒', color: 0xdc2626 },
      { id: 4, emoji: '🍇', color: 0x7c3aed }
    ];

    this.cards = Phaser.Utils.Array.Shuffle([...this.cardData, ...this.cardData]);
    this.buildGrid(theme.card, theme.accent);
  }

  buildGrid(cardColor, accentColor) {
    const cols = 4;
    const cellSize = 100;
    const offsetX = (this.scale.width - cols * cellSize) / 2 + cellSize / 2;
    const offsetY = 150;

    this.cards.forEach((card, i) => {
      const x = offsetX + (i % cols) * cellSize;
      const y = offsetY + Math.floor(i / cols) * cellSize;

      // Apply theme colors directly
      const cardBack = this.add.rectangle(0, 0, 80, 80, cardColor).setStrokeStyle(2, accentColor, 0.3);
      const cardFront = this.add.text(0, 0, card.emoji, { fontSize: '40px' }).setOrigin(0.5).setVisible(false);

      const container = this.add.container(x, y, [cardBack, cardFront]).setSize(80, 80).setInteractive();
      container.setData('cardData', card);
      container.setData('isFlipped', false);

      container.on('pointerdown', () => this.handleCardClick(container, cardBack, cardFront));
    });
  }

  handleCardClick(container, cardBack, cardFront) {
    if (!this.canInteract || container.getData('isFlipped') || this.flippedCards.length >= 2) return;
    AudioManager.play(400, 'square', 0.1);

    this.tweens.add({
      targets: container, scaleX: 0, duration: 150,
      onComplete: () => {
        cardBack.setVisible(false);
        cardFront.setVisible(true);
        container.setScale(1, 1);
        container.setData('isFlipped', true);
      }
    });

    this.flippedCards.push(container);
    if (this.flippedCards.length === 2) {
      this.canInteract = false;
      this.time.delayedCall(600, this.checkMatch, [], this);
    }
  }

  checkMatch() {
    const [card1, card2] = this.flippedCards;
    const data1 = card1.getData('cardData');
    const data2 = card2.getData('cardData');

    if (data1.id === data2.id) {
      this.matches++; this.streak++;
      AudioManager.play(523.25, 'sine', 0.2); AudioManager.play(659.25, 'sine', 0.3);
      this.burstParticles(card1.x, card1.y, data1.color);
      this.burstParticles(card2.x, card2.y, data1.color);
      this.cameras.main.shake(200, 0.005);
      this.updateMascot();

      this.tweens.add({
        targets: [card1, card2], scale: 1.2, duration: 200, yoyo: true,
        onComplete: () => { card1.destroy(); card2.destroy(); this.resetTurn(); }
      });

      if (this.matches === this.cardData.length) this.time.delayedCall(500, this.showWinScreen, [], this);
    } else {
      this.streak = 0;
      AudioManager.play(150, 'sawtooth', 0.2);
      this.updateMascot();

      this.tweens.add({
        targets: [card1, card2], x: '+=10', duration: 50, yoyo: true, repeat: 3,
        onComplete: () => {
          card1.list[0].setVisible(true); card1.list[1].setVisible(false); card1.setData('isFlipped', false);
          card2.list[0].setVisible(true); card2.list[1].setVisible(false); card2.setData('isFlipped', false);
          this.resetTurn();
        }
      });
    }
  }

  burstParticles(x, y, color) {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 }, blendMode: 'ADD', lifespan: 800,
      tint: color, quantity: 20, emitting: false
    });
    emitter.explode(20);
  }

  updateMascot() {
    if (this.streak >= 2) {
      this.mascot.setText('⭐');
      this.tweens.add({ targets: this.mascot, y: 60, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
      this.mascot.setText('🐶');
      this.tweens.killTweensOf(this.mascot);
      this.mascot.setY(80);
    }
  }

  resetTurn() { this.flippedCards = []; this.canInteract = true; }

  showWinScreen() {
    this.add.text(400, 300, 'PERFECT SCORE!', { fill: '#10b981', fontSize: '64px', fontFamily: 'sans-serif' }).setOrigin(0.5);
    this.add.text(400, 350, 'Click to play again', { fill: '#fff', fontSize: '24px', fontFamily: 'sans-serif' }).setOrigin(0.5);
    this.input.on('pointerdown', () => this.scene.restart());
  }
}