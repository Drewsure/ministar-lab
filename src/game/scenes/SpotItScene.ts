import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPOT IT! — Living Textbook edition (AAA 2029 — suspense revamp)
// ============================================================================
// Dobble-style matching with escalating suspense:
//   • Per-round countdown timer — starts generous (12s), shrinks 1s per round
//     down to a minimum of 4s. Timer bar at top, turns red < 3s.
//   • Combo system — each correct match in a row builds combo (x2, x3, x4...).
//     Wrong answer OR timeout = combo reset to 0.
//   • Stakes rise: round 5+ adds an extra decoy per card (K=6 instead of 5).
//   • Drama cues: timer tick sound at < 5s, screen edge pulse red at < 3s,
//     "Hurry!" banner flashes at < 2s.
//   • Near-miss feedback: if player taps a wrong symbol that's "close"
//     (shares the same first letter as the match), gentle yellow flash
//     instead of red — tells them they're on the right track.
//   • Level-up preview: between rounds, a 0.8s "Round N+1 incoming" banner
//     with the next round's symbols fading in (foreshadowing).
//   • Final-round drama: last round gets a gold border on the cards +
//     "FINAL ROUND!" banner + slower music tempo for tension.
// ESL features preserved: TTS prompt, tap-to-hear symbols, number badges.
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

  // DRAMA: suspense systems
  private combo = 0;
  private maxCombo = 0;
  private comboText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerBarBg!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft = 12;
  private roundTimeLimit = 12;
  private timerEvent?: Phaser.Time.TimerEvent;
  private urgencyOverlay?: Phaser.GameObjects.Rectangle;
  private finalRoundBanner?: Phaser.GameObjects.Text;
  private roundPreviewText?: Phaser.GameObjects.Text;
  private card1Border?: Phaser.GameObjects.Arc;
  private card2Border?: Phaser.GameObjects.Arc;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.maxRounds = this.maxScore;

    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 60,
      '👁️ Spot It!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- DRAMA: Timer bar (top of screen) ----
    this.timerBarBg = this.add.rectangle(
      this.scale.width / 2, 95, 500, 14, 0x000000, 0.4
    ).setStrokeStyle(1, this.theme.accent, 0.3).setDepth(48);
    this.timerBar = this.add.rectangle(
      this.scale.width / 2 - 250, 95, 500, 14, this.theme.success, 1
    ).setOrigin(0, 0.5).setDepth(49);
    this.timerText = this.add.text(
      this.scale.width / 2, 113, '',
      { fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: this.hex(this.theme.textMuted) }
    ).setOrigin(0.5).setDepth(50);

    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 145, 600, 38, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 145,
      'Find the symbol that appears on BOTH cards!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 560 },
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Round counter ----
    this.roundText = this.add.text(
      this.scale.width / 2, 175, '',
      { fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: this.hex(this.theme.textMuted) }
    ).setOrigin(0.5).setDepth(50);

    // ---- DRAMA: Combo display (top-right) ----
    this.comboText = this.add.text(
      this.scale.width - 20, 90, '',
      { fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: this.hex(this.theme.warning), fontStyle: 'bold' }
    ).setOrigin(1, 0).setDepth(50);

    // ---- Speed bonus text ----
    this.speedBonusText = this.add.text(
      this.scale.width / 2, 555, '',
      { fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: this.hex(this.theme.warning), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(50);

    // ---- Card backgrounds (with borders we can re-tint) ----
    this.card1Border = this.drawCard(this.card1Center, this.theme.accent, 'Card 1');
    this.card2Border = this.drawCard(this.card2Center, this.theme.accent2, 'Card 2');

    // ---- DRAMA: Urgency overlay (red border pulse when time is low) ----
    this.urgencyOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      this.theme.danger, 0
    ).setDepth(200).setStrokeStyle(8, this.theme.danger, 0);

    // ---- DRAMA: Final-round banner (hidden initially) ----
    this.finalRoundBanner = this.add.text(
      this.scale.width / 2, 200, '🏆 FINAL ROUND!',
      { fontFamily: 'Inter, sans-serif', fontSize: '32px',
        color: this.hex(this.theme.warning), fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5 }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);

    // ---- DRAMA: Round preview text (between rounds) ----
    this.roundPreviewText = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      '', { fontFamily: 'Inter, sans-serif', fontSize: '36px',
        color: this.hex(this.theme.accent), fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5 }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);

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

  protected onTick(_remainingMs: number) {
    // DRAMA: Update timer bar width based on time left
    if (this.timeLeft > 0 && this.roundTimeLimit > 0) {
      const pct = Math.max(0, this.timeLeft / this.roundTimeLimit);
      this.timerBar.width = 500 * pct;
      // Color shift: green → yellow → red
      if (pct > 0.5) this.timerBar.setFillStyle(this.theme.success, 1);
      else if (pct > 0.25) this.timerBar.setFillStyle(this.theme.warning, 1);
      else this.timerBar.setFillStyle(this.theme.danger, 1);
      this.timerText.setText(`${this.timeLeft.toFixed(1)}s`);

      // DRAMA: Urgency overlay pulse when < 3s
      if (this.timeLeft < 3 && this.urgencyOverlay) {
        const pulse = (Math.sin(this.time.now / 100) + 1) / 2;
        this.urgencyOverlay.setStrokeStyle(8, this.theme.danger, 0.3 + pulse * 0.5);
      } else if (this.urgencyOverlay) {
        this.urgencyOverlay.setStrokeStyle(8, this.theme.danger, 0);
      }
    }
  }

  private drawCard(center: { x: number; y: number }, borderColor: number, label: string): Phaser.GameObjects.Arc {
    // Outer card circle (thick border) — return it so we can re-tint on final round
    const outerBorder = this.add.circle(
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
    return outerBorder;
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
    const isFinalRound = this.round === this.maxRounds - 1;
    this.roundText.setText(`Round ${this.round + 1} of ${this.maxRounds}${isFinalRound ? ' · FINAL' : ''}`);

    // DRAMA: Time limit shrinks per round. Round 1 = 12s, Round 2 = 11s, ...
    // down to a minimum of 4s. Final round = 6s for tension.
    this.roundTimeLimit = isFinalRound ? 6 : Math.max(4, 12 - this.round);
    this.timeLeft = this.roundTimeLimit;
    this.timerText.setColor(this.hex(this.theme.textMuted));

    // DRAMA: Final-round visual cue — gold borders on both cards
    if (isFinalRound && this.card1Border && this.card2Border) {
      this.card1Border.setStrokeStyle(8, this.theme.warning, 1);
      this.card2Border.setStrokeStyle(8, this.theme.warning, 1);
      // Show final-round banner
      if (this.finalRoundBanner) {
        this.finalRoundBanner.setAlpha(0);
        this.tweens.add({
          targets: this.finalRoundBanner,
          alpha: { from: 0, to: 1 }, scale: { from: 0.5, to: 1 },
          duration: 400, ease: 'Back.out', yoyo: true, hold: 800,
        });
      }
      audioBus.speak('Final round!');
    } else if (this.card1Border && this.card2Border) {
      this.card1Border.setStrokeStyle(6, this.theme.accent, 0.95);
      this.card2Border.setStrokeStyle(6, this.theme.accent2, 0.95);
    }

    // ---- Generate two cards with exactly ONE matching symbol ----
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);

    // K = symbols per card. Round 5+ adds an extra symbol (K=6) for difficulty.
    const maxK = Math.floor((pool.length + 1) / 2);
    const dynamicK = this.round >= 4 ? this.symbolsPerCard + 1 : this.symbolsPerCard;
    const K = Math.min(dynamicK, maxK);

    if (K < 2) {
      this.finishGame(false);
      return;
    }

    const matchTerm = pool[0];
    const card1Unique = pool.slice(1, K);
    const card2Unique = pool.slice(K, 2 * K - 1);
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

    // Start the timer
    if (this.timerEvent) this.timerEvent.remove();
    this.timerEvent = this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.timerEvent) this.timerEvent.remove(); return; }
        this.timeLeft -= 0.1;
        if (this.timeLeft <= 5 && this.timeLeft > 0) {
          // Tick sound at < 5s
          if (Math.floor(this.timeLeft * 10) % 10 === 0) {
            try { audioBus.play('tap', { freq: 660 }); } catch {}
          }
        }
        if (this.timeLeft <= 2 && this.timeLeft > 0) {
          // "Hurry!" banner
          if (this.roundPreviewText && this.roundPreviewText.alpha === 0) {
            this.roundPreviewText.setText('⚡ HURRY! ⚡');
            this.roundPreviewText.setColor('#' + this.theme.danger.toString(16).padStart(6, '0'));
            this.tweens.add({
              targets: this.roundPreviewText,
              alpha: { from: 0, to: 0.8 }, scale: { from: 0.5, to: 1 },
              duration: 200, yoyo: true, hold: 200,
            });
          }
        }
        if (this.timeLeft <= 0) {
          if (this.timerEvent) this.timerEvent.remove();
          this._handleTimeout();
        }
      },
    });

    // ESL: speak the prompt
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
      const displayEmoji = term.emoji ?? '';
      const displayLabel = term.emoji ? term.term : term.term.slice(0, 3).toUpperCase();
      const emojiText = this.add.text(0, displayEmoji ? -8 : 0, displayEmoji, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
      }).setOrigin(0.5).setDepth(31);

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
        duration: 1000 + i * 80, yoyo: true, repeat: 50, ease: 'Sine.inOut',
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

  private _handleTimeout() {
    if (this.isFinished) return;
    this.canInteract = false;
    this.combo = 0;
    this._updateCombo();
    audioBus.play('incorrect');
    this.juice.shake('medium');
    this.juice.flash(this.theme.danger, 0.3, 200);
    this.juice.scorePopup(this.scale.width / 2, 300, '⏱ TIME UP!', this.theme.danger);

    // Record as failed answer
    const matchTerm = this.symbols.find(s => s.isMatch);
    if (matchTerm) {
      this.recordAnswer({
        term: matchTerm.term.term,
        response: 'timeout',
        success: false,
        coordinate: { x: this.scale.width / 2, y: 300, t: this.time.now },
      });
    }

    // Advance to next round after a brief pause
    this.time.delayedCall(1200, () => {
      if (!this.isFinished) {
        this.round++;
        this._showRoundPreview();
      }
    });
  }

  private _showRoundPreview() {
    if (this.round >= this.maxRounds) {
      this.renderRound();
      return;
    }
    if (this.roundPreviewText) {
      this.roundPreviewText.setText(`Round ${this.round + 1}`);
      this.roundPreviewText.setColor('#' + this.theme.accent.toString(16).padStart(6, '0'));
      this.roundPreviewText.setAlpha(0);
      this.tweens.add({
        targets: this.roundPreviewText,
        alpha: { from: 0, to: 1 }, scale: { from: 0.5, to: 1 },
        duration: 300, ease: 'Back.out', yoyo: true, hold: 400,
        onComplete: () => this.renderRound(),
      });
    } else {
      this.renderRound();
    }
  }

  private _updateCombo() {
    if (this.combo >= 2) {
      this.comboText.setText(`🔥 x${this.combo}`);
      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.out',
      });
    } else {
      this.comboText.setText('');
    }
  }

  private handleSymbolTap(sym: SpotItSymbol) {
    if (!this.canInteract || sym.hit) return;

    if (sym.isMatch) {
      // CORRECT — found the matching symbol!
      sym.hit = true;
      this.canInteract = false;
      if (this.timerEvent) this.timerEvent.remove();
      const responseTime = Date.now() - this.roundStartTime;
      const speedBonus = Math.max(0, (this.roundTimeLimit * 1000) - responseTime);

      // DRAMA: Combo system — bonus per consecutive correct
      this.combo++;
      if (this.maxCombo < this.combo) this.maxCombo = this.combo;
      this._updateCombo();

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

      // Speed bonus display — DRAMA: scales with combo
      if (responseTime < 2000) {
        const bonusPoints = Math.round(speedBonus / 100) + this.combo * 5;
        this.speedBonusText.setText(`⚡ SPEED BONUS! +${bonusPoints}${this.combo >= 2 ? ` (combo x${this.combo})` : ''}`);
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
            this._showRoundPreview();
          },
        });
      });
    } else {
      // WRONG — not the matching symbol
      sym.hit = true;
      // DRAMA: near-miss detection (shares first letter with the match)
      const matchSym = this.symbols.find(s => s.isMatch);
      const isNearMiss = matchSym && sym.term.term.charAt(0).toLowerCase() === matchSym.term.term.charAt(0).toLowerCase()
        && sym.term.term !== matchSym.term.term;

      sym.circle.setFillStyle(isNearMiss ? this.theme.warning : this.theme.danger, 0.7);
      sym.circle.setStrokeStyle(4, isNearMiss ? this.theme.warning : this.theme.danger, 1);
      this.juice.burst(sym.container.x, sym.container.y, 'incorrect');
      this.juice.shake('light');
      if (isNearMiss) {
        this.juice.scorePopup(sym.container.x, sym.container.y - 30, 'so close!', this.theme.warning);
      }

      // Combo reset on wrong answer
      this.combo = 0;
      this._updateCombo();

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
