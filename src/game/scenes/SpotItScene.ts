import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPOT IT! — Living Textbook edition (Dobble-style matching game)
// ============================================================================
// Two cards are shown side by side. Each card has N symbols.
// There is EXACTLY ONE symbol that appears on BOTH cards.
// The player must find and tap that matching symbol as fast as possible.
//
// Gameplay:
//   1. Two circular cards appear (left = Card 1, right = Card 2)
//   2. Each card shows 4-6 emoji+word symbols in a circular layout
//   3. Exactly ONE symbol is shared between both cards
//   4. Player taps any symbol they think is on both cards
//   5. Correct → both matching symbols glow green + particle burst + TTS
//   6. Wrong → red flash + shake + that symbol dims briefly
//   7. After correct, cards flip away and next round appears
//
// ESL Features:
//   • Prompt spoken aloud: "Find the symbol that appears on both cards!"
//   • On correct match, the matched term is spoken aloud
//   • Number badges on cards ("Card 1", "Card 2") for verbal identification
//   • Tap any symbol to hear its name (even before matching)
// ============================================================================

interface SpotItSymbol {
  term: TermItem;
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  emojiText: Phaser.GameObjects.Text;
  labelText: Phaser.GameObjects.Text;
  cardIndex: 0 | 1;
  isMatch: boolean;
  hit: boolean;
  homeX: number;
  homeY: number;
}

export default class SpotItScene extends BaseEngine {
  private round = 0;
  private maxRounds = 8;
  private symbols: SpotItSymbol[] = [];
  private card1Center = { x: 220, y: 360 };
  private card2Center = { x: 580, y: 360 };
  private cardRadius = 130;
  private symbolsPerCard = 5;
  private canInteract = true;
  private roundStartTime = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private speedBonusText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.maxRounds = this.maxScore;

    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 95,
      '👁️ Spot It!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 145, 600, 50, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 145,
      'Find the symbol that appears on BOTH cards!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 560 },
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Round counter ----
    this.roundText = this.add.text(
      this.scale.width / 2, 180, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Speed bonus text ----
    this.speedBonusText = this.add.text(
      this.scale.width / 2, 555, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Card backgrounds ----
    this.drawCard(this.card1Center, this.theme.accent, 'Card 1');
    this.drawCard(this.card2Center, this.theme.accent2, 'Card 2');

    // ---- Start first round ----
    this.renderRound();

    // ---- Global pointer handler ----
    this.setupGlobalPointer((x, y) => {
      if (!this.canInteract) return;

      // Find the closest symbol to the tap point
      let closest: SpotItSymbol | null = null;
      let closestDist = Infinity;
      for (const sym of this.symbols) {
        if (sym.hit) continue;
        const dx = x - sym.container.x;
        const dy = y - sym.container.y;
        const dist = dx * dx + dy * dy;
        // Hit radius: 45px (symbols are ~64px wide)
        if (dist < 45 * 45 && dist < closestDist) {
          closestDist = dist;
          closest = sym;
        }
      }
      if (closest) {
        this.handleSymbolTap(closest);
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private drawCard(center: { x: number; y: number }, borderColor: number, label: string) {
    // Outer card circle (thick border)
    this.add.circle(
      center.x, center.y, this.cardRadius + 14,
      this.theme.card, 0.92
    ).setStrokeStyle(6, borderColor, 0.95).setDepth(20);

    // Inner card circle (subtle fill)
    this.add.circle(
      center.x, center.y, this.cardRadius + 8,
      this.theme.cardAlt, 0.5
    ).setDepth(21);

    // Card label badge (top)
    const badgeBg = this.add.rectangle(center.x, center.y - this.cardRadius - 25, 90, 26, borderColor, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.7).setDepth(25);
    const badgeText = this.add.text(center.x, center.y - this.cardRadius - 25, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(26);
    void badgeBg; void badgeText;
  }

  private renderRound() {
    if (this.round >= this.maxRounds) {
      this.finishGame(this.score >= this.maxRounds * 0.5);
      return;
    }

    // Clear previous symbols
    this.symbols.forEach(s => s.container.destroy());
    this.symbols = [];
    this.canInteract = true;
    this.roundStartTime = Date.now();
    this.speedBonusText.setText('');
    this.roundText.setText(`Round ${this.round + 1} of ${this.maxRounds}`);

    // ---- Generate two cards with exactly ONE matching symbol ----
    // We need: 1 match + (K-1) unique on card1 + (K-1) unique on card2
    // Total terms needed: 1 + 2*(K-1) = 2K - 1
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);

    // K = symbols per card. Cap at 5, but also limited by available terms.
    // Need at least 2K-1 terms. If we have 8 terms, K can be up to 4 (need 7).
    const maxK = Math.floor((pool.length + 1) / 2);
    const K = Math.min(this.symbolsPerCard, maxK);

    if (K < 2) {
      // Not enough terms to make a valid round
      this.finishGame(false);
      return;
    }

    const matchTerm = pool[0];
    const card1Unique = pool.slice(1, K);           // K-1 items
    const card2Unique = pool.slice(K, 2 * K - 1);   // K-1 items
    const card1All = [matchTerm, ...card1Unique];
    const card2All = [matchTerm, ...card2Unique];
    Phaser.Utils.Array.Shuffle(card1All);
    Phaser.Utils.Array.Shuffle(card2All);

    this.placeSymbolsOnCard(card1All, 0, matchTerm.id);
    this.placeSymbolsOnCard(card2All, 1, matchTerm.id);

    // Animate symbols appearing
    this.symbols.forEach((sym, i) => {
      sym.container.setScale(0);
      this.tweens.add({
        targets: sym.container,
        scale: 1,
        duration: 300, delay: i * 50, ease: 'Back.out',
      });
    });

    // ESL: speak the prompt (synchronous with user gesture if this is round 1+
    // and they've already tapped to start. If pre-gesture, browser may block.)
    this.time.delayedCall(400, () => {
      if (!this.isFinished) {
        audioBus.speak('Find the matching symbol!', { isQuestion: true });
      }
    });
  }

  private placeSymbolsOnCard(terms: TermItem[], cardIndex: 0 | 1, matchId: string) {
    const center = cardIndex === 0 ? this.card1Center : this.card2Center;
    const count = terms.length;
    // Place symbols in a circle inside the card
    const radius = this.cardRadius * 0.6;

    terms.forEach((term, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      const isMatch = term.id === matchId;

      // Symbol background circle
      const circle = this.add.circle(0, 0, 30, this.theme.card, 0.98)
        .setStrokeStyle(3, this.theme.accent, 0.8).setDepth(30);

      // Symbol display: prefer emoji, fall back to first 2-3 letters of the term.
      // CRITICAL: if we show '?' for every emoji-less term, all symbols look identical
      // and the game is unplayable ("nonsensical gameplay" bug).
      const displayEmoji = term.emoji ?? '';
      const displayLabel = term.emoji ? term.term : term.term.slice(0, 3).toUpperCase();
      const emojiText = this.add.text(0, displayEmoji ? -8 : 0, displayEmoji, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
      }).setOrigin(0.5).setDepth(31);

      // Symbol term label (small, below emoji — or centered if no emoji)
      const labelText = this.add.text(0, displayEmoji ? 14 : 0, this.truncate(displayLabel, 8), {
        fontFamily: 'Inter, sans-serif',
        fontSize: displayEmoji ? '10px' : '14px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(31);

      const container = this.add.container(x, y, [circle, emojiText, labelText])
        .setDepth(30);

      // Gentle pulse animation
      this.tweens.add({
        targets: container,
        scale: { from: 1, to: 1.06 },
        duration: 1000 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });

      const sym: SpotItSymbol = {
        term, container, circle, emojiText, labelText,
        cardIndex, isMatch, hit: false,
        homeX: x, homeY: y,
      };
      this.symbols.push(sym);
    });
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  private handleSymbolTap(sym: SpotItSymbol) {
    if (!this.canInteract || sym.hit) return;

    if (sym.isMatch) {
      // CORRECT — found the matching symbol!
      sym.hit = true;
      this.canInteract = false;
      const responseTime = Date.now() - this.roundStartTime;
      const speedBonus = Math.max(0, 3000 - responseTime);

      // Find the matching symbol on the other card
      const otherMatch = this.symbols.find(s => s.isMatch && s.cardIndex !== sym.cardIndex);
      if (otherMatch) otherMatch.hit = true;

      // Highlight both matching symbols green
      sym.circle.setFillStyle(this.theme.success, 1);
      sym.circle.setStrokeStyle(5, this.theme.success, 1);
      if (otherMatch) {
        otherMatch.circle.setFillStyle(this.theme.success, 1);
        otherMatch.circle.setStrokeStyle(5, this.theme.success, 1);
      }

      // Glow rings on both
      this.juice.glowRing(sym.container.x, sym.container.y, this.theme.success, 80);
      if (otherMatch) {
        this.juice.glowRing(otherMatch.container.x, otherMatch.container.y, this.theme.success, 80);
      }

      // Particle bursts
      this.juice.burst(sym.container.x, sym.container.y, 'correct');
      if (otherMatch) {
        this.juice.burst(otherMatch.container.x, otherMatch.container.y, 'correct');
      }

      // Speed bonus display
      if (responseTime < 2000) {
        this.speedBonusText.setText(`⚡ SPEED BONUS! +${Math.round(speedBonus / 100)}`);
        this.tweens.add({
          targets: this.speedBonusText,
          scale: { from: 1.5, to: 1 },
          duration: 300, ease: 'Back.out',
        });
      }

      this.recordAnswer({
        term: sym.term.term,
        response: 'matched',
        success: true,
        coordinate: { x: sym.container.x, y: sym.container.y, t: this.time.now },
      });

      // ESL: speak the matched term
      audioBus.speak(sym.term.term);

      // Scale up both matching symbols briefly
      this.tweens.add({
        targets: [sym.container, otherMatch?.container].filter(Boolean),
        scale: 1.3,
        duration: 300, ease: 'Back.out', yoyo: true,
      });

      // Cards flip away animation → next round
      this.time.delayedCall(1000, () => {
        this.tweens.add({
          targets: this.symbols.map(s => s.container),
          scaleX: 0, scaleY: 0,
          duration: 300, ease: 'Back.in',
          onComplete: () => {
            this.round++;
            this.renderRound();
          },
        });
      });
    } else {
      // WRONG — not the matching symbol
      sym.hit = true;
      sym.circle.setFillStyle(this.theme.danger, 0.7);
      sym.circle.setStrokeStyle(4, this.theme.danger, 1);
      this.juice.burst(sym.container.x, sym.container.y, 'incorrect');
      this.juice.shake('light');

      // ESL: speak the wrong symbol's name so students learn from mistakes
      audioBus.speak(sym.term.term);

      this.recordAnswer({
        term: sym.term.term,
        response: 'wrong-symbol',
        success: false,
        coordinate: { x: sym.container.x, y: sym.container.y, t: this.time.now },
      });

      // Shake the wrong symbol
      this.tweens.add({
        targets: sym.container,
        x: '+=8', duration: 50, yoyo: true, repeat: 3,
      });

      // Reset the wrong symbol after a moment
      this.time.delayedCall(700, () => {
        if (sym && sym.container && sym.container.active) {
          sym.circle.setFillStyle(this.theme.card, 0.98);
          sym.circle.setStrokeStyle(3, this.theme.accent, 0.8);
          sym.hit = false;
        }
      });
    }
  }
}
