import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPIN WHEEL — AAAA Kid-Juice Edition
// ============================================================================
// A colorful wheel of terms. Player spins, wheel lands on a term,
// that term becomes the "answer" — player must select matching definition.
//
// AAAA FEATURES:
//   • Initial prompt read aloud with karaoke highlight on entry
//   • Hover-to-speak on ALL text (prompt + answer options)
//   • Karaoke highlight on landed term + answer options
//   • Smooth wheel rotation with ease-out deceleration
//   • Tick sound as wheel passes each segment
//   • Winner segment glows + pulses
//   • Direct interactivity on answer buttons (not global hit-test)
// ============================================================================

interface AnswerOption {
  term: TermItem;
  isCorrect: boolean;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
}

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
  private answerOptions: AnswerOption[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;
  private canSelect = false;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Prompt (title + instruction, spoken on entry) ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 80, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(
      this.scale.width / 2, 80,
      '🎡 Spin the Wheel!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 600 },
      }
    ).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText, 'Spin the Wheel! Tap the green button to spin!');

    // AAAA: Speak the initial prompt on entry.
    this.time.delayedCall(800, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, 'Spin the Wheel! Tap the green button to spin!');
    });

    // ---- Wheel (center-top) ----
    const wheelX = this.scale.width / 2;
    const wheelY = 250;
    const wheelRadius = 170;

    this.wheel = this.add.container(wheelX, wheelY).setDepth(30);

    // Pick terms for the wheel (up to 8 segments)
    this.segmentTerms = this.pickTerms(Math.min(8, this.terms.length));

    const segmentAngle = 360 / this.segmentTerms.length;
    const segmentColors = [
      this.theme.accent, this.theme.accent2, this.theme.success, this.theme.warning,
      this.theme.card, this.theme.cardAlt, this.theme.danger, 0xa78bfa,
    ];

    this.segmentTerms.forEach((term, i) => {
      const startAngle = i * segmentAngle - 90 - segmentAngle / 2;
      const endAngle = startAngle + segmentAngle;

      const seg = this.add.graphics();
      seg.fillStyle(segmentColors[i % segmentColors.length], 0.9);
      seg.beginPath();
      seg.moveTo(0, 0);
      seg.slice(0, 0, wheelRadius, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
      seg.closePath();
      seg.fillPath();
      seg.lineStyle(2, 0xffffff, 0.6);
      seg.strokePath();
      this.wheel.add(seg);
      this.wheelSegments.push(seg);

      const midAngle = Phaser.Math.DegToRad(startAngle + segmentAngle / 2);
      const textRadius = wheelRadius * 0.65;
      const tx = Math.cos(midAngle) * textRadius;
      const ty = Math.sin(midAngle) * textRadius;
      const txt = this.add.text(tx, ty, term.emoji ?? term.term.slice(0, 4), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setRotation(midAngle + Math.PI / 2);
      this.wheel.add(txt);
    });

    // Wheel center hub
    const hub = this.add.circle(0, 0, 22, this.theme.warning, 1).setStrokeStyle(4, 0xffffff, 0.9);
    this.wheel.add(hub);
    const jewel = this.add.circle(0, 0, 8, 0xffffff, 0.9);
    this.wheel.add(jewel);

    // Decorative lights around the wheel rim
    const lightCount = 16;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2 - Math.PI / 2;
      const lx = Math.cos(angle) * (wheelRadius + 8);
      const ly = Math.sin(angle) * (wheelRadius + 8);
      const lightColor = i % 2 === 0 ? this.theme.warning : 0xffffff;
      const light = this.add.circle(lx, ly, 4, lightColor, 1).setDepth(35);
      this.wheel.add(light);
      this.tweens.add({
        targets: light,
        alpha: { from: 1, to: 0.3 },
        duration: 400 + i * 30,
        yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });
    }

    // Outer ring
    const ring = this.add.circle(0, 0, wheelRadius + 4, 0x000000, 0)
      .setStrokeStyle(6, this.theme.warning, 0.8).setDepth(34);
    this.wheel.add(ring);

    // Pointer (at top, pointing down)
    this.pointer = this.add.text(wheelX, wheelY - wheelRadius - 15, '▼', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '44px',
      color: this.hex(this.theme.danger),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: this.pointer,
      y: wheelY - wheelRadius - 5,
      duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // ---- Spin button (DIRECT interactivity, not global hit-test) ----
    const btnY = wheelY + wheelRadius + 55;
    const spinBtnBg = this.add.rectangle(0, 0, 220, 56, this.theme.success, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.8);
    const spinBtnTxt = this.add.text(0, 0, '🎲 SPIN!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.spinBtn = this.add.container(wheelX, btnY, [spinBtnBg, spinBtnTxt])
      .setSize(220, 56).setDepth(40);
    this.spinBtnX = wheelX;
    this.spinBtnY = btnY;

    // DIRECT interactivity on spin button — reliable on mobile + desktop.
    spinBtnBg.setInteractive({ useHandCursor: true });
    spinBtnBg.on('pointerdown', () => { this.spin(); });
    spinBtnTxt.setInteractive({ useHandCursor: true });
    spinBtnTxt.on('pointerdown', () => { this.spin(); });

    // Pulsing glow on spin button.
    this.tweens.add({
      targets: spinBtnBg,
      scale: { from: 1, to: 1.08 },
      duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private spin() {
    if (this.isSpinning || this.landedTerm) return;
    this.isSpinning = true;
    this.canSelect = false;
    audioBus.play('tap');

    // Clear previous options
    this.answerOptions.forEach(o => { try { o.container.destroy(); } catch {} });
    this.answerOptions = [];

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

    // Spin animation
    this.tweens.add({
      targets: this.wheel,
      angle: targetAngle,
      duration: 3000 + Math.random() * 1000,
      ease: 'Cubic.out',
      onComplete: () => { this.onWheelStopped(); },
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

    // Highlight the winning segment
    const winSeg = this.wheelSegments[landedIdx];
    this.tweens.add({
      targets: winSeg,
      alpha: { from: 1, to: 0.5 },
      duration: 300, yoyo: true, repeat: 3, ease: 'Sine.inOut',
    });

    // Update prompt + speak the landed term with karaoke highlight.
    this.promptText.setText(`Match: ${this.landedTerm.emoji ?? ''} ${this.landedTerm.term}`);
    this.promptText.setData('speakText', this.landedTerm.term);
    this.speakPromptWithHighlight(this.promptText, this.landedTerm.term, { pitch: 1.15 });

    // Show definition options after a brief pause.
    this.time.delayedCall(800, () => {
      if (!this.isFinished) this.showDefinitionOptions();
    });
  }

  private showDefinitionOptions() {
    if (!this.landedTerm) return;

    // 3 options: 1 correct, 2 decoys
    const decoys = this.terms.filter(t => t.id !== this.landedTerm!.id && t.definition);
    Phaser.Utils.Array.Shuffle(decoys);
    const optionTerms = [
      this.landedTerm,
      decoys[0] ?? this.landedTerm,
      decoys[1] ?? this.landedTerm,
    ];
    Phaser.Utils.Array.Shuffle(optionTerms);

    const btnW = Math.min(400, this.scale.width - 40);
    const btnH = 50;
    const gap = 10;
    const startY = 460;

    optionTerms.forEach((term, i) => {
      const y = startY + i * (btnH + gap);
      const isCorrect = term.id === this.landedTerm!.id;

      const bg = this.add.rectangle(this.scale.width / 2, y, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7)
        .setDepth(45)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(this.scale.width / 2, y, term.definition ?? term.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5).setDepth(46);

      // AAAA: Make option text hover-to-speakable with karaoke highlight.
      this.makeHoverSpeakable(txt, term.definition ?? term.term);

      // DIRECT interactivity on the button background — reliable tap.
      bg.on('pointerdown', () => {
        if (!this.canSelect || this._isPaused || this.isFinished) return;
        this.canSelect = false;
        this.speakPromptWithHighlight(txt, term.definition ?? term.term);
        this.selectOption(isCorrect, term, bg, txt);
      });

      // Hover glow.
      bg.on('pointerover', () => {
        if (this.canSelect) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          bg.setStrokeStyle(4, this.theme.accent, 1);
        }
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(this.theme.card, 0.95);
        bg.setStrokeStyle(3, this.theme.accent, 0.7);
      });

      // Entrance animation.
      bg.setAlpha(0).setScale(0.8);
      this.tweens.add({
        targets: [bg, txt],
        alpha: 1, scale: 1,
        duration: 250, delay: i * 80, ease: 'Back.out',
      });

      this.answerOptions.push({
        term, isCorrect,
        container: this.add.container(0, 0), // dummy container for tracking
        bg, txt,
      });
    });

    // Enable selection after entrance animation.
    this.time.delayedCall(400 + optionTerms.length * 80, () => {
      this.canSelect = true;
    });

    // Speak each option in sequence after they appear.
    this.time.delayedCall(600, () => {
      if (!this.isFinished) {
        const firstOpt = this.answerOptions[0];
        if (firstOpt) {
          this.speakPromptWithHighlight(firstOpt.txt, firstOpt.term.definition ?? firstOpt.term.term);
        }
      }
    });
  }

  private selectOption(isCorrect: boolean, term: TermItem, bg: Phaser.GameObjects.Rectangle, txt: Phaser.GameObjects.Text) {
    this.recordAnswer({
      term: this.landedTerm!.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: bg.x, y: bg.y, t: this.time.now },
    });

    // Highlight correct/wrong.
    bg.setFillStyle(isCorrect ? this.theme.success : this.theme.danger, 1);
    bg.setStrokeStyle(5, isCorrect ? this.theme.success : this.theme.danger, 1);

    // Feedback.
    const feedbackMsg = isCorrect ? '✅ Correct!' : '❌ Try again!';
    const feedbackColor = isCorrect ? this.theme.success : this.theme.danger;
    this.juice.scorePopup(this.scale.width / 2, 420, feedbackMsg, feedbackColor);
    this.juice.flash(feedbackColor, 0.3, 250);

    if (isCorrect) {
      audioBus.play('correct');
      this.juice.burst(bg.x, bg.y, 'correct');
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
    }

    // Disable all buttons.
    this.answerOptions.forEach(o => {
      try { o.bg.disableInteractive(); } catch {}
    });

    if (isCorrect) {
      this.checkWin();
      // Reset for next spin.
      this.time.delayedCall(1500, () => {
        try {
          this.promptText.setText('🎡 Spin the Wheel!');
          this.promptText.setData('speakText', 'Spin the Wheel! Tap the green button to spin!');
          this.answerOptions.forEach(o => { try { o.bg.destroy(); o.txt.destroy(); } catch {} });
          this.answerOptions = [];
          this.landedTerm = undefined;
          this.canSelect = false;
        } catch {}
      });
    } else {
      // Re-enable other buttons after 1.2s.
      this.time.delayedCall(1200, () => {
        this.answerOptions.forEach(o => {
          if (o.bg !== bg) {
            try { o.bg.setInteractive({ useHandCursor: true }); } catch {}
          }
        });
        this.canSelect = true;
      });
    }
  }
}
