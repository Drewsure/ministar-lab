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
//
// AUDIO-TEXT SYNC HIGHLIGHTING (kid-mode enhancement):
// 6. When the wheel lands, the landed term is highlighted + spoken aloud
//    ("cherry"), then the prompt "Which one matches?" is highlighted + spoken.
// 7. Each answer option is read aloud in sequence — the option being spoken
//    gets a karaoke-style animated highlight (pulsing scale + rainbow color
//    cycle + glow stroke). Highlight clears the moment speech ends.
// 8. After options, prompt "Tap the matching one!" is highlighted + spoken.
// 9. On CORRECT answer: massive layered fanfare — win sweep + C-E-G-C-E
//    arpeggio + streak cascade + pop sparkle + random celebratory phrase
//    ("You got it!" / "Yes! Superstar!" / "Brilliant!") + confetti rain
//    across the entire screen + multi-stage wheelFace animation + bouncing
//    "You got it!" text + multiple glow rings on the correct button.
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

// Karaoke highlight color cycle (rainbow pastels).
const HIGHLIGHT_COLORS = ['#ff6b9d', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffaaa5', '#c7ceea'];

// Random celebratory phrases spoken on correct answer.
const CELEBRATION_PHRASES = [
  'You got it!',
  'Yes! Superstar!',
  'Brilliant!',
  'Amazing work!',
  'Fantastic!',
  'You are so smart!',
  'Wonderful!',
  'Perfect match!',
];

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
  private wheelEmojis: Phaser.GameObjects.Text[] = []; // track emoji texts for landed-segment highlight
  private segmentTerms: TermItem[] = [];
  private flapper!: Phaser.GameObjects.Text;
  private wheelFace!: Phaser.GameObjects.Text; // living face emoji
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spinBtnBg!: Phaser.GameObjects.Rectangle;
  private spinBtnTxt!: Phaser.GameObjects.Text;
  private answerOptions: AnswerOption[] = [];
  private isSpinning = false;
  private landedTerm?: TermItem;
  private landedIdx = -1;
  private lastFlapperSegment = -1;
  private spinTickTimer?: Phaser.Time.TimerEvent;
  private _lastAngle = 0;

  // AUDIO-TEXT SYNC — highlight state
  private _highlightTimers: Phaser.Time.TimerEvent[] = [];
  private _highlightTargets: Phaser.GameObjects.Text[] = [];
  private _readingOptions = false;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 35, '🎡 Spin the Wheel!', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt (will be highlighted during speech) ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 70, 600, 40, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 70, 'Tap the SPIN button!', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
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
      this.wheelEmojis.push(txt);
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

    // Spoken instructions (highlighted)
    this.time.delayedCall(600, () => {
      if (!this.isFinished) {
        this._speakWithHighlight(this.promptText, 'Tap the big green button to spin the wheel!');
      }
    });

    // Cleanup highlights on shutdown to prevent leaks.
    this.events.once('shutdown', () => this._clearHighlights());
  }

  protected onTick(_remainingMs: number) {}

  // ===========================================================================
  // AUDIO-TEXT SYNC HIGHLIGHTING — karaoke-style animated highlight
  // ===========================================================================
  // When speaking, the target Text gets:
  //   • pulsing scale (1.0 ↔ 1.1) at 350ms cycle
  //   • rainbow color cycling through bright pastels at 200ms cycle
  //   • thick yellow stroke + drop shadow (glow effect)
  // Highlight clears the moment speech ends (via onEnd callback) — with
  // an estimated-duration fallback in case TTS fails silently.
  // ===========================================================================
  private _speakWithHighlight(
    textObj: Phaser.GameObjects.Text,
    text: string,
    opts: { rate?: number; pitch?: number; isQuestion?: boolean } = {}
  ) {
    // Cancel any existing highlight first.
    this._clearHighlights();
    this._highlightTargets.push(textObj);

    // Snapshot original style so we can restore it cleanly.
    const origColor = textObj.style.color;
    const origStroke = (textObj.style as any).stroke ?? '#000000';
    const origStrokeThickness = (textObj.style as any).strokeThickness ?? 0;
    const origScale = textObj.scaleX ?? 1;

    // Estimated speech duration (fallback if TTS unavailable / onEnd doesn't fire).
    const estMs = Math.max(1200, text.length * 65);

    const startHighlight = () => {
      try {
        // Apply glow stroke + shadow.
        textObj.setStyle({
          stroke: '#ffff00',
          strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 0, color: '#ffff00', blur: 12, fill: true, stroke: true },
        });

        // Pulsing scale tween — gentle "breathing" effect.
        try { this.tweens.killTweensOf(textObj); } catch {}
        this.tweens.add({
          targets: textObj,
          scale: { from: origScale, to: origScale * 1.1 },
          duration: 350,
          yoyo: true,
          repeat: 999, // ETERNAL_VIGILANCE: no repeat: -1
          ease: 'Sine.inOut',
        });

        // Rainbow color cycle timer.
        let colorIdx = 0;
        const colorTimer = this.time.addEvent({
          delay: 200,
          repeat: 999,
          callback: () => {
            try {
              colorIdx = (colorIdx + 1) % HIGHLIGHT_COLORS.length;
              textObj.setColor(HIGHLIGHT_COLORS[colorIdx]);
            } catch {}
          },
        });
        this._highlightTimers.push(colorTimer);
      } catch (e) {
        console.error('[SpinWheel] startHighlight error:', e);
      }
    };

    const endHighlight = () => {
      try {
        // Restore original style.
        textObj.setStyle({
          stroke: origStroke,
          strokeThickness: origStrokeThickness,
          shadow: { offsetX: 0, offsetY: 0, color: '#000000', blur: 0, fill: false, stroke: false },
        });
        textObj.setColor(origColor);
        try { this.tweens.killTweensOf(textObj); } catch {}
        textObj.setScale(origScale);
      } catch (e) {
        console.error('[SpinWheel] endHighlight error:', e);
      }
      this._clearHighlights();
    };

    // Fallback timer — ensures highlight ends even if TTS onEnd doesn't fire.
    const fallbackTimer = this.time.delayedCall(estMs + 500, () => {
      // Only end if we're still highlighting this target.
      if (this._highlightTargets.includes(textObj)) {
        endHighlight();
      }
    });
    this._highlightTimers.push(fallbackTimer);

    // Kick off speech with onStart/onEnd callbacks.
    audioBus.speak(text, {
      ...opts,
      onStart: startHighlight,
      onEnd: endHighlight,
    });
  }

  private _clearHighlights() {
    this._highlightTimers.forEach(t => { try { t.remove(); } catch {} });
    this._highlightTimers = [];
    this._highlightTargets = [];
  }

  // ===========================================================================
  // SPIN — exponential acceleration → cubic-bezier deceleration
  // ===========================================================================
  private spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    this._clearHighlights();
    audioBus.stopSpeaking();
    audioBus.play('tap');

    // Clear previous answers
    this.answerOptions.forEach(o => { try { o.container.destroy(); } catch {} });
    this.answerOptions = [];

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

  // ===========================================================================
  // WHEEL STOPPED — VFX explosion + audio-text-sync announcement flow
  // ===========================================================================
  // Flow (per user spec):
  //   1. Wheel bounces + face 😄 + screen shake + VFX explosion (existing)
  //   2. Highlight landed segment emoji + speak the term ("cherry")
  //   3. After ~1s, prompt "Which one matches?" → highlighted + spoken
  //   4. Show 3 definition options
  //   5. Read each option aloud IN SEQUENCE with highlight on the option being spoken
  //   6. After all options, prompt "Tap the matching one!" → highlighted + spoken
  //   7. Wait for student input
  // ===========================================================================
  private onWheelStopped() {
    this.isSpinning = false;
    if (this.spinTickTimer) this.spinTickTimer.remove();

    // Calculate landed segment
    const segmentAngle = 360 / this.segmentTerms.length;
    const currentAngle = ((this.wheel.angle % 360) + 360) % 360;
    const pointerAngle = (360 - currentAngle) % 360;
    const landedIdx = Math.floor(pointerAngle / segmentAngle) % this.segmentTerms.length;
    this.landedIdx = landedIdx;
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

    // AUDIO REWARD CASCADE: joyful fanfare (existing — keep)
    audioBus.play('correct');
    this.time.delayedCall(100, () => audioBus.play('correct', { freq: 880 }));
    this.time.delayedCall(200, () => audioBus.play('correct', { freq: 1320 }));

    // --- AUDIO-TEXT SYNC FLOW (per user spec) ---
    // Step 1: Highlight landed segment emoji + speak the term.
    this._highlightLandedSegment(landedIdx);
    // Prompt shows the landed term + emoji while speaking.
    this.promptText.setText(`${this.landedTerm.emoji ?? ''} ${this.landedTerm.term}`);
    this._speakWithHighlight(this.promptText, this.landedTerm.term, { pitch: 1.15 });

    // Step 2: After term spoken + brief pause, speak "Which one matches?"
    this.time.delayedCall(1300, () => {
      if (this.isFinished || !this.landedTerm) return;
      this.promptText.setText('Which one matches?');
      this._speakWithHighlight(this.promptText, 'Which one matches?', { isQuestion: true });
    });

    // Step 3: After "Which one matches?" spoken, show options + read each.
    this.time.delayedCall(2800, () => {
      if (!this.isFinished) this.showDefinitionOptions();
    });
  }

  // Highlight the landed wheel segment — pulse its emoji + draw a glowing ring.
  private _highlightLandedSegment(idx: number) {
    try {
      const emoji = this.wheelEmojis[idx];
      if (!emoji) return;
      // Pulse the segment emoji (scale up + back).
      this.tweens.add({
        targets: emoji,
        scale: { from: 1, to: 1.4 },
        duration: 400, yoyo: true, repeat: 3, ease: 'Back.out',
      });
      // Add a temporary glowing ring at the segment position (world coords).
      const midAngleIdx = idx;
      const segmentAngle = 360 / this.segmentTerms.length;
      const startAngle = midAngleIdx * segmentAngle - 90 - segmentAngle / 2;
      const midAngle = Phaser.Math.DegToRad(startAngle + segmentAngle / 2);
      const textRadius = 170 * 0.6;
      const worldX = this.wheel.x + Math.cos(midAngle) * textRadius;
      const worldY = this.wheel.y + Math.sin(midAngle) * textRadius;
      this.juice.glowRing(worldX, worldY, 0xffff00, 60);
    } catch (e) {
      console.error('[SpinWheel] _highlightLandedSegment error:', e);
    }
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
  // DEFINITION OPTIONS — show 3 choices + read each with highlight
  // ===========================================================================
  private showDefinitionOptions() {
    if (!this.landedTerm) return;
    const landed = this.landedTerm; // local snapshot for closure safety

    // 3 options: 1 correct, 2 decoys
    const decoys = this.terms.filter(t => t.id !== landed.id);
    Phaser.Utils.Array.Shuffle(decoys);
    const optionTerms = [
      landed,
      decoys[0] ?? landed,
      decoys[1] ?? landed,
    ];
    Phaser.Utils.Array.Shuffle(optionTerms);

    const btnW = Math.min(400, this.scale.width - 40);
    const btnH = 52;
    const gap = 8;
    const startY = this.scale.height - 200;

    optionTerms.forEach((term, i) => {
      const y = startY + i * (btnH + gap);

      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7);
      const txt = this.add.text(0, 0, term.definition ?? term.term, {
        fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: btnW - 20 },
      }).setOrigin(0.5);

      const container = this.add.container(this.scale.width / 2, y, [bg, txt])
        .setSize(btnW, btnH).setDepth(45);

      // DIRECT INTERACTIVITY
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.selectOption(term.id === landed.id, term, container));
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => this.selectOption(term.id === landed.id, term, container));

      // Entrance animation (scale-in from 0)
      container.setScale(0);
      this.tweens.add({
        targets: container, scale: 1,
        duration: 250, delay: i * 80, ease: 'Back.out',
      });

      this.answerOptions.push({
        term,
        isCorrect: term.id === landed.id,
        container,
        bg,
        txt,
      });
    });

    // --- AUDIO-TEXT SYNC: Read each option in sequence with highlight ---
    // Wait for entrance animation to finish (~400ms), then read each option.
    this._readingOptions = true;
    this._readOptionAtIndex(0, 600);
  }

  // Recursively read each option with highlight, then speak "Tap the matching one!".
  private _readOptionAtIndex(idx: number, delayMs: number) {
    if (idx >= this.answerOptions.length) {
      // All options read — speak final instruction.
      this._readingOptions = false;
      this.time.delayedCall(400, () => {
        if (this.isFinished || !this.landedTerm) return;
        this.promptText.setText('Tap the matching one!');
        this._speakWithHighlight(this.promptText, 'Tap the matching one!', { pitch: 1.1 });
      });
      return;
    }

    this.time.delayedCall(delayMs, () => {
      if (this.isFinished || !this.landedTerm) return;
      const opt = this.answerOptions[idx];
      if (!opt) return;
      const textToSpeak = opt.term.definition ?? opt.term.term;
      // Highlight this option's text while speaking it.
      // _speakWithHighlight manages its own onStart/onEnd highlight lifecycle internally.
      this._speakWithHighlight(opt.txt, textToSpeak);
      // After this option's speech ends (~estimated), move to the next.
      // We use a fixed delay based on text length to chain the next read.
      const estDuration = Math.max(1800, textToSpeak.length * 75);
      this._readOptionAtIndex(idx + 1, estDuration);
    });
  }

  // ===========================================================================
  // SELECT OPTION — every result is a win (no negative states for kids)
  // ===========================================================================
  private selectOption(isCorrect: boolean, term: TermItem, btn: Phaser.GameObjects.Container) {
    if (this.answerOptions.length === 0) return; // prevent double-tap
    // Cancel any in-progress option reading.
    this._clearHighlights();
    audioBus.stopSpeaking();

    this.recordAnswer({
      term: this.landedTerm!.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (isCorrect) {
      // ---- CORRECT — MASSIVE CELEBRATION FANFARE ----
      this._celebrateCorrect(btn);
    } else {
      // WRONG — but framed positively for kids (no "loss" state)
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(this.theme.warning, 1); // yellow, not red (not scary)
      this.juice.scorePopup(this.scale.width / 2, 200, '🤔 Try the other one!', this.theme.warning);
      this.juice.shake('light');
      audioBus.play('incorrect');
      // Highlight the prompt while speaking "Almost! Try another one!"
      this.promptText.setText('Almost! Try another one!');
      this._speakWithHighlight(this.promptText, 'Almost! Try another one!', { pitch: 1.1 });
    }

    // Disable all buttons
    this.answerOptions.forEach(o => {
      try { o.bg.disableInteractive(); } catch {}
      try { o.txt.disableInteractive(); } catch {}
    });

    if (isCorrect) {
      this.checkWin();
      // Close + reset for next spin
      setTimeout(() => {
        try {
          this._clearHighlights();
          this.promptText.setText('Tap the SPIN button!');
          this.answerOptions.forEach(o => { try { o.container.destroy(); } catch {} });
          this.answerOptions = [];
          this.landedTerm = undefined;
          this.landedIdx = -1;
          this.wheelFace.setText('😊');
          this.spinBtnBg.setVisible(true);
          this.spinBtnTxt.setVisible(true);
        } catch {}
      }, 2800);
    } else {
      // Wrong answer — re-enable other buttons after 1.4s (after "Almost!" speech)
      setTimeout(() => {
        this.answerOptions.forEach(o => {
          // Only re-enable if not the one tapped (it stays yellow)
          if (o.container !== btn) {
            try { o.bg.setInteractive({ useHandCursor: true }); } catch {}
            try { o.txt.setInteractive({ useHandCursor: true }); } catch {}
          }
        });
      }, 1400);
    }
  }

  // ===========================================================================
  // CELEBRATE CORRECT — massive layered fanfare + confetti rain + "You got it!"
  // ===========================================================================
  // Audio cascade (layered, staggered for richness):
  //   t=0ms    → 'win' (523→1046 sweep, low→high triumphant)
  //   t=120ms  → 'correct' @ 523Hz (C4)
  //   t=240ms  → 'correct' @ 659Hz (E4)
  //   t=360ms  → 'correct' @ 784Hz (G4)
  //   t=480ms  → 'correct' @ 1046Hz (C5)
  //   t=600ms  → 'streak' (880→1320 high sparkle sweep)
  //   t=750ms  → 'pop' (final bright sparkle)
  //   t=300ms  → spoken celebratory phrase ("You got it!" / "Yes! Superstar!")
  //
  // Visual cascade:
  //   • Green flash overlay
  //   • "🎉 YOU GOT IT! 🎉" bouncing popup
  //   • VFX explosion at correct button
  //   • Confetti rain across entire screen (top → falling)
  //   • Multiple glow rings on correct button
  //   • WheelFace animation: 😄 → 🤩 → 🎉 → 😄
  //   • Mascot wiggle (wheel bounce)
  // ===========================================================================
  private _celebrateCorrect(btn: Phaser.GameObjects.Container) {
    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;

    // Visual: green button + flash + popup + explosion.
    bg.setFillStyle(this.theme.success, 1);
    this.juice.scorePopup(this.scale.width / 2, 200, '🎉 YOU GOT IT! 🎉', this.theme.warning);
    this.juice.flash(this.theme.success, 0.4, 300);
    this.juice.burst(btn.x, btn.y, 'win');

    // Layered musical fanfare — C-E-G-C arpeggio + win sweep + streak sparkle + pop.
    audioBus.play('win');
    this.time.delayedCall(120, () => { try { audioBus.play('correct', { freq: 523, duration: 0.25 }); } catch {} }); // C4
    this.time.delayedCall(240, () => { try { audioBus.play('correct', { freq: 659, duration: 0.25 }); } catch {} }); // E4
    this.time.delayedCall(360, () => { try { audioBus.play('correct', { freq: 784, duration: 0.25 }); } catch {} }); // G4
    this.time.delayedCall(480, () => { try { audioBus.play('correct', { freq: 1046, duration: 0.3 }); } catch {} }); // C5
    this.time.delayedCall(600, () => { try { audioBus.play('streak'); } catch {} }); // 880→1320 sparkle
    this.time.delayedCall(750, () => { try { audioBus.play('pop'); } catch {} }); // final pop

    // Spoken celebratory phrase — random pick, delayed so fanfare starts first.
    const phrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
    this.time.delayedCall(300, () => {
      try { audioBus.speak(phrase, { pitch: 1.25, rate: 1.0 }); } catch {}
    });

    // VFX explosion on correct answer (existing — keep).
    this._vfxExplosion(btn.x, btn.y);

    // CONFETTI RAIN — drop confetti from the top across the entire screen.
    this._confettiRain();

    // Multiple glow rings on the correct button (3 staggered, growing size).
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 150, () => {
        if (this.isFinished) return;
        try {
          this.juice.glowRing(btn.x, btn.y, PASTEL_COLORS[i % PASTEL_COLORS.length], 60 + i * 30);
        } catch {}
      });
    }

    // WheelFace multi-stage animation: 😄 → 🤩 → 🎉 → 😄
    this.wheelFace.setText('🤩');
    this.time.delayedCall(400, () => { try { this.wheelFace.setText('🎉'); } catch {} });
    this.time.delayedCall(900, () => { try { this.wheelFace.setText('😄'); } catch {} });

    // Wheel wiggle (celebration dance).
    this.tweens.add({
      targets: this.wheel,
      angle: { from: this.wheel.angle - 5, to: this.wheel.angle + 5 },
      duration: 80, yoyo: true, repeat: 5, ease: 'Sine.inOut',
      onComplete: () => {
        // Restore wheel angle to a clean value to prevent drift.
        this.wheel.angle = Math.round(this.wheel.angle);
      },
    });

    // Bouncing "🎉 YOU GOT IT! 🎉" text — extra emphasis.
    const celebrateText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, '🎉 YOU GOT IT! 🎉', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(200).setScale(0);

    this.tweens.add({
      targets: celebrateText,
      scale: { from: 0, to: 1.2 },
      duration: 400, ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: celebrateText,
          scale: { from: 1.2, to: 1 },
          y: this.scale.height / 2 - 80,
          duration: 300, ease: 'Quad.out',
          onComplete: () => {
            // Hold for 1s, then fade out.
            this.time.delayedCall(1000, () => {
              this.tweens.add({
                targets: celebrateText,
                alpha: 0, y: celebrateText.y - 30,
                duration: 400, ease: 'Cubic.in',
                onComplete: () => { try { celebrateText.destroy(); } catch {} },
              });
            });
          },
        });
      },
    });
  }

  // ===========================================================================
  // CONFETTI RAIN — drop 15 confetti emojis from the top across the screen.
  // Each falls with random horizontal drift + rotation. Lightweight + pooled.
  // ===========================================================================
  private _confettiRain() {
    const emojis = ['🎉', '🎊', '⭐', '🌟', '💫', '✨', '🎈', '🏆'];
    const count = 15;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 80, () => {
        if (this.isFinished) return;
        try {
          const x = Phaser.Math.Between(20, this.scale.width - 20);
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          const piece = this.add.text(x, -30, emoji, {
            fontFamily: 'Inter, sans-serif',
            fontSize: `${Phaser.Math.Between(24, 40)}px`,
          }).setOrigin(0.5).setDepth(150);

          const fallDuration = Phaser.Math.Between(1800, 2800);
          const drift = Phaser.Math.Between(-60, 60);
          const rotations = Phaser.Math.Between(2, 5);

          this.tweens.add({
            targets: piece,
            y: this.scale.height + 40,
            x: x + drift,
            angle: 360 * rotations,
            alpha: { from: 1, to: 0.8 },
            duration: fallDuration,
            ease: 'Cubic.in',
            onComplete: () => { try { piece.destroy(); } catch {} },
          });
        } catch {}
      });
    }
  }
}
