import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// BRIDGE BUILDER (Rocket Launch) — Text/Spelling Engine  (AAA 2029 edition)
// ============================================================================
// The high-engagement alternative to Hangman with:
//   • Rocket with animated flame trail
//   • Bridge struts that collapse with debris particles
//   • Correct letter: rocket nudges forward + flame burst
//   • Wrong letter: strut collapses + screen shake
//   • Word completion: rocket launches off-screen with confetti
//   • Bridge collapse: rocket falls with smoke trail
//   • Hint button (reveals a letter, costs streak)
//   • Letter keyboard with used-letter tracking
//   • ESL TTS on hint + word completion
// ============================================================================

export default class BridgeBuilderScene extends BaseEngine {
  private round = 0;
  private rounds: TermItem[] = [];
  private targetWord = '';
  private revealed: boolean[] = [];
  private wrongCount = 0;
  private maxWrong = 5;
  private letterButtons: Phaser.GameObjects.Container[] = [];
  private wordSlots: Phaser.GameObjects.Text[] = [];
  private rocket!: Phaser.GameObjects.Container;
  private rocketFlame!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bridgeStruts: Phaser.GameObjects.Rectangle[] = [];
  private canInteract = true;
  private hintText!: Phaser.GameObjects.Text;
  private hintBg!: Phaser.GameObjects.Rectangle;
  private rocketStartX = 0;
  private solvedRounds = 0;
  private hintUsed = false;
  private hintBtn!: Phaser.GameObjects.Container;
  private usedLetters = new Set<string>();

  protected maxQuestions() { return Math.min(this.terms.length, 5); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 95,
      '🚀 Bridge Builder',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.rounds = this.pickTerms(this.maxScore);

    // ---- Build bridge at bottom ----
    const bridgeY = this.scale.height - 50;
    const strutCount = this.maxWrong;
    const strutW = 80;
    const gap = 10;
    const totalW = strutCount * strutW + (strutCount - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + strutW / 2;

    for (let i = 0; i < strutCount; i++) {
      const strut = this.add.rectangle(
        startX + i * (strutW + gap), bridgeY,
        strutW, 18, this.theme.accent, 0.85
      ).setStrokeStyle(2, this.theme.accent2, 0.7).setDepth(20);
      this.bridgeStruts.push(strut);
    }

    // ---- Rocket (container with flame) ----
    this.rocketStartX = startX - strutW - 30;
    this.rocket = this.add.container(this.rocketStartX, bridgeY).setDepth(25);

    // Rocket body (triangle pointing right)
    const body = this.add.image(0, 0, 'player-' + this.theme.id).setDisplaySize(50, 50).setRotation(-Math.PI / 2);
    this.rocket.add(body);

    // Flame particle emitter (behind rocket)
    const flameKey = 'particle-' + this.theme.id;
    if (this.textures.exists(flameKey)) {
      this.rocketFlame = this.add.particles(0, 25, flameKey, {
        speed: { min: 20, max: 60 },
        angle: { min: 70, max: 110 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: { min: 200, max: 400 },
        tint: [this.theme.warning, this.theme.danger, 0xfde047],
        blendMode: 'ADD',
        quantity: 1,
        frequency: 40,
      }).setDepth(24);
      this.rocket.add(this.rocketFlame);
    }

    // ---- Hint text ----
    this.hintBg = this.add.rectangle(
      this.scale.width / 2, 145, 600, 36, this.theme.card, 0.7
    ).setStrokeStyle(1, this.theme.accent, 0.4).setDepth(48);
    this.hintText = this.add.text(this.scale.width / 2, 145, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: this.hex(this.theme.textMuted),
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5).setDepth(49);

    // ---- Hint button ----
    const hintBtnBg = this.add.rectangle(0, 0, 100, 34, this.theme.warning, 0.6)
      .setStrokeStyle(2, this.theme.warning, 0.8);
    const hintBtnTxt = this.add.text(0, 0, '💡 Hint', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hintBtn = this.add.container(this.scale.width - 70, 560, [hintBtnBg, hintBtnTxt])
      .setSize(100, 34).setInteractive({ useHandCursor: true }).setDepth(50);
    this.hintBtn.on('pointerover', () => hintBtnBg.setFillStyle(this.theme.warning, 0.9));
    this.hintBtn.on('pointerout', () => hintBtnBg.setFillStyle(this.theme.warning, 0.6));
    // NOTE: per-container pointerdown removed — global handler handles hint taps.

    this.renderRound();

    // Global pointer handler for reliable letter button clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canInteract) return;
      // Hit-test hint button
      if (this.hintBtn && !this.hintUsed) {
        if (Math.abs(x - this.hintBtn.x) < 50 && Math.abs(y - this.hintBtn.y) < 17) {
          this.useHint();
          return;
        }
      }
      // Hit-test letter buttons
      for (const btn of this.letterButtons) {
        const letter = btn.getData('letter') as string;
        if (this.usedLetters.has(letter)) continue;
        if (Math.abs(x - btn.x) < 21 && Math.abs(y - btn.y) < 21) {
          // ESL: speak the letter when tapped
          audioBus.speak(letter);
          this.guessLetter(letter, btn);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.solvedRounds >= this.maxScore * 0.5);
      return;
    }
    const term = this.rounds[this.round];
    this.targetWord = term.term.toUpperCase().replace(/[^A-Z]/g, '');
    this.revealed = new Array(this.targetWord.length).fill(false);
    this.wrongCount = 0;
    this.canInteract = true;
    this.hintUsed = false;
    this.usedLetters.clear();
    this.hintBtn.setAlpha(1).setInteractive({ useHandCursor: true });

    // Reset bridge struts
    this.bridgeStruts.forEach(s => {
      s.setFillStyle(this.theme.accent, 0.85);
      s.setScale(1, 1);
      s.setAlpha(1);
      s.setVisible(true);
    });

    // Reset rocket
    this.rocket.setPosition(this.rocketStartX, this.scale.height - 50);
    this.rocket.setAngle(0).setAlpha(1);

    // Render word slots
    this.wordSlots.forEach(s => s.destroy());
    this.wordSlots = [];
    const slotW = 40, gap = 6;
    const totalW = this.targetWord.length * slotW + (this.targetWord.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + slotW / 2;
    for (let i = 0; i < this.targetWord.length; i++) {
      const slot = this.add.text(startX + i * (slotW + gap), 220, '_', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '34px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(50);
      // Slot background
      this.add.rectangle(startX + i * (slotW + gap), 220, slotW - 4, 40, this.theme.card, 0.4)
        .setStrokeStyle(1, this.theme.accent, 0.3).setDepth(49);
      this.wordSlots.push(slot);
    }

    // Hint
    const hintText = term.definition ? `Hint: ${term.emoji ?? ''} ${term.definition}` : (term.emoji ? `Hint: ${term.emoji}` : '');
    this.hintText.setText(hintText);



    // Render letter keyboard
    this.letterButtons.forEach(b => b.destroy());
    this.letterButtons = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const kbRows = [alphabet.slice(0, 13), alphabet.slice(13)];
    const kbBtnSize = 42;
    const kbGap = 5;
    kbRows.forEach((row, ri) => {
      const totalRW = row.length * kbBtnSize + (row.length - 1) * kbGap;
      const startX2 = (this.scale.width - totalRW) / 2 + kbBtnSize / 2;
      const y = 320 + ri * (kbBtnSize + kbGap);
      for (let i = 0; i < row.length; i++) {
        const letter = row[i];
        const x = startX2 + i * (kbBtnSize + kbGap);
        const isUsed = this.usedLetters.has(letter);
        const bg = this.add.rectangle(0, 0, kbBtnSize, kbBtnSize, isUsed ? 0x444444 : this.theme.card, 0.9)
          .setStrokeStyle(2, isUsed ? 0x666666 : this.theme.accent, 0.6);
        const txt = this.add.text(0, 0, letter, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '18px',
          color: isUsed ? '#888888' : this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, txt]).setSize(kbBtnSize, kbBtnSize).setInteractive({ useHandCursor: true });
        container.setData('letter', letter);
        container.setData('bg', bg);
        if (!isUsed) {
          container.on('pointerover', () => {
            bg.setFillStyle(this.theme.cardAlt, 1);
            audioBus.play('hover');
          });
          container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.9));
          // NOTE: per-container pointerdown removed — global handler handles letter taps.
        }
        this.letterButtons.push(container);
      }
    });
  }

  private useHint() {
    if (this.hintUsed || !this.canInteract) return;
    this.hintUsed = true;
    this.hintBtn.setAlpha(0.3).disableInteractive();
    this.streak = 0;

    // Find an unrevealed letter
    for (let i = 0; i < this.targetWord.length; i++) {
      if (!this.revealed[i]) {
        const letter = this.targetWord[i];
        audioBus.speak(`The letter is ${letter}`);
        this.guessLetter(letter, this.letterButtons.find(b => b.getData('letter') === letter)!);
        return;
      }
    }
  }

  private guessLetter(letter: string, btn: Phaser.GameObjects.Container) {
    if (!this.canInteract) return;
    if (this.usedLetters.has(letter)) return;
    this.usedLetters.add(letter);

    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
    btn.disableInteractive();
    const inWord = this.targetWord.includes(letter);

    let revealedAny = false;
    for (let i = 0; i < this.targetWord.length; i++) {
      if (this.targetWord[i] === letter && !this.revealed[i]) {
        this.revealed[i] = true;
        this.wordSlots[i].setText(letter);
        this.wordSlots[i].setColor(this.hex(this.theme.success));
        this.juice.squash(this.wordSlots[i], 1.3);
        // Letter reveal particle
        this.juice.burst(this.wordSlots[i].x, this.wordSlots[i].y, 'correct');
        revealedAny = true;
      }
    }

    // Record telemetry
    this.recordAnswer({
      term: this.rounds[this.round].term,
      response: letter,
      success: revealedAny,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (inWord) {
      audioBus.play('launch');
      bg.setFillStyle(this.theme.success, 0.7);
      this.juice.burst(btn.x, btn.y, 'correct');
      // Nudge rocket forward by ONE step
      const totalDistance = this.scale.width - this.rocketStartX - 100;
      const strutStep = totalDistance / this.targetWord.length;
      this.tweens.add({
        targets: this.rocket,
        x: this.rocket.x + strutStep,
        duration: 300, ease: 'Quad.out',
      });
      this.checkWinRound();
    } else {
      audioBus.play('incorrect');
      bg.setFillStyle(this.theme.danger, 0.7);
      this.juice.shake('medium');
      // Collapse one strut with debris
      const strutIdx = this.maxWrong - 1 - this.wrongCount;
      if (strutIdx >= 0 && strutIdx < this.bridgeStruts.length) {
        const strut = this.bridgeStruts[strutIdx];
        // Debris particles
        this.juice.burst(strut.x, strut.y, 'incorrect');
        this.tweens.add({
          targets: strut,
          scaleY: 0, alpha: 0, angle: 45,
          duration: 400, ease: 'Back.in',
          onComplete: () => strut.setVisible(false),
        });
      }
      this.wrongCount++;
      if (this.wrongCount >= this.maxWrong) {
        this.canInteract = false;
        // Rocket falls with smoke
        this.rocketFlame?.stop();
        const smokeKey = 'particle-' + this.theme.id;
        if (this.textures.exists(smokeKey)) {
          this.add.particles(this.rocket.x, this.rocket.y, smokeKey, {
            speed: { min: 20, max: 50 },
            scale: { start: 2, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 800,
            tint: 0x666666,
            quantity: 2,
            frequency: 50,
            duration: 800,
          });
        }
        this.tweens.add({
          targets: this.rocket,
          y: this.scale.height + 80, angle: 180,
          duration: 1000, ease: 'Cubic.in',
          onComplete: () => {
            this.time.delayedCall(500, () => {
              this.round++;
              this.renderRound();
            });
          },
        });
      }
    }
  }

  private checkWinRound() {
    if (this.revealed.every(Boolean)) {
      this.canInteract = false;
      this.solvedRounds++;
  
      this.juice.burst(this.scale.width / 2, 200, 'win');
      this.hud.celebrate();
      // Rocket launches off-screen with confetti
      this.juice.confettiRain(1500);
      this.tweens.add({
        targets: this.rocket,
        x: this.scale.width + 80, y: 100,
        duration: 800, ease: 'Cubic.out',
        onComplete: () => {
          this.time.delayedCall(400, () => {
            this.round++;
            this.renderRound();
          });
        },
      });
      this.checkWin();
    }
  }
}
