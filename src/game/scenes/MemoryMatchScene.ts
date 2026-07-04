import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MEMORY MATCH — Pairing Engine  (AAA 2029 edition)
// ============================================================================
// Premium card matching with:
//   • 3D card flip (scaleX 1→0→1 with perspective)
//   • Match glow ring connecting the two matched cards
//   • Mismatch shake + red flash
//   • Shuffle animation at start (cards fly in from off-screen)
//   • Hover lift effect (card rises slightly on hover)
//   • Match celebration: particle burst + scale pulse + TTS
//   • Move counter + pairs found display
//   • Smooth card vanish on match
// ============================================================================

interface Card {
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  pairId: string;
  text: string;
  term: TermItem;
  isFlipped: boolean;
  isMatched: boolean;
  homeX: number;
  homeY: number;
}

export default class MemoryMatchScene extends BaseEngine {
  private cards: Card[] = [];
  private flippedQueue: Card[] = [];
  private canInteract = true;
  private moves = 0;
  private movesText!: Phaser.GameObjects.Text;
  private pairsText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 100,
      'Memory Match',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Stats bar (moves + pairs) ----
    this.movesText = this.add.text(
      this.scale.width / 2 - 80, 140, 'Moves: 0',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(50);

    this.pairsText = this.add.text(
      this.scale.width / 2 + 80, 140, 'Pairs: 0/0',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(50);

    this.buildGrid();

    // Global pointer handler for reliable card clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canInteract) return;
      for (const card of this.cards) {
        if (card.isFlipped || card.isMatched) continue;
        const cardW = 100, cardH = 120;
        if (Math.abs(x - card.container.x) < cardW / 2 && Math.abs(y - card.container.y) < cardH / 2) {
          // ESL: speak the card's text when flipped
          audioBus.speak(card.text);
          this.flipCard(card);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private buildGrid() {
    // Build pairs: each term becomes 2 cards (term + emoji/definition)
    const pairs = this.pickTerms(this.maxScore);
    this.pairsText.setText(`Pairs: 0/${pairs.length}`);

    const cards: { pairId: string; text: string; term: TermItem }[] = [];
    pairs.forEach(t => {
      cards.push({ pairId: t.id, text: t.term, term: t });
      cards.push({ pairId: t.id, text: t.emoji ?? (t.definition ?? '★').slice(0, 4), term: t });
    });
    Phaser.Utils.Array.Shuffle(cards);

    const cardW = 100, cardH = 120;
    const cols = Math.min(cards.length, 4);
    const rows = Math.ceil(cards.length / cols);
    const gap = 14;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cardW / 2;
    const startY = 240;

    cards.forEach((c, i) => {
      const x = startX + (i % cols) * (cardW + gap);
      const y = startY + Math.floor(i / cols) * (cardH + gap);

      const back = this.add.image(0, 0, 'card-back-' + this.theme.id).setDisplaySize(cardW, cardH);
      const front = this.add.image(0, 0, 'card-front-' + this.theme.id).setDisplaySize(cardW, cardH).setVisible(false);
      const label = this.add.text(0, 0, c.text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: cardW - 10 },
      }).setOrigin(0.5).setVisible(false);

      // AAAA — Number badge on each card for verbal identification in online classes
      const numBg = this.add.circle(-cardW / 2 + 14, -cardH / 2 + 14, 12, this.theme.accent, 0.9)
        .setStrokeStyle(1.5, 0xffffff, 0.6);
      const numText = this.add.text(-cardW / 2 + 14, -cardH / 2 + 14, String(i + 1), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      // Make number badge speakable — tap to hear "Card N"
      numText.setData('speakText', `Card ${i + 1}`);

      const container = this.add.container(x, y, [back, front, label, numBg, numText])
        .setSize(cardW, cardH).setInteractive({ useHandCursor: true });

      const card: Card = {
        container, back, front, label,
        pairId: c.pairId, text: c.text, term: c.term,
        isFlipped: false, isMatched: false,
        homeX: x, homeY: y,
      };

      // Hover lift effect
      container.on('pointerover', () => {
        if (this.canInteract && !card.isFlipped && !card.isMatched) {
          this.tweens.add({
            targets: container,
            y: y - 8, scale: 1.05,
            duration: 150, ease: 'Quad.out',
          });
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        if (!card.isFlipped && !card.isMatched) {
          this.tweens.add({
            targets: container,
            y: y, scale: 1,
            duration: 150, ease: 'Quad.out',
          });
        }
      });
      // NOTE: per-container pointerdown removed — the global handler in
      // setupGlobalPointer handles card flips. Double-listening caused
      // flipCard() to fire twice on a single tap, instantly un-flipping cards.

      // Shuffle animation: fly in from random off-screen position
      const angle = Math.random() * Math.PI * 2;
      const dist = 400;
      container.setX(x + Math.cos(angle) * dist);
      container.setY(y + Math.sin(angle) * dist);
      container.setAlpha(0).setScale(0.5);

      this.tweens.add({
        targets: container,
        x: x, y: y,
        alpha: 1, scale: 1,
        duration: 500, delay: i * 60, ease: 'Back.out',
      });

      this.cards.push(card);
    });
  }

  private flipCard(card: Card) {
    if (!this.canInteract || card.isFlipped || card.isMatched || this.flippedQueue.length >= 2) return;
    audioBus.play('flip');

    card.isFlipped = true;
    // 3D flip: scaleX 1→0, swap, scaleX 0→1
    this.tweens.add({
      targets: card.container,
      scaleX: 0, duration: 180, ease: 'Quad.in',
      onComplete: () => {
        card.back.setVisible(false);
        card.front.setVisible(true);
        card.label.setVisible(true);
        this.tweens.add({
          targets: card.container,
          scaleX: 1, duration: 180, ease: 'Quad.out',
        });
      },
    });

    this.flippedQueue.push(card);
    if (this.flippedQueue.length === 2) {
      this.canInteract = false;
      this.moves++;
      this.movesText.setText(`Moves: ${this.moves}`);
      this.time.delayedCall(700, this.checkMatch, [], this);
    }
  }

  private checkMatch() {
    const [a, b] = this.flippedQueue;
    const midX = (a.container.x + b.container.x) / 2;
    const midY = (a.container.y + b.container.y) / 2;

    if (a.pairId === b.pairId) {
      // Match!
      audioBus.play('correct');
  

      // Glow ring connecting the two cards
      this.juice.glowRing(a.container.x, a.container.y, this.theme.success, 60);
      this.juice.glowRing(b.container.x, b.container.y, this.theme.success, 60);

      // Connecting line
      const line = this.add.graphics();
      line.lineStyle(4, this.theme.success, 0.8);
      line.beginPath();
      line.moveTo(a.container.x, a.container.y);
      line.lineTo(b.container.x, b.container.y);
      line.strokePath();
      line.setDepth(45);
      this.tweens.add({
        targets: line,
        alpha: 0,
        duration: 600, ease: 'Cubic.out',
        onComplete: () => line.destroy(),
      });

      this.juice.burst(a.container.x, a.container.y, 'correct');
      this.juice.burst(b.container.x, b.container.y, 'correct');

      this.recordAnswer({
        term: a.text,
        response: b.text,
        success: true,
        coordinate: { x: midX, y: midY, t: this.time.now },
      });

      a.isMatched = true; b.isMatched = true;
      this.pairsText.setText(`Pairs: ${this.score + 1}/${this.maxScore}`);

      // Match celebration: scale pulse + fade
      this.tweens.add({
        targets: [a.container, b.container],
        scale: 1.3,
        duration: 300, ease: 'Back.out',
        yoyo: true,
        onComplete: () => {
          this.tweens.add({
            targets: [a.container, b.container],
            scale: 0, alpha: 0,
            duration: 300, ease: 'Back.in',
            onComplete: () => {
              a.container.destroy(); b.container.destroy();
            },
          });
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
        coordinate: { x: midX, y: midY, t: this.time.now },
      });

      // Red flash + shake
      this.juice.flash(this.theme.danger, 0.15, 100);
      this.tweens.add({
        targets: [a.container, b.container],
        x: '+=8', duration: 50, yoyo: true, repeat: 3,
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
    this.time.delayedCall(400, () => { this.canInteract = true; });
  }
}
