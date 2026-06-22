import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPOT IT! — Selection Engine  (AAA 2029 — new template #17)
// ============================================================================
// Based on the hit card game Dobble / Spot It.
// Two cards are shown, each with 6 symbols. There is EXACTLY ONE matching
// symbol between them. Player must find and tap it as fast as possible.
//
// Features:
//   • Procedural card generation with guaranteed exactly-one-match
//   • Symbols arranged in circular layout on each card
//   • Tap a symbol on EITHER card to guess
//   • Correct: both matching symbols glow + particle burst + cards flip
//   • Wrong: red flash + screen shake + penalty
//   • Round timer (speed bonus for fast finds)
//   • Level progression + ESL TTS (speak the matched term)
//   • Combo system for rapid correct finds
//   • Global pointer handler for reliable clicks
// ============================================================================

interface SpotItSymbol {
  term: TermItem;
  text: Phaser.GameObjects.Text;
  circle: Phaser.GameObjects.Arc;
  cardIndex: 0 | 1; // which card it's on
  isMatch: boolean;
  hit: boolean;
}

export default class SpotItScene extends BaseEngine {
  private round = 0;
  private maxRounds = 8;
  private symbols: SpotItSymbol[] = [];
  private card1Center = { x: 220, y: 320 };
  private card2Center = { x: 580, y: 320 };
  private cardRadius = 130;
  private symbolsPerCard = 6;
  private canInteract = true;
  private roundStartTime = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private speedBonusText!: Phaser.GameObjects.Text;
  private card1Bg!: Phaser.GameObjects.Arc;
  private card2Bg!: Phaser.GameObjects.Arc;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.maxRounds = this.maxScore;

    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 100,
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
      this.scale.width / 2, 145, 500, 44, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 145,
      'Find the matching symbol!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Speed bonus text ----
    this.speedBonusText = this.add.text(
      this.scale.width / 2, 175, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Card backgrounds (circles) — at full scale, no animation ----
    this.card1Bg = this.add.circle(
      this.card1Center.x, this.card1Center.y, this.cardRadius + 10,
      this.theme.card, 0.8
    ).setStrokeStyle(4, this.theme.accent, 0.7).setDepth(20);

    this.card2Bg = this.add.circle(
      this.card2Center.x, this.card2Center.y, this.cardRadius + 10,
      this.theme.cardAlt, 0.8
    ).setStrokeStyle(4, this.theme.accent2, 0.7).setDepth(20);

    // Card labels
    this.add.text(this.card1Center.x, this.card1Center.y - this.cardRadius - 25, 'Card 1', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(25);
    this.add.text(this.card2Center.x, this.card2Center.y - this.cardRadius - 25, 'Card 2', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(25);

    // ---- Start first round ----
    this.renderRound();

    // ---- Global pointer handler ----
    this.setupGlobalPointer((x, y) => {
      if (!this.canInteract) return;
      for (const sym of this.symbols) {
        if (sym.hit) continue;
        const symX = sym.text.x;
        const symY = sym.text.y;
        if (Math.abs(x - symX) < 35 && Math.abs(y - symY) < 35) {
          this.handleSymbolTap(sym);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private renderRound() {
    if (this.round >= this.maxRounds) {
      this.finishGame(this.score >= this.maxRounds * 0.5);
      return;
    }

    // Clear previous symbols
    this.symbols.forEach(s => { s.text.destroy(); s.circle.destroy(); });
    this.symbols = [];
    this.canInteract = true;
    this.roundStartTime = Date.now();
    this.speedBonusText.setText('');

    // ---- Generate two cards with exactly ONE matching symbol ----
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);

    // Pick the matching term (shared between both cards)
    const matchTerm = pool[0];

    // Pick unique terms for card 1 (excluding match)
    const card1Terms = pool.slice(1, this.symbolsPerCard);
    // Pick unique terms for card 2 (excluding match and card1's terms)
    const card2Terms = pool.slice(this.symbolsPerCard, this.symbolsPerCard * 2 - 1);

    // Combine: card1 = [match, ...card1Terms], card2 = [match, ...card2Terms]
    const card1All = [matchTerm, ...card1Terms];
    const card2All = [matchTerm, ...card2Terms];

    // Shuffle positions on each card
    Phaser.Utils.Array.Shuffle(card1All);
    Phaser.Utils.Array.Shuffle(card2All);

    // ---- Place symbols on cards in circular layout ----
    this.placeSymbolsOnCard(card1All, 0, matchTerm.id);
    this.placeSymbolsOnCard(card2All, 1, matchTerm.id);

    // Animate symbols appearing (scale from 0)
    this.symbols.forEach((sym, i) => {
      sym.text.setScale(0);
      sym.circle.setScale(0);
      this.tweens.add({
        targets: [sym.text, sym.circle],
        scaleX: 1, scaleY: 1,
        duration: 300, delay: i * 50, ease: 'Back.out',
      });
    });
  }

  private placeSymbolsOnCard(terms: TermItem[], cardIndex: 0 | 1, matchId: string) {
    const center = cardIndex === 0 ? this.card1Center : this.card2Center;
    const count = terms.length;

    terms.forEach((term, i) => {
      // Circular layout — symbols arranged around the card center
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const radius = this.cardRadius * 0.6;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      const isMatch = term.id === matchId;

      // Symbol background circle
      const circle = this.add.circle(x, y, 28, this.theme.cardAlt, 0.9)
        .setStrokeStyle(2, this.theme.accent, 0.5).setDepth(30);

      // Symbol text (emoji + term)
      const displayText = term.emoji ?? term.term.slice(0, 4);
      const text = this.add.text(x, y, displayText, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(31);

      // Gentle pulse for all symbols
      this.tweens.add({
        targets: [circle, text],
        scale: { from: 1, to: 1.08 },
        duration: 1000 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });

      const sym: SpotItSymbol = {
        term, text, circle, cardIndex, isMatch, hit: false,
      };
      this.symbols.push(sym);
    });
  }

  private handleSymbolTap(sym: SpotItSymbol) {
    if (!this.canInteract || sym.hit) return;
    sym.hit = true;

    if (sym.isMatch) {
      // CORRECT — found the matching symbol!
      this.canInteract = false;
      const responseTime = Date.now() - this.roundStartTime;
      const speedBonus = Math.max(0, 3000 - responseTime); // up to 3s bonus

      // Find the matching symbol on the other card
      const otherMatch = this.symbols.find(s => s.isMatch && s.cardIndex !== sym.cardIndex);

      // Highlight both matching symbols
      sym.circle.setFillStyle(this.theme.success, 1);
      sym.circle.setStrokeStyle(4, this.theme.success, 1);
      if (otherMatch) {
        otherMatch.circle.setFillStyle(this.theme.success, 1);
        otherMatch.circle.setStrokeStyle(4, this.theme.success, 1);
      }

      // Glow rings on both
      this.juice.glowRing(sym.text.x, sym.text.y, this.theme.success, 60);
      if (otherMatch) {
        this.juice.glowRing(otherMatch.text.x, otherMatch.text.y, this.theme.success, 60);
      }

      // Particle bursts
      this.juice.burst(sym.text.x, sym.text.y, 'correct');
      if (otherMatch) {
        this.juice.burst(otherMatch.text.x, otherMatch.text.y, 'correct');
      }

      // Speed bonus display
      if (responseTime < 2000) {
        this.speedBonusText.setText(`SPEED BONUS! +${Math.round(speedBonus / 100)}`);
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
        coordinate: { x: sym.text.x, y: sym.text.y, t: this.time.now },
      });

      // ESL: speak the matched term
      audioBus.speak(sym.term.term);

      // Cards flip away animation — only animate symbols, not card backgrounds
      this.time.delayedCall(800, () => {
        this.tweens.add({
          targets: this.symbols.map(s => [s.text, s.circle]).flat(),
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
      sym.circle.setFillStyle(this.theme.danger, 0.8);
      sym.circle.setStrokeStyle(3, this.theme.danger, 1);
      this.juice.burst(sym.text.x, sym.text.y, 'incorrect');
      this.juice.shake('light');

      this.recordAnswer({
        term: sym.term.term,
        response: 'wrong-symbol',
        success: false,
        coordinate: { x: sym.text.x, y: sym.text.y, t: this.time.now },
      });

      // Reset the wrong symbol after a moment
      this.time.delayedCall(600, () => {
        sym.circle.setFillStyle(this.theme.cardAlt, 0.9);
        sym.circle.setStrokeStyle(2, this.theme.accent, 0.5);
        sym.hit = false;
      });
    }
  }
}
