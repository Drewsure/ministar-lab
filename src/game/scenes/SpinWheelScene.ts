import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPIN THE WHEEL — Vocabulary matching game
// ============================================================================
// MECHANIC:
//   1. Spin the wheel → it lands on a vocabulary word
//   2. 3 definition options appear below the wheel
//   3. Tap the correct definition for the landed word
//   4. Correct = +1 score, wrong = try again
//   5. Repeat until all questions answered
//
// All buttons use DIRECT setInteractive (not global hit-test) for reliability.
// ============================================================================

export default class SpinWheelScene extends BaseEngine {
  private wheel!: Phaser.GameObjects.Container;
  private wheelSegments: Phaser.GameObjects.Graphics[] = [];
  private segmentTerms: TermItem[] = [];
  private pointer!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spinBtn!: Phaser.GameObjects.Container;
  private spinBtnX = 0;
  private spinBtnY = 0;
  private answerButtons: Phaser.GameObjects.Container[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 40, '🎡 Spin the Wheel', {
      fontFamily: 'Inter, sans-serif', fontSize: '26px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 75, 600, 36, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 75, 'Tap SPIN to start!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // ---- Wheel ----
    const wheelX = this.scale.width / 2;
    const wheelY = 230;
    const wheelRadius = 160;

    this.wheel = this.add.container(wheelX, wheelY).setDepth(30);

    // Pick terms for the wheel (up to 8 segments)
    const wheelTerms = this.pickTerms(Math.min(8, this.terms.length));
    this.segmentTerms = wheelTerms;

    const segmentAngle = 360 / wheelTerms.length;
    const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfbbf24, 0xa855f7, 0xec4899, 0x06b6d4, 0xf97316];

    wheelTerms.forEach((term, i) => {
      const startAngle = i * segmentAngle - 90 - segmentAngle / 2;
      const endAngle = startAngle + segmentAngle;
      const seg = this.add.graphics();
      seg.fillStyle(colors[i % colors.length], 0.85);
      seg.beginPath();
      seg.moveTo(0, 0);
      seg.slice(0, 0, wheelRadius, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
      seg.closePath();
      seg.fillPath();
      seg.lineStyle(2, 0xffffff, 0.5);
      seg.strokePath();
      this.wheel.add(seg);
      this.wheelSegments.push(seg);

      // Term text on segment
      const midAngle = Phaser.Math.DegToRad(startAngle + segmentAngle / 2);
      const textRadius = wheelRadius * 0.65;
      const tx = Math.cos(midAngle) * textRadius;
      const ty = Math.sin(midAngle) * textRadius;
      const txt = this.add.text(tx, ty, term.emoji ?? term.term.slice(0, 4), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setRotation(midAngle + Math.PI / 2);
      this.wheel.add(txt);
    });

    // Wheel border ring
    const ring = this.add.circle(0, 0, wheelRadius + 4, 0x000000, 0)
      .setStrokeStyle(4, 0xffffff, 0.8);
    this.wheel.add(ring);

    // Center hub
    const hub = this.add.circle(0, 0, 20, this.theme.warning, 1)
      .setStrokeStyle(2, 0xffffff, 0.8);
    this.wheel.add(hub);

    // Pointer (triangle at top pointing down)
    this.pointer = this.add.text(wheelX, wheelY - wheelRadius - 10, '▼', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px',
      color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setDepth(35);

    // ---- Spin button — DIRECT setInteractive (not global hit-test) ----
    const btnY = wheelY + wheelRadius + 50;
    this.spinBtnX = wheelX;
    this.spinBtnY = btnY;

    const spinBtnBg = this.add.rectangle(0, 0, 220, 56, this.theme.success, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.8);
    const spinBtnTxt = this.add.text(0, 0, '🎲 SPIN!', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.spinBtn = this.add.container(wheelX, btnY, [spinBtnBg, spinBtnTxt])
      .setSize(220, 56).setDepth(40);

    // DIRECT INTERACTIVITY — make the background rectangle interactive
    spinBtnBg.setInteractive({ useHandCursor: true });
    spinBtnBg.on('pointerdown', () => {
      if (!this.isSpinning && !this.landedTerm) {
        this.spin();
      }
    });

    // Spoken instructions
    this.time.delayedCall(600, () => {
      if (!this.isFinished) audioBus.speak('Spin the wheel! Then tap the correct definition!');
    });
  }

  protected onTick(_remainingMs: number) {}

  private spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    audioBus.play('tap');

    // Clear previous answer buttons
    this.answerButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.answerButtons = [];

    // Random spin
    const rotations = 5 + Math.random() * 3;
    const offset = Math.random() * 360;
    const targetAngle = rotations * 360 + offset;

    // Tick sounds
    const tickCount = Math.floor(rotations * this.segmentTerms.length);
    for (let i = 0; i < tickCount; i++) {
      this.time.delayedCall(i * 80, () => {
        if (this.isSpinning) audioBus.play('hover', { freq: 600 + (i % 4) * 100 });
      });
    }

    this.tweens.add({
      targets: this.wheel,
      angle: targetAngle,
      duration: 3000 + Math.random() * 1000,
      ease: 'Cubic.out',
      onComplete: () => this.onWheelStopped(),
    });
  }

  private onWheelStopped() {
    this.isSpinning = false;
    const segmentAngle = 360 / this.segmentTerms.length;
    const currentAngle = ((this.wheel.angle % 360) + 360) % 360;
    const pointerAngle = (360 - currentAngle) % 360;
    const landedIdx = Math.floor(pointerAngle / segmentAngle) % this.segmentTerms.length;
    this.landedTerm = this.segmentTerms[landedIdx];

    if (!this.landedTerm) return;

    // Speak the landed term
    audioBus.speak(this.landedTerm.term);

    // Show definition options
    this.showDefinitionOptions();
  }

  private showDefinitionOptions() {
    if (!this.landedTerm) return;
    this.promptText.setText(`Match: ${this.landedTerm.emoji ?? ''} ${this.landedTerm.term}`);

    // 3 options: 1 correct, 2 decoys
    const decoys = this.terms.filter(t => t.id !== this.landedTerm!.id);
    Phaser.Utils.Array.Shuffle(decoys);
    const options = [
      { term: this.landedTerm, isCorrect: true },
      { term: decoys[0] ?? this.landedTerm, isCorrect: false },
      { term: decoys[1] ?? this.landedTerm, isCorrect: false },
    ];
    Phaser.Utils.Array.Shuffle(options);

    // Position buttons BELOW the spin button, stacked vertically
    const btnW = Math.min(400, this.scale.width - 40);
    const btnH = 52;
    const gap = 8;
    const startY = this.spinBtnY + 80; // first button Y

    options.forEach((opt, i) => {
      const y = startY + i * (btnH + gap);

      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7);
      const txt = this.add.text(0, 0, opt.term.definition ?? opt.term.term, {
        fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5);

      const container = this.add.container(this.scale.width / 2, y, [bg, txt])
        .setSize(btnW, btnH).setDepth(45);

      // DIRECT INTERACTIVITY — each button is independently interactive
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.selectOption(opt.isCorrect, opt.term, container);
      });

      // Also make text interactive (fallback)
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        this.selectOption(opt.isCorrect, opt.term, container);
      });

      this.answerButtons.push(container);
    });

    // Speak all 3 options for ESL
    this.time.delayedCall(500, () => {
      if (this.isFinished) return;
      options.forEach((opt, i) => {
        this.time.delayedCall(i * 1500, () => {
          if (!this.isFinished) audioBus.speak(opt.term.definition ?? opt.term.term);
        });
      });
    });
  }

  private selectOption(isCorrect: boolean, term: TermItem, btn: Phaser.GameObjects.Container) {
    // Prevent double-tap
    if (this.answerButtons.length === 0) return;

    this.recordAnswer({
      term: this.landedTerm!.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    // Highlight
    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(isCorrect ? this.theme.success : this.theme.danger, 1);

    // Feedback
    const feedbackMsg = isCorrect ? '✅ Correct!' : '❌ Try again!';
    const feedbackColor = isCorrect ? this.theme.success : this.theme.danger;
    this.juice.scorePopup(this.scale.width / 2, this.spinBtnY, feedbackMsg, feedbackColor);
    this.juice.flash(feedbackColor, 0.3, 250);
    if (isCorrect) {
      audioBus.play('correct');
      audioBus.speak(`Correct! ${this.landedTerm!.term}`);
      this.juice.burst(btn.x, btn.y, 'correct');
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
    }

    // Disable all buttons (prevent further taps)
    this.answerButtons.forEach(b => {
      const bbg = b.getAt(0) as Phaser.GameObjects.Rectangle;
      const btxt = b.getAt(1) as Phaser.GameObjects.Text;
      try { bbg.disableInteractive(); } catch {}
      try { btxt.disableInteractive(); } catch {}
    });

    // Close answers + reset for next spin
    setTimeout(() => {
      try {
        this.promptText.setText('Tap SPIN for next word!');
        this.answerButtons.forEach(b => { try { b.destroy(); } catch {} });
        this.answerButtons = [];
        this.landedTerm = undefined;
      } catch {}
    }, 1500);

    if (isCorrect) {
      this.checkWin();
    }
  }
}
