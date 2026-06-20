import Phaser from 'phaser';

export default class MemoryMatchScene extends Phaser.Scene {
  constructor() {
    super('MemoryMatchScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1e1b4b');
    this.add.text(400, 50, 'MiniStar Memory Match', { fill: '#fff', fontSize: '32px', fontFamily: 'sans-serif' }).setOrigin(0.5);

    // Engine State Machine
    this.canInteract = true;
    this.flippedCards = [];
    this.matches = 0;

    // Dataset (Simulating JSON from Neon DB)
    this.cardData = [
      { id: 1, emoji: '🍎' },
      { id: 2, emoji: '🍌' },
      { id: 3, emoji: '🍒' },
      { id: 4, emoji: '🍇' }
    ];

    // Shuffle and duplicate pairs
    this.cards = Phaser.Utils.Array.Shuffle([...this.cardData, ...this.cardData]);
    this.buildGrid();
  }

  buildGrid() {
    const cols = 4;
    const cellSize = 100;
    const offsetX = (this.scale.width - cols * cellSize) / 2 + cellSize / 2;
    const offsetY = 150;

    this.cards.forEach((card, i) => {
      const x = offsetX + (i % cols) * cellSize;
      const y = offsetY + Math.floor(i / cols) * cellSize;

      // Card Container (Back + Front)
      const cardBack = this.add.rectangle(0, 0, 80, 80, 0x6366f1).setStrokeStyle(2, 0xffffff, 0.3);
      const cardFront = this.add.text(0, 0, card.emoji, { fontSize: '40px' }).setOrigin(0.5).setVisible(false);

      const container = this.add.container(x, y, [cardBack, cardFront]).setSize(80, 80).setInteractive();
      container.setData('cardData', card);
      container.setData('isFlipped', false);

      container.on('pointerdown', () => this.handleCardClick(container, cardBack, cardFront));
    });
  }

  handleCardClick(container, cardBack, cardFront) {
    if (!this.canInteract || container.getData('isFlipped') || this.flippedCards.length >= 2) return;

    // Flip Animation
    this.tweens.add({
      targets: container,
      scaleX: 0,
      duration: 150,
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
      // MATCH
      this.matches++;
      this.tweens.add({
        targets: [card1, card2],
        scale: 1.2,
        duration: 200,
        yoyo: true,
        onComplete: () => {
          card1.destroy();
          card2.destroy();
          this.resetTurn();
        }
      });

      if (this.matches === this.cardData.length) {
        this.time.delayedCall(500, this.showWinScreen, [], this);
      }
    } else {
      // NO MATCH - Flip back
      this.tweens.add({
        targets: [card1, card2],
        x: '+=10',
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          card1.list[0].setVisible(true); // cardBack
          card1.list[1].setVisible(false); // cardFront
          card1.setData('isFlipped', false);
          
          card2.list[0].setVisible(true);
          card2.list[1].setVisible(false);
          card2.setData('isFlipped', false);
          this.resetTurn();
        }
      });
    }
  }

  resetTurn() {
    this.flippedCards = [];
    this.canInteract = true;
  }

  showWinScreen() {
    this.add.text(400, 300, 'PERECT SCORE!', { fill: '#10b981', fontSize: '64px', fontFamily: 'sans-serif' }).setOrigin(0.5);
    this.add.text(400, 350, 'Click to play again', { fill: '#fff', fontSize: '24px', fontFamily: 'sans-serif' }).setOrigin(0.5);
    
    this.input.on('pointerdown', () => this.scene.restart());
  }
}