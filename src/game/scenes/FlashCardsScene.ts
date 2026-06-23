import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// FLASH CARDS — Pairing Engine  (AAA 2029 — new template #13)
// ============================================================================
// Digital flash cards with 3D flip animation.
//   • Tap card to flip (term → definition)
//   • Tap term/definition to hear it spoken (ESL)
//   • Swipe or tap arrows to navigate
//   • Mark "Known" / "Review" to track progress
//   • Progress bar shows cards reviewed
//   • Level progression (inherited)
// ============================================================================

interface FlashCard {
  term: TermItem;
  isFlipped: boolean;
  known: boolean;
}

export default class FlashCardsScene extends BaseEngine {
  private cards: FlashCard[] = [];
  private currentIdx = 0;
  private cardContainer!: Phaser.GameObjects.Container;
  private cardBg!: Phaser.GameObjects.Rectangle;
  private cardText!: Phaser.GameObjects.Text;
  private cardEmoji!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private navText!: Phaser.GameObjects.Text;
  private isFlipping = false;
  private knownCount = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 105,
      '📇 Flash Cards',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Card (center of screen) — BIGGER and more colorful ----
    const cardW = 440, cardH = 280;
    const cardX = this.scale.width / 2;
    const cardY = this.scale.height / 2;

    // Card shadow
    const shadow = this.add.rectangle(cardX + 8, cardY + 8, cardW, cardH, 0x000000, 0.4).setDepth(48);

    // Card background with gradient effect (two layers)
    this.cardBg = this.add.rectangle(cardX, cardY, cardW, cardH, this.theme.card, 1)
      .setStrokeStyle(5, this.theme.accent, 1).setDepth(49)
      .setInteractive({ useHandCursor: true });

    // Colorful top stripe
    const topStripe = this.add.rectangle(cardX, cardY - cardH / 2 + 6, cardW - 10, 8, this.theme.accent2, 0.9)
      .setDepth(49);
    // Colorful bottom stripe
    const bottomStripe = this.add.rectangle(cardX, cardY + cardH / 2 - 6, cardW - 10, 8, this.theme.warning, 0.9)
      .setDepth(49);

    // Card emoji (BIGGER — 80px)
    this.cardEmoji = this.add.text(cardX, cardY - 70, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '80px',
    }).setOrigin(0.5).setDepth(50);

    // Card text (BIGGER — 30px)
    this.cardText = this.add.text(cardX, cardY + 30, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '30px',
      color: this.hex(this.theme.text),
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardW - 50 },
    }).setOrigin(0.5).setDepth(50);

    // Hint text (below card) — bigger
    this.hintText = this.add.text(cardX, cardY + cardH / 2 + 30, 'Tap card to flip · Tap text to hear', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Navigation arrows — BIGGER
    const arrowY = cardY;
    const prevArrow = this.add.text(cardX - cardW / 2 - 50, arrowY, '◀', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '50px',
      color: this.hex(this.theme.accent),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });
    prevArrow.on('pointerdown', () => this.prevCard());

    const nextArrow = this.add.text(cardX + cardW / 2 + 50, arrowY, '▶', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '50px',
      color: this.hex(this.theme.accent),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });
    nextArrow.on('pointerdown', () => this.nextCard());

    // Known / Review buttons — BIGGER and more colorful
    const btnY = cardY + cardH / 2 + 80;
    const knownBtn = this.add.rectangle(cardX - 90, btnY, 140, 44, this.theme.success, 0.8)
      .setStrokeStyle(2, this.theme.success, 1).setDepth(50)
      .setInteractive({ useHandCursor: true });
    const knownTxt = this.add.text(cardX - 90, btnY, '✓ I Know This', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    knownBtn.on('pointerover', () => knownBtn.setFillStyle(this.theme.success, 1));
    knownBtn.on('pointerout', () => knownBtn.setFillStyle(this.theme.success, 0.8));
    knownBtn.on('pointerdown', () => this.markKnown(true));
    void knownTxt;

    const reviewBtn = this.add.rectangle(cardX + 90, btnY, 140, 44, this.theme.warning, 0.8)
      .setStrokeStyle(2, this.theme.warning, 1).setDepth(50)
      .setInteractive({ useHandCursor: true });
    const reviewTxt = this.add.text(cardX + 90, btnY, '↻ Review', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    reviewBtn.on('pointerover', () => reviewBtn.setFillStyle(this.theme.warning, 1));
    reviewBtn.on('pointerout', () => reviewBtn.setFillStyle(this.theme.warning, 0.8));
    reviewBtn.on('pointerdown', () => this.markKnown(false));
    void reviewTxt;

    // Card flip on tap
    this.cardBg.on('pointerdown', () => this.flipCard());
    this.cardText.on('pointerdown', () => {
      // Tap text to hear it
      const card = this.cards[this.currentIdx];
      if (!card) return;
      if (card.isFlipped) {
    
      } else {
    
      }
      audioBus.play('tap');
    });
    this.cardEmoji.on('pointerdown', () => this.flipCard());

    // Nav text (bottom)
    this.navText = this.add.text(cardX, this.scale.height - 30, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Build cards
    this.cards = this.pickTerms(this.maxScore).map(term => ({
      term, isFlipped: false, known: false,
    }));

    void shadow;
    this.showCard();

    // Global pointer handler for reliable card interactions
    this.setupGlobalPointer((x, y) => {
      // Hit-test card (flip) — bigger card
      const cardX = this.scale.width / 2;
      const cardY = this.scale.height / 2;
      if (Math.abs(x - cardX) < 220 && Math.abs(y - cardY) < 140) {
        // ESL: speak the card content
        const card = this.cards[this.currentIdx];
        if (card) {
          if (card.isFlipped) {
            audioBus.speak(card.term.definition ?? card.term.term);
          } else {
            audioBus.speak(card.term.term);
          }
        }
        this.flipCard();
        return;
      }
      // Hit-test prev arrow
      if (Math.abs(x - (cardX - 230)) < 25 && Math.abs(y - cardY) < 25) {
        this.prevCard();
        return;
      }
      // Hit-test next arrow
      if (Math.abs(x - (cardX + 230)) < 25 && Math.abs(y - cardY) < 25) {
        this.nextCard();
        return;
      }
      // Hit-test "I Know This" button
      const btnY = cardY + 120 + 70;
      if (Math.abs(x - (cardX - 90)) < 70 && Math.abs(y - btnY) < 22) {
        this.markKnown(true);
        return;
      }
      // Hit-test "Review" button
      if (Math.abs(x - (cardX + 90)) < 70 && Math.abs(y - btnY) < 22) {
        this.markKnown(false);
        return;
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private showCard() {
    const card = this.cards[this.currentIdx];
    if (!card) return;
    this.cardEmoji.setText(card.term.emoji ?? '');
    if (card.isFlipped) {
      this.cardText.setText(card.term.definition ?? card.term.term);
      this.cardBg.setFillStyle(this.theme.cardAlt, 1);
    } else {
      this.cardText.setText(card.term.term);
      this.cardBg.setFillStyle(this.theme.card, 1);
    }
    this.navText.setText(`Card ${this.currentIdx + 1} / ${this.cards.length}  ·  Known: ${this.knownCount}`);

    // ESL: speak the term when card is shown

  }

  private flipCard() {
    if (this.isFlipping) return;
    this.isFlipping = true;
    audioBus.play('flip');

    const card = this.cards[this.currentIdx];
    if (!card) { this.isFlipping = false; return; }

    // 3D flip animation (scale X to 0, swap content, scale back)
    this.tweens.add({
      targets: [this.cardBg, this.cardText, this.cardEmoji],
      scaleX: 0,
      duration: 180, ease: 'Quad.in',
      onComplete: () => {
        card.isFlipped = !card.isFlipped;
        this.showCard();
        this.tweens.add({
          targets: [this.cardBg, this.cardText, this.cardEmoji],
          scaleX: 1,
          duration: 180, ease: 'Quad.out',
          onComplete: () => { this.isFlipping = false; },
        });
      },
    });
  }

  private nextCard() {
    if (this.isFlipping) return;
    audioBus.play('tap');
    if (this.currentIdx < this.cards.length - 1) {
      this.currentIdx++;
      this.cards[this.currentIdx].isFlipped = false;
      this.showCard();
      this.slideAnimation(1);
    }
  }

  private prevCard() {
    if (this.isFlipping) return;
    audioBus.play('tap');
    if (this.currentIdx > 0) {
      this.currentIdx--;
      this.cards[this.currentIdx].isFlipped = false;
      this.showCard();
      this.slideAnimation(-1);
    }
  }

  private slideAnimation(dir: number) {
    this.tweens.add({
      targets: [this.cardBg, this.cardText, this.cardEmoji],
      x: { from: this.scale.width / 2 + dir * 40, to: this.scale.width / 2 },
      duration: 250, ease: 'Back.out',
    });
  }

  private markKnown(known: boolean) {
    const card = this.cards[this.currentIdx];
    if (!card) return;
    const wasKnown = card.known;
    card.known = known;
    if (known && !wasKnown) this.knownCount++;
    if (!known && wasKnown) this.knownCount--;

    // Record answer (for telemetry + level progression)
    this.recordAnswer({
      term: card.term.term,
      response: known ? 'known' : 'review',
      success: known,
      coordinate: { x: this.scale.width / 2, y: this.scale.height / 2, t: this.time.now },
    });

    // Visual feedback
    this.juice.burst(this.scale.width / 2, this.scale.height / 2, known ? 'correct' : 'incorrect');

    // Auto-advance after short delay
    this.time.delayedCall(400, () => {
      if (this.currentIdx < this.cards.length - 1) {
        this.nextCard();
      } else {
        // All cards reviewed
        this.checkWin();
      }
    });
  }
}
