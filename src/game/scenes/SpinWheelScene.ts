import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPIN WHEEL — Selection Engine  (AAA 2029 — new template #14)
// ============================================================================
// A colorful wheel of terms. Player spins, wheel lands on a term,
// that term becomes the "answer" — player must select matching definition.
// Features:
//   • Smooth wheel rotation with ease-out deceleration
//   • Tick sound as wheel passes each segment
//   • Pointer arrow at top
//   • Winner segment glows + pulses
//   • Definition selection (4 multiple choice)
//   • Level progression + TTS
// ============================================================================

export default class SpinWheelScene extends BaseEngine {
  private wheel!: Phaser.GameObjects.Container;
  private wheelSegments: Phaser.GameObjects.Graphics[] = [];
  private segmentTerms: TermItem[] = [];
  private pointer!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private spinBtn!: Phaser.GameObjects.Container;
  private spinBtnX = 0;
  private spinBtnY = 0;
  private optionsContainerY = 480;
  private answerButtons: Phaser.GameObjects.Container[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;
  private optionsContainer!: Phaser.GameObjects.Container;

  protected maxQuestions() { return Math.min(this.terms.length, 12); }

  protected buildWorld() {
    // ---- Title ----
    this.promptText = this.add.text(
      this.scale.width / 2, 100,
      '🎡 Spin the Wheel!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);
    this.makeHoverSpeakable(this.promptText);

    // ---- Wheel (center-top) ----
    const wheelX = this.scale.width / 2;
    const wheelY = 240;
    const wheelRadius = 180;

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

      // Segment
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

      // Term text on segment
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
    const hub = this.add.circle(0, 0, 22, this.theme.warning, 1)
      .setStrokeStyle(4, 0xffffff, 0.9);
    this.wheel.add(hub);
    // Hub center jewel
    const jewel = this.add.circle(0, 0, 8, 0xffffff, 0.9);
    this.wheel.add(jewel);

    // ---- Decorative lights around the wheel rim ----
    const lightCount = 16;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2 - Math.PI / 2;
      const lx = Math.cos(angle) * (wheelRadius + 8);
      const ly = Math.sin(angle) * (wheelRadius + 8);
      const lightColor = i % 2 === 0 ? this.theme.warning : 0xffffff;
      const light = this.add.circle(lx, ly, 4, lightColor, 1).setDepth(35);
      this.wheel.add(light);
      // Blinking animation (alternating)
      this.tweens.add({
        targets: light,
        alpha: { from: 1, to: 0.3 },
        duration: 400 + i * 30,
        yoyo: true,
        repeat: 999,
        ease: 'Sine.inOut',
      });
    }

    // Outer wheel ring (gold border)
    const ring = this.add.circle(0, 0, wheelRadius + 4, 0x000000, 0)
      .setStrokeStyle(6, this.theme.warning, 0.8).setDepth(34);
    this.wheel.add(ring);

    // Pointer (at top, pointing down) — bigger and more dramatic
    this.pointer = this.add.text(wheelX, wheelY - wheelRadius - 15, '▼', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '44px',
      color: this.hex(this.theme.danger),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40);
    // Pointer bounce
    this.tweens.add({
      targets: this.pointer,
      y: wheelY - wheelRadius - 5,
      duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // ---- Spin button ----
    const btnY = wheelY + wheelRadius + 60;
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

    // Use global pointerdown for reliability
    this.spinBtnX = wheelX;
    this.spinBtnY = btnY;
    this.optionsContainerY = 480; // below the wheel + spin button
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Check if SPIN button was clicked
      if (!this.isSpinning && !this.landedTerm && Math.abs(p.x - this.spinBtnX) < 110 && Math.abs(p.y - this.spinBtnY) < 28) {
        this.spin();
        return;
      }
      // Check if any answer button was clicked — SINGLE TAP = select
      if (this.landedTerm && this.answerButtons.length > 0) {
        for (const btn of this.answerButtons) {
          const opt = btn.getData('opt') as { isCorrect: boolean; term: TermItem };
          if (!opt) continue;
          const btnWorldY = btn.getData('worldY') as number;
          const btnW = Math.min(400, this.scale.width - 40);
          // Check if tap is within button bounds
          if (Math.abs(p.x - this.spinBtnX) < btnW / 2 && Math.abs(p.y - btnWorldY) < 28) {
            // Speak the definition, then select
            audioBus.speak(opt.term.definition ?? opt.term.term);
            this.selectOption(opt.isCorrect, opt.term, btn);
            return;
          }
        }
      }
    });

    // ---- Options container (for definition selection after spin) ----
    this.optionsContainer = this.add.container(wheelX, this.optionsContainerY).setDepth(40);
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    audioBus.play('tap');

    // Clear previous options
    this.answerButtons.forEach(b => b.destroy());
    this.answerButtons = [];

    // Random spin: 5-8 full rotations + random offset
    const rotations = 5 + Math.random() * 3;
    const offset = Math.random() * 360;
    const targetAngle = rotations * 360 + offset;

    // Tick sound as wheel spins (simulate passing segments)
    const tickCount = Math.floor(rotations * this.segmentTerms.length);
    for (let i = 0; i < tickCount; i++) {
      this.time.delayedCall(i * 80, () => {
        if (this.isSpinning) audioBus.play('hover', { freq: 600 + (i % 4) * 100 });
      });
    }

    // Spin animation with ease-out
    this.tweens.add({
      targets: this.wheel,
      angle: targetAngle,
      duration: 3000 + Math.random() * 1000,
      ease: 'Cubic.out',
      onComplete: () => {
        this.onWheelStopped();
      },
    });
  }

  private onWheelStopped() {
    this.isSpinning = false;
    // Calculate which segment the pointer is on
    const segmentAngle = 360 / this.segmentTerms.length;
    const currentAngle = ((this.wheel.angle % 360) + 360) % 360;
    // Pointer is at top (0 degrees). Segment 0 starts at -90 - segmentAngle/2.
    // After rotation, segment at top = floor((360 - currentAngle + segmentAngle/2) / segmentAngle) % count
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

    // AAAA KIDS MODE — Speak the landed term with karaoke highlight.
    if (this.landedTerm) {
      this.speakPromptWithHighlight(this.promptText, this.landedTerm.term, { pitch: 1.15 });
    }

    // Show definition options
    this.showDefinitionOptions();
  }

  private showDefinitionOptions() {
    if (!this.landedTerm) return;
    this.promptText.setText(`Match: ${this.landedTerm.emoji ?? ''} ${this.landedTerm.term}`);

    // 3 options: 1 correct (landed term's definition), 2 decoys
    const decoys = this.terms.filter(t => t.id !== this.landedTerm!.id && t.definition);
    Phaser.Utils.Array.Shuffle(decoys);
    const options = [
      { term: this.landedTerm, isCorrect: true },
      { term: decoys[0] ?? this.landedTerm, isCorrect: false },
      { term: decoys[1] ?? this.landedTerm, isCorrect: false },
    ];
    Phaser.Utils.Array.Shuffle(options);

    // Position buttons below the wheel, stacked vertically
    const btnW = Math.min(400, this.scale.width - 40);
    const btnH = 48;
    const gap = 8;
    const startY = this.optionsContainerY - (options.length * (btnH + gap)) / 2 + btnH / 2;

    options.forEach((opt, i) => {
      const y = startY + i * (btnH + gap) - this.optionsContainerY; // local Y relative to container
      const bg = this.add.rectangle(0, y, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7);
      const txt = this.add.text(0, y, opt.term.definition ?? opt.term.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5);

      const container = this.add.container(0, y, [bg, txt])
        .setSize(btnW, btnH).setDepth(40);
      container.setData('opt', opt);
      container.setData('y', y);
      container.setData('worldY', this.optionsContainerY + y); // store world Y for hit-test

      this.answerButtons.push(container);
      this.optionsContainer.add(container);
    });
  }

  private selectOption(isCorrect: boolean, term: TermItem, btn: Phaser.GameObjects.Container) {
    this.recordAnswer({
      term: this.landedTerm!.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    // Highlight correct/wrong
    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(isCorrect ? this.theme.success : this.theme.danger, 1);

    // FEEDBACK: Show Correct! or Try again!
    const feedbackMsg = isCorrect ? '✅ Correct!' : '❌ Try again!';
    const feedbackColor = isCorrect ? this.theme.success : this.theme.danger;
    this.juice.scorePopup(this.spinBtnX, this.optionsContainerY - 40, feedbackMsg, feedbackColor);
    this.juice.flash(feedbackColor, 0.3, 250);
    if (isCorrect) {
      audioBus.play('correct');
      this.juice.burst(btn.x, btn.y, 'correct');
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
    }

    // Close answers after 1.2s and reset for next spin
    setTimeout(() => {
      try {
        this.promptText.setText('🎡 Spin the Wheel!');
        this.answerButtons.forEach(b => { try { b.destroy(); } catch {} });
        this.answerButtons = [];
        this.landedTerm = undefined;
      } catch {}
    }, 1200);

    if (isCorrect) {
      this.checkWin();
    }
  }
}
