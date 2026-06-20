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
    const theme = this.registry.get('theme') || { bg: '#1e1b4b', card: '#6366f1', accent: '#ffffff' };
    
    // Fetch AI-generated data from registry, fallback to default
    const gameData = this.registry.get('gameData') || [
      { id: 1, emoji: '🍎', color: 0xef4444 },
      { id: 2, emoji: '🍌', color: 0xeab308 },
      { id: 3, emoji: '🍒', color: 0xdc2626 },
      { id: 4, emoji: '🍇', color: 0x7c3aed }
    ];

    this.cameras.main.setBackgroundColor(theme.bg);
    this.add.text(400, 50, 'MiniStar Memory Match', { fill: theme.accent, fontSize: '32px', fontFamily: 'sans-serif' }).setOrigin(0.5);

    this.canInteract = true;
    this.flippedCards = [];
    this.matches = 0;
    this.streak = 0;
    this.startTime = Date.now(); // Start telemetry timer

    this.mascot = this.add.text(750, 80, '🐶', { fontSize: '40px' }).setOrigin(0.5);
    this.telemetryText = this.add.text(20, 580, 'xAPI Telemetry: Tracking...', { fill: '#888', fontSize: '14px', fontFamily: 'monospace' });

    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('particle', 4, 4);

    this.cardData = gameData.map(d => ({ id: d.id, emoji: d.emoji, color: d.color || 0xffffff }));
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
      this.cameras.main.shake(200, 0.