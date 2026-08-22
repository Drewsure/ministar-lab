import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPIN WHEEL — Systematic AAAA Edition
// ============================================================================
// Gameplay flow:
//   1. Player taps SPIN button
//   2. Wheel spins with ease-out + tick sounds
//   3. Wheel stops → pointer indicates landed segment (CORRECT detection)
//   4. Landed term announced (spoken + shown in prompt)
//   5. 3 definition options appear below the wheel
//   6. Player taps the matching definition
//   7. Correct → celebration + next spin. Wrong → "Try again!" + re-enable.
//
// AAAA FEATURES:
//   • Correct segment detection (segment 0 at top, proper angle math)
//   • Direct interactivity on answer buttons (NO nested container, NO global hit-test)
//   • Hover-to-speak with karaoke highlight on ALL text
//   • Verbal verification on correct/wrong
// ============================================================================

interface AnswerOption {
  term: TermItem;
  isCorrect: boolean;
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
  private spinBtnBg!: Phaser.GameObjects.Rectangle;
  private spinBtnTxt!: Phaser.GameObjects.Text;
  private answerOptions: AnswerOption[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;
  private canSelect = false;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- Prompt ----
    this.promptBg = this.add.rectangle(W / 2, 50, Math.min(640, W - 60), 36, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(W / 2, 50, '🎡 Spin the Wheel!', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText, 'Spin the Wheel! Tap the green button to spin!');

    this.time.delayedCall(800, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, 'Spin the Wheel! Tap the green button to spin!');
    });

    // ---- Wheel ----
    // Centered horizontally. Vertically: leave space for prompt (top) +
    // spin button + answer options below. Wheel radius scales with canvas
    // so it's visible on big monitors but not huge on small ones.
    const wheelX = W / 2;
    const wheelRadius = Math.max(100, Math.min(160, Math.min(W, H) * 0.16));
    // Wheel sits in the upper-middle area — leaves room below for spin button + answers
    const wheelY = Math.max(wheelRadius + 50, H * 0.30);

    this.wheel = this.add.container(wheelX, wheelY).setDepth(30);
    this.segmentTerms = this.pickTerms(Math.min(8, this.terms.length));

    const segmentAngle = 360 / this.segmentTerms.length;
    const segmentColors = [
      this.theme.accent, this.theme.accent2, this.theme.success, this.theme.warning,
      this.theme.card, this.theme.cardAlt, this.theme.danger, 0xa78bfa,
    ];

    // AAAA: Segments drawn with segment 0 CENTERED at TOP (pointer position).
    // Segment i center = i * segmentAngle degrees clockwise from top.
    // In Phaser, 0° = right (3 o'clock). Top = -90°.
    // So segment center in Phaser angle = (i * segmentAngle) - 90.
    this.segmentTerms.forEach((term, i) => {
      const phaserCenter = (i * segmentAngle) - 90;
      const startAngle = phaserCenter - segmentAngle / 2;
      const endAngle = phaserCenter + segmentAngle / 2;

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

      const midAngleRad = Phaser.Math.DegToRad(phaserCenter);
      const textRadius = wheelRadius * 0.6;
      const tx = Math.cos(midAngleRad) * textRadius;
      const ty = Math.sin(midAngleRad) * textRadius;
      // Font scales with wheel radius — keeps emoji/term readable on big monitors
      const segFontSize = Math.max(18, Math.floor(wheelRadius * 0.20)) + 'px';
      const txt = this.add.text(tx, ty, term.emoji ?? term.term.slice(0, 4), {
        fontFamily: 'Inter, sans-serif', fontSize: segFontSize,
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setRotation(midAngleRad + Math.PI / 2);
      this.wheel.add(txt);
    });

    // Hub — scales with wheel
    const hubRadius = Math.max(14, wheelRadius * 0.13);
    const hub = this.add.circle(0, 0, hubRadius, this.theme.warning, 1).setStrokeStyle(3, 0xffffff, 0.9);
    this.wheel.add(hub);
    const jewel = this.add.circle(0, 0, hubRadius * 0.35, 0xffffff, 0.9);
    this.wheel.add(jewel);

    // Lights — scale with wheel radius, count stays the same
    const lightCount = 12;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2 - Math.PI / 2;
      const lx = Math.cos(angle) * (wheelRadius + 6);
      const ly = Math.sin(angle) * (wheelRadius + 6);
      const light = this.add.circle(lx, ly, 3, i % 2 === 0 ? this.theme.warning : 0xffffff, 1).setDepth(35);
      this.wheel.add(light);
      this.tweens.add({ targets: light, alpha: { from: 1, to: 0.3 }, duration: 400 + i * 30, yoyo: true, repeat: 999, ease: 'Sine.inOut' });
    }

    // Ring
    const ring = this.add.circle(0, 0, wheelRadius + 3, 0x000000, 0).setStrokeStyle(4, this.theme.warning, 0.8).setDepth(34);
    this.wheel.add(ring);

    // Pointer at top — scales with wheel radius
    this.pointer = this.add.text(wheelX, wheelY - wheelRadius - 12, '🔻', {
      fontFamily: 'Inter, sans-serif', fontSize: '32px',
    }).setOrigin(0.5, 0).setDepth(40);
    this.tweens.add({ targets: this.pointer, y: wheelY - wheelRadius - 5, duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut' });

    // ---- Spin button (DIRECT interactivity) ----
    // Sits below the wheel with a gap. Width scales with canvas.
    const btnY = wheelY + wheelRadius + 50;
    const btnW = Math.min(220, W * 0.30);
    this.spinBtnBg = this.add.rectangle(wheelX, btnY, btnW, 48, this.theme.success, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.8).setDepth(40).setInteractive({ useHandCursor: true });
    this.spinBtnTxt = this.add.text(wheelX, btnY, '🎲 SPIN!', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });

    const doSpin = () => {
      if (this._isPaused || this.isFinished || this.isSpinning || this.landedTerm) return;
      this.spin();
    };
    this.spinBtnBg.on('pointerdown', doSpin);
    this.spinBtnTxt.on('pointerdown', doSpin);
    this.tweens.add({ targets: this.spinBtnBg, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut' });
  }

  protected onTick(_remainingMs: number) {}

  private spin() {
    this.isSpinning = true;
    this.canSelect = false;
    audioBus.play('tap');
    this.answerOptions.forEach(o => { try { o.bg.destroy(); o.txt.destroy(); } catch {} });
    this.answerOptions = [];

    const rotations = 5 + Math.random() * 3;
    const offset = Math.random() * 360;
    const targetAngle = rotations * 360 + offset;

    const tickCount = Math.floor(rotations * this.segmentTerms.length);
    for (let i = 0; i < tickCount; i++) {
      this.time.delayedCall(i * 80, () => { if (this.isSpinning) audioBus.play('hover', { freq: 600 + (i % 4) * 100 }); });
    }

    this.tweens.add({
      targets: this.wheel, angle: targetAngle,
      duration: 3000 + Math.random() * 1000, ease: 'Cubic.out',
      onComplete: () => { this.onWheelStopped(); },
    });
  }

  private onWheelStopped() {
    this.isSpinning = false;

    // AAAA: CORRECT segment detection.
    // Segments drawn with segment 0 centered at TOP.
    // After rotation by wheel.angle, the segment at the top is:
    //   topAngle = (360 - rotation) % 360  (in segment-local degrees from top)
    //   landedIdx = floor((topAngle + halfSegment) / segmentAngle) % count
    const segmentAngle = 360 / this.segmentTerms.length;
    const rotation = ((this.wheel.angle % 360) + 360) % 360;
    const topAngle = (360 - rotation) % 360;
    const landedIdx = Math.floor((topAngle + segmentAngle / 2) / segmentAngle) % this.segmentTerms.length;
    this.landedTerm = this.segmentTerms[landedIdx];

    if (!this.landedTerm) return;

    // Highlight winning segment
    const winSeg = this.wheelSegments[landedIdx];
    this.tweens.add({ targets: winSeg, alpha: { from: 1, to: 0.5 }, duration: 300, yoyo: true, repeat: 3, ease: 'Sine.inOut' });

    // Update prompt + speak
    this.promptText.setText(`Match: ${this.landedTerm.emoji ?? ''} ${this.landedTerm.term}`);
    this.promptText.setData('speakText', this.landedTerm.term);
    this.speakPromptWithHighlight(this.promptText, this.landedTerm.term, { pitch: 1.15 });

    this.time.delayedCall(1000, () => { if (!this.isFinished) this.showDefinitionOptions(); });
  }

  private showDefinitionOptions() {
    if (!this.landedTerm) return;

    const decoys = this.terms.filter(t => t.id !== this.landedTerm!.id && t.definition);
    Phaser.Utils.Array.Shuffle(decoys);
    const optionTerms = [this.landedTerm, decoys[0] ?? this.landedTerm, decoys[1] ?? this.landedTerm];
    Phaser.Utils.Array.Shuffle(optionTerms);

    const btnW = Math.min(420, this.scale.width - 40);
    const btnH = 50;
    const gap = 10;
    // AAAA: Buttons positioned BELOW the spin button, scaled to canvas height.
    // Was hardcoded startY=430 (broke on tall canvases — answers sat in the middle
    // of empty space). Now: start at 60% of canvas height, fall back to 430
    // on short canvases (≤720px tall).
    const startY = Math.max(430, this.scale.height * 0.60);

    optionTerms.forEach((term, i) => {
      const y = startY + i * (btnH + gap);
      const isCorrect = term.id === this.landedTerm!.id;

      const bg = this.add.rectangle(this.scale.width / 2, y, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7).setDepth(45)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(this.scale.width / 2, y, term.definition ?? term.term, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5).setDepth(46);

      // AAAA: Hover-to-speak with karaoke highlight on the TEXT.
      txt.setData('speakText', term.definition ?? term.term);
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => {
        if (this._isPaused || this.isFinished || !this.canSelect) return;
        this.speakPromptWithHighlight(txt, term.definition ?? term.term);
      });

      // AAAA: Both bg and txt have pointerdown — either triggers selection.
      const onSelect = () => {
        if (this._isPaused || this.isFinished || !this.canSelect) return;
        this.canSelect = false;
        this.speakPromptWithHighlight(txt, term.definition ?? term.term);
        this.selectOption(isCorrect, term, bg, txt);
      };
      txt.on('pointerdown', onSelect);
      bg.on('pointerdown', onSelect);

      // Hover glow on bg.
      bg.on('pointerover', () => {
        if (this.canSelect) { bg.setFillStyle(this.theme.cardAlt, 1); bg.setStrokeStyle(4, this.theme.accent, 1); }
      });
      bg.on('pointerout', () => { bg.setFillStyle(this.theme.card, 0.95); bg.setStrokeStyle(3, this.theme.accent, 0.7); });

      // Entrance animation.
      bg.setAlpha(0).setScale(0.8);
      this.tweens.add({ targets: [bg, txt], alpha: 1, scale: 1, duration: 250, delay: i * 80, ease: 'Back.out' });

      this.answerOptions.push({ term, isCorrect, bg, txt });
    });

    // Enable selection after entrance.
    this.time.delayedCall(400 + optionTerms.length * 80, () => { this.canSelect = true; });
  }

  private selectOption(isCorrect: boolean, term: TermItem, bg: Phaser.GameObjects.Rectangle, txt: Phaser.GameObjects.Text) {
    this.recordAnswer({
      term: this.landedTerm!.term, response: term.term, success: isCorrect,
      coordinate: { x: bg.x, y: bg.y, t: this.time.now },
    });

    bg.setFillStyle(isCorrect ? this.theme.success : this.theme.danger, 1);
    bg.setStrokeStyle(5, isCorrect ? this.theme.success : this.theme.danger, 1);

    if (isCorrect) {
      audioBus.play('correct');
      this.juice.scorePopup(this.scale.width / 2, 400, '✅ Correct!', this.theme.success);
      this.juice.burst(bg.x, bg.y, 'correct');
      this.time.delayedCall(300, () => { audioBus.speak(`Correct! ${this.landedTerm?.term ?? ''}!`, { pitch: 1.2 }); });
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
      this.juice.scorePopup(this.scale.width / 2, 400, '❌ Try again!', this.theme.danger);
      this.time.delayedCall(300, () => { audioBus.speak('Try again!', { rate: 0.92 }); });
    }

    // Disable all buttons.
    this.answerOptions.forEach(o => { try { o.bg.disableInteractive(); o.txt.disableInteractive(); } catch {} });

    if (isCorrect) {
      this.checkWin();
      this.time.delayedCall(1500, () => {
        this.promptText.setText('🎡 Spin the Wheel!');
        this.promptText.setData('speakText', 'Spin the Wheel! Tap the green button to spin!');
        this.answerOptions.forEach(o => { try { o.bg.destroy(); o.txt.destroy(); } catch {} });
        this.answerOptions = [];
        this.landedTerm = undefined;
        this.canSelect = false;
      });
    } else {
      this.time.delayedCall(1200, () => {
        this.answerOptions.forEach(o => {
          if (o.bg !== bg) { try { o.bg.setInteractive({ useHandCursor: true }); } catch {} try { o.txt.setInteractive({ useHandCursor: true }); } catch {} }
        });
        this.canSelect = true;
      });
    }
  }
}
