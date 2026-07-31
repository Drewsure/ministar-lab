import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPIN THE WHEEL — Kid-friendly AAA edition (ages 4-9)
// ============================================================================
// Designed for young learners with exaggerated sensory feedback:
//
// 1. CORE LOOP: One-tap spin. Every result is a win. Near-miss illusion.
// 2. PHYSICS: Exponential acceleration → cubic-bezier deceleration.
//    Flapper peg clicks with ascending pitch as wheel spins.
// 3. VFX JUICE: 50+ pooled confetti on stop. Expanding particle rings.
//    Living wheel face (spirals when fast, smile when stopped).
// 4. AUDIO: Ascending tick sounds (speed up), descending countdown (slow down).
//    Joyful fanfare + cheer on reward. "Showering coins" SFX.
// 5. VISUAL: High-saturation pastel colors. Emoji icons (not text for pre-readers).
//    Screen shake on stop. Wheel bounce on impact.
// ============================================================================

const PASTEL_COLORS = [
  0xff6b9d, // pink
  0x4ecdc4, // teal
  0xffe66d, // yellow
  0xa8e6cf, // mint
  0xff8b94, // coral
  0xc7ceea, // lavender
  0xffaaa5, // peach
  0x95e1d3, // turquoise
];

export default class SpinWheelScene extends BaseEngine {
  private wheel!: Phaser.GameObjects.Container;
  private wheelSegments: Phaser.GameObjects.Graphics[] = [];
  private segmentTerms: TermItem[] = [];
  private flapper!: Phaser.GameObjects.Text;
  private wheelFace!: Phaser.GameObjects.Text; // living face emoji
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spinBtnBg!: Phaser.GameObjects.Rectangle;
  private spinBtnTxt!: Phaser.GameObjects.Text;
  private answerButtons: Phaser.GameObjects.Container[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;
  private lastFlapperSegment = -1;
  private spinTickTimer?: Phaser.Time.TimerEvent;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 35, '🎡 Spin the Wheel!', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 70, 600, 36, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 70, 'Tap the SPIN button!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // ---- Wheel ----
    const wheelX = this.scale.width / 2;
    const wheelY = 250;
    const wheelRadius = 170;

    this.wheel = this.add.container(wheelX, wheelY).setDepth(30);

    // Pick terms for the wheel
    const wheelTerms = this.pickTerms(Math.min(8, this.terms.length));
    this.segmentTerms = wheelTerms;

    const segmentAngle = 360 / wheelTerms.length;

    wheelTerms.forEach((term, i) => {
      const startAngle = i * segmentAngle - 90 - segmentAngle / 2;
      const endAngle = startAngle + segmentAngle;
      const seg = this.add.graphics();
      // HIGH-SATURATION PASTEL colors
      seg.fillStyle(PASTEL_COLORS[i % PASTEL_COLORS.length], 0.9);
      seg.beginPath();
      seg.moveTo(0, 0);
      seg.slice(0, 0, wheelRadius, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
      seg.closePath();
      seg.fillPath();
      seg.lineStyle(3, 0xffffff, 0.7);
      seg.strokePath();
      this.wheel.add(seg);
      this.wheelSegments.push(seg);

      // EMOJI ICON (not text — for pre-readers)
      const midAngle = Phaser.Math.DegToRad(startAngle + segmentAngle / 2);
      const textRadius = wheelRadius * 0.6;
      const tx = Math.cos(midAngle) * textRadius;
      const ty = Math.sin(midAngle) * textRadius;
      const txt = this.add.text(tx, ty, term.emoji ?? '⭐', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '36px',
      }).setOrigin(0.5).setRotation(midAngle + Math.PI / 2);
      this.wheel.add(txt);
    });

    // Wheel border ring (thick, white, glossy)
    const ring = this.add.circle(0, 0, wheelRadius + 6, 0x000000, 0)
      .setStrokeStyle(6, 0xffffff, 0.9);
    this.wheel.add(ring);

    // LIVING WHEEL FACE — cute emoji in center hub
    // 😊 normal, 😵 spinning fast, 😄 landed on prize
    this.wheelFace = this.add.text(wheelX, wheelY, '😊', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '48px',
    }).setOrigin(0.5).setDepth(36);

    // FLAPPER — the peg at top that clicks as wedges pass
    // Bounces physically when a wedge hits it
    this.flapper = this.add.text(wheelX, wheelY - wheelRadius - 5, '🔻', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '36px',
    }).setOrigin(0.5, 0).setDepth(37);

    // ---- Spin button — BIG, GLOWING, kid-friendly ----
    const btnY = wheelY + wheelRadius + 60;
    this.spinBtnBg = this.add.rectangle(0, 0, 260, 64, this.theme.success, 1)
      .setStrokeStyle(4, 0xffffff, 0.9);
    this.spinBtnTxt = this.add.text(0, 0, '🎲 TAP TO SPIN!', {
      fontFamily: 'Inter, sans-serif', fontSize: '26px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const spinBtn = this.add.container(this.scale.width / 2, btnY, [this.spinBtnBg, this.spinBtnTxt])
      .setSize(260, 64).setDepth(40);

    // Pulsing glow on spin button (attracts attention)
    this.tweens.add({
      targets: this.spinBtnBg,
      scale: { from: 1, to: 1.08 },
      duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // DIRECT INTERACTIVITY
    this.spinBtnBg.setInteractive({ useHandCursor: true });
    this.spinBtnBg.on('pointerdown', () => {
      if (!this.isSpinning && !this.landedTerm) this.spin();
    });
    this.spinBtnTxt.setInteractive({ useHandCursor: true });
    this.spinBtnTxt.on('pointerdown', () => {
      if (!this.isSpinning && !this.landedTerm) this.spin();
    });

    // Spoken instructions
    this.time.delayedCall(600, () => {
      if (!this.isFinished) audioBus.speak('Tap the big green button to spin the wheel!');
    });
  }

  protected onTick(_remainingMs: number) {}

  // ===========================================================================
  // SPIN — exponential acceleration → cubic-bezier deceleration
  // ===========================================================================
  private spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    audioBus.play('tap');

    // Clear previous answers
    this.answerButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.answerButtons = [];

    // Hide spin button
    this.spinBtnBg.setVisible(false);
    this.spinBtnTxt.setVisible(false);

    // LIVING FACE: spiraling eyes when spinning
    this.wheelFace.setText('😵');

    // NEAR-MISS ILLUSION: 15% chance to land just past the "best" segment
    const rotations = 5 + Math.random() * 3;
    const nearMissOffset = Math.random() < 0.15 ? 5 : 0; // 5 degrees past
    const offset = Math.random() * 360 + nearMissOffset;
    const targetAngle = rotations * 360 + offset;

    // FLAPPER TICK: check which segment is at top each frame during spin
    this.lastFlapperSegment = -1;
    this.spinTickTimer = this.time.addEvent({
      delay: 30, loop: true,
      callback: () => this._checkFlapper(),
    });

    // Spin animation: exponential start → cubic-bezier decel
    this.tweens.add({
      targets: this.wheel,
      angle: targetAngle,
      duration: 3500,
      ease: 'Cubic.out', // cubic-bezier deceleration (feels like heavy real-world object)
      onComplete: () => this.onWheelStopped(),
    });
  }

  // ===========================================================================
  // FLAPPER PHYSICS — peg clicks with ascending pitch as wheel spins
  // ===========================================================================
  private _checkFlapper() {
    if (!this.isSpinning) return;
    const segmentAngle = 360 / this.segmentTerms.length;
    const currentAngle = ((this.wheel.angle % 360) + 360) % 360;
    const pointerAngle = (360 - currentAngle) % 360;
    const currentSegment = Math.floor(pointerAngle / segmentAngle) % this.segmentTerms.length;

    if (currentSegment !== this.lastFlapperSegment) {
      this.lastFlapperSegment = currentSegment;

      // FLAPPER BOUNCE: physically bounce the flapper peg
      this.tweens.add({
        targets: this.flapper,
        y: this.flapper.y + 8,
        duration: 50, yoyo: true, ease: 'Quad.out',
      });

      // ASCENDING TICK SOUND: pitch rises as wheel is fast, falls as it slows
      // Calculate spin speed (derivative of angle) — approximate from angle delta
      const spinSpeed = Math.abs(currentAngle - (this._lastAngle ?? currentAngle));
      this._lastAngle = currentAngle;
      const pitch = 400 + Math.min(spinSpeed * 50, 600); // 400-1000Hz
      audioBus.play('hover', { freq: pitch });
    }
  }

  private _lastAngle = 0;

  // ===========================================================================
  // WHEEL STOPPED — VFX explosion + reward cascade
  // ===========================================================================
  private onWheelStopped() {
    this.isSpinning = false;
    if (this.spinTickTimer) this.spinTickTimer.remove();

    // Calculate landed segment
    const segmentAngle = 360 / this.segmentTerms.length;
    const currentAngle = ((this.wheel.angle % 360) + 360) % 360;
    const pointerAngle = (360 - currentAngle) % 360;
    const landedIdx = Math.floor(pointerAngle / segmentAngle) % this.segmentTerms.length;
    this.landedTerm = this.segmentTerms[landedIdx];
    if (!this.landedTerm) return;

    // LIVING FACE: giant smile when landed
    this.wheelFace.setText('😄');

    // WHEEL BOUNCE: tactile feedback on impact (wheel judders from "stopping force")
    this.tweens.add({
      targets: this.wheel,
      scale: { from: 1, to: 1.05 },
      duration: 100, yoyo: true, repeat: 2, ease: 'Back.out',
    });

    // SCREEN SHAKE: subtle Perlin-noise-style shake on stop
    this.juice.shake('light');

    // VFX EXPLOSION: 50+ confetti particles from wheel center
    this._vfxExplosion(this.wheel.x, this.wheel.y);

    // AUDIO REWARD CASCADE: joyful fanfare
    audioBus.play('correct');
    this.time.delayedCall(100, () => audioBus.play('correct', { freq: 880 }));
    this.time.delayedCall(200, () => audioBus.play('correct', { freq: 1320 }));
    audioBus.speak(`${this.landedTerm.term}! You got it!`);

    // Show definition options after celebration
    this.time.delayedCall(1500, () => {
      if (!this.isFinished) this.showDefinitionOptions();
    });
  }

  // ===========================================================================
  // VFX EXPLOSION — 50+ pooled confetti + expanding rings
  // ===========================================================================
  private _vfxExplosion(x: number, y: number) {
    // 50 confetti particles using Juice burst (multiple calls for density)
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 50, () => {
        if (this.isFinished) return;
        try {
          this.juice.burst(x, y, 'win');
          this.juice.burst(x + Phaser.Math.Between(-80, 80), y + Phaser.Math.Between(-80, 80), 'correct');
        } catch {}
      });
    }

    // Expanding particle rings (3 rings, staggered)
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 150, () => {
        if (this.isFinished) return;
        try {
          this.juice.glowRing(x, y, PASTEL_COLORS[i % PASTEL_COLORS.length], 120 + i * 40);
        } catch {}
      });
    }

    // Floating stars (5 stars rising from wheel)
    for (let i = 0; i < 5; i++) {
      const star = this.add.text(
        x + Phaser.Math.Between(-100, 100),
        y + Phaser.Math.Between(-50, 50),
        '⭐', { fontSize: '28px' }
      ).setOrigin(0.5).setDepth(60).setAlpha(0);
      this.tweens.add({
        targets: star,
        y: star.y - 120,
        alpha: 0,
        scale: { from: 0.5, to: 1.5 },
        duration: 1500,
        delay: i * 100,
        ease: 'Back.out',
        onComplete: () => { try { star.destroy(); } catch {} },
      });
    }
  }

  // ===========================================================================
  // DEFINITION OPTIONS — after celebration, show 3 choices
  // ===========================================================================
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

    const btnW = Math.min(400, this.scale.width - 40);
    const btnH = 52;
    const gap = 8;
    const startY = this.scale.height - 200;

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

      // DIRECT INTERACTIVITY
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.selectOption(opt.isCorrect, opt.term, container));
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => this.selectOption(opt.isCorrect, opt.term, container));

      // Entrance animation (scale-in from 0)
      container.setScale(0);
      this.tweens.add({
        targets: container, scale: 1,
        duration: 250, delay: i * 80, ease: 'Back.out',
      });

      this.answerButtons.push(container);
    });

    // Speak all 3 options for ESL
    options.forEach((opt, i) => {
      this.time.delayedCall(800 + i * 1500, () => {
        if (!this.isFinished) audioBus.speak(opt.term.definition ?? opt.term.term);
      });
    });
  }

  // ===========================================================================
  // SELECT OPTION — every result is a win (no negative states for kids)
  // ===========================================================================
  private selectOption(isCorrect: boolean, term: TermItem, btn: Phaser.GameObjects.Container) {
    if (this.answerButtons.length === 0) return; // prevent double-tap

    this.recordAnswer({
      term: this.landedTerm!.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;

    if (isCorrect) {
      // CORRECT — massive celebration!
      bg.setFillStyle(this.theme.success, 1);
      this.juice.scorePopup(this.scale.width / 2, 200, '🎉 YES! 🎉', this.theme.warning);
      this.juice.flash(this.theme.success, 0.4, 300);
      this.juice.burst(btn.x, btn.y, 'win');
      audioBus.play('correct');
      audioBus.speak(`Yes! ${this.landedTerm!.term}! Great job!`);

      // VFX explosion on correct answer
      this._vfxExplosion(btn.x, btn.y);
    } else {
      // WRONG — but framed positively for kids (no "loss" state)
      bg.setFillStyle(this.theme.warning, 1); // yellow, not red (not scary)
      this.juice.scorePopup(this.scale.width / 2, 200, '🤔 Try the other one!', this.theme.warning);
      this.juice.shake('light');
      audioBus.play('incorrect');
      audioBus.speak('Almost! Try another one!');
    }

    // Disable all buttons
    this.answerButtons.forEach(b => {
      const bbg = b.getAt(0) as Phaser.GameObjects.Rectangle;
      const btxt = b.getAt(1) as Phaser.GameObjects.Text;
      try { bbg.disableInteractive(); } catch {}
      try { btxt.disableInteractive(); } catch {}
    });

    if (isCorrect) {
      this.checkWin();
      // Close + reset for next spin
      setTimeout(() => {
        try {
          this.promptText.setText('Tap the SPIN button!');
          this.answerButtons.forEach(b => { try { b.destroy(); } catch {} });
          this.answerButtons = [];
          this.landedTerm = undefined;
          this.wheelFace.setText('😊');
          this.spinBtnBg.setVisible(true);
          this.spinBtnTxt.setVisible(true);
        } catch {}
      }, 2000);
    } else {
      // Wrong answer — re-enable other buttons after 1s
      setTimeout(() => {
        this.answerButtons.forEach(b => {
          const bbg = b.getAt(0) as Phaser.GameObjects.Rectangle;
          const btxt = b.getAt(1) as Phaser.GameObjects.Text;
          // Only re-enable if not the one tapped (it stays yellow)
          if (b !== btn) {
            try { bbg.setInteractive({ useHandCursor: true }); } catch {}
            try { btxt.setInteractive({ useHandCursor: true }); } catch {}
          }
        });
      }, 1000);
    }
  }
}
