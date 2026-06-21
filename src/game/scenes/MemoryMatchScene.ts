import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MEMORY MATCH — Pairing Engine (ID_A ↔ ID_B comparison)
// Flip cards to find matching term/definition pairs.
// ============================================================================

interface Card {
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  pairId: string;
  text: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default class MemoryMatchScene extends BaseEngine {
  private cards: Card[] = [];
  private flippedQueue: Card[] = [];
  private canInteract = true;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    this.add.text(
      this.scale.width / 2, 70,
      'Memory Match',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '42px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.buildGrid();
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private buildGrid() {
    // Build pairs: each term becomes 2 cards (term + emoji/definition)
    const pairs = this.pickTerms(this.maxScore);
    const cards: { pairId: string; text: string }[] = [];
    pairs.forEach(t => {
      cards.push({ pairId: t.id, text: t.term });
      cards.push({ pairId: t.id, text: t.emoji ?? (t.definition ?? '★').slice(0, 4) });
    });
    Phaser.Utils.Array.Shuffle(cards);

    const cardW = 110, cardH = 130;
    const cols = Math.min(cards.length, 4);
    const rows = Math.ceil(cards.length / cols);
    const gap = 16;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cardW / 2;
    const startY = 160;

    cards.forEach((c, i) => {
      const x = startX + (i % cols) * (cardW + gap);
      const y = startY + Math.floor(i / cols) * (cardH + gap);

      const back = this.add.image(0, 0, 'card-back-' + this.theme.id).setDisplaySize(cardW, cardH);
      const front = this.add.image(0, 0, 'card-front-' + this.theme.id).setDisplaySize(cardW, cardH).setVisible(false);
      const label = this.add.text(0, 0, c.text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '27px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: cardW - 10 },
      }).setOrigin(0.5).setVisible(false);

      const container = this.add.container(x, y, [back, front, label]).setSize(cardW, cardH).setInteractive({ useHandCursor: true });

      const card: Card = {
        container, back, front, label,
        pairId: c.pairId, text: c.text,
        isFlipped: false, isMatched: false,
      };

      container.on('pointerdown', () => this.flipCard(card));
      container.setScale(0).setAlpha(0);
      this.tweens.add({
        targets: container,
        scale: 1, alpha: 1,
        duration: 280, delay: i * 50, ease: 'Back.out',
      });

      this.cards.push(card);
    });
  }

  private flipCard(card: Card) {
    if (!this.canInteract || card.isFlipped || card.isMatched || this.flippedQueue.length >= 2) return;
    audioBus.play('flip');

    card.isFlipped = true;
    this.tweens.add({
      targets: card.container,
      scaleX: 0, duration: 160, ease: 'Quad.in',
      onComplete: () => {
        card.back.setVisible(false);
        card.front.setVisible(true);
        card.label.setVisible(true);
        this.tweens.add({
          targets: card.container,
          scaleX: 1, duration: 160, ease: 'Quad.out',
        });
      },
    });

    this.flippedQueue.push(card);
    if (this.flippedQueue.length === 2) {
      this.canInteract = false;
      this.time.delayedCall(700, this.checkMatch, [], this);
    }
  }

  private checkMatch() {
    const [a, b] = this.flippedQueue;
    if (a.pairId === b.pairId) {
      // Match
      audioBus.play('correct');
      // ESL: speak the matched term
      this.speakPrompt(a.text);
      this.juice.burst(a.container.x, a.container.y, 'correct');
      this.juice.burst(b.container.x, b.container.y, 'correct');
      this.recordAnswer({
        term: a.text,
        response: b.text,
        success: true,
        coordinate: { x: (a.container.x + b.container.x) / 2, y: (a.container.y + b.container.y) / 2, t: this.time.now },
      });
      a.isMatched = true; b.isMatched = true;
      this.tweens.add({
        targets: [a.container, b.container],
        scale: 1.2, alpha: 0,
        duration: 400, ease: 'Back.in',
        onComplete: () => {
          a.container.destroy(); b.container.destroy();
        },
      });
      this.checkWin();
    } else {
      // No match
      audioBus.play('incorrect');
      this.recordAnswer({
        term: a.text,
        response: b.text,
        success: false,
        coordinate: { x: (a.container.x + b.container.x) / 2, y: (a.container.y + b.container.y) / 2, t: this.time.now },
      });
      this.tweens.add({
        targets: [a.container, b.container],
        x: '+=6', duration: 50, yoyo: true, repeat: 3,
        onComplete: () => {
          // Flip back
          [a, b].forEach(c => {
            this.tweens.add({
              targets: c.container, scaleX: 0, duration: 140,
              onComplete: () => {
                c.back.setVisible(true);
                c.front.setVisible(false);
                c.label.setVisible(false);
                c.isFlipped = false;
                this.tweens.add({
                  targets: c.container, scaleX: 1, duration: 140,
                });
              },
            });
          });
        },
      });
    }
    this.flippedQueue = [];
    this.time.delayedCall(300, () => { this.canInteract = true; });
  }
}
