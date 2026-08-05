import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// GAMESHOW — Supercharged Spectacle  (AAAA 2029 edition)
// ============================================================================
// Premium gameshow experience:
//   • 🎤 Host showman character (jump+spin on correct, wobble+duck on wrong)
//   • Neon borders (top + bottom pulsing rectangles in cyan + magenta)
//   • Arcade buzzer sink — buttons sink + bounce on tap with whack SFX
//   • Camera zoom (zoomTo 1.06 on correct, reset on advance) — NO pan
//   • Coin cascade — 20 coins rain from the sky with Bounce.out
//   • Pie-in-face — 🥧 drops on the host on wrong answers
//   • Dark navy bg (0x0a0a1a) + magenta + cyan stripes
//   • Arial Black title (neon yellow #ffeb3b + magenta stroke #ff00ff)
//   • Prompt: Arial Black + white text + cyan stroke
//   • Stage curtain backdrop + animated spotlight beams
//   • 3 lifeline hearts (visual + animated)
//   • Dramatic question reveal with scale-in animation
//   • Confetti burst on correct, screen shake on wrong
//   • Streak fire effect (flames around score at 3+ streak)
//   • Final round confetti rain finale
//   • ESL TTS via makeHoverSpeakable
// ============================================================================

interface GameshowRound {
  prompt: TermItem;
  options: TermItem[];
  correctIndex: number;
}

export default class GameshowScene extends BaseEngine {
  private round = 0;
  private rounds: GameshowRound[] = [];
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private lifelines = 3;
  private lifelineHearts: Phaser.GameObjects.Text[] = [];
  private canAnswer = true;
  private spotlights: Phaser.GameObjects.Container[] = [];
  private questionNumber = 0;

  // AAAA KIDS MODE — Supercharged spectacle additions
  private hostCharacter?: Phaser.GameObjects.Text;
  private hostBaseX = 0;
  private hostBaseY = 0;
  private _hostState: 'idle' | 'cheer' | 'dismay' = 'idle';
  private _hostBobTween?: Phaser.Tweens.Tween;
  private _hostSweepTween?: Phaser.Tweens.Tween;
  private neonBorders: Phaser.GameObjects.Rectangle[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // Build rounds
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    for (let i = 0; i < this.maxScore; i++) {
      const prompt = pool[i % pool.length];
      const distractors = pool.filter(t => t.id !== prompt.id);
      Phaser.Utils.Array.Shuffle(distractors);
      const options = [prompt, ...distractors.slice(0, 3)];
      Phaser.Utils.Array.Shuffle(options);
      this.rounds.push({
        prompt,
        options,
        correctIndex: options.findIndex(o => o.id === prompt.id),
      });
    }

    // ---- Stage curtain (top + bottom) ----
    this.drawCurtains();

    // ---- Spotlight beams (sweeping) ----
    for (let i = 0; i < 3; i++) {
      this.createSpotlight(i);
    }

    // ---- Neon borders (top + bottom pulsing rectangles) ----
    this._createNeonBorders();

    // ---- Host showman 🎤 (right side, animated) ----
    this._createHost();

    // ---- Title (Arial Black + neon yellow + magenta stroke) ----
    const titleBg = this.add.rectangle(
      this.scale.width / 2, 70, 320, 56, 0x0a0a1a, 0.85
    ).setStrokeStyle(3, 0xff00ff, 0.9).setDepth(50);
    this.add.text(
      this.scale.width / 2, 70,
      '🎯 GAMESHOW',
      {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '32px',
        color: '#ffeb3b',
        fontStyle: 'bold',
        stroke: '#ff00ff',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setDepth(51);
    void titleBg;

    // ---- Lifeline hearts (top-right) ----
    this.drawLifelines();

    // ---- Question number (top-left) ----
    this.add.text(
      20, 50,
      'Q 1',
      {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setDepth(50);

    // ---- Prompt banner (dark navy + cyan border 5px) ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 200, 660, 80, 0x0a0a1a, 0.95
    ).setStrokeStyle(5, 0x00ffff, 0.9).setDepth(48);
    // Magenta + cyan decorative stripes flanking the banner
    this.add.rectangle(
      this.scale.width / 2 - 332, 200, 4, 80, 0xff00ff, 0.9
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2 + 332, 200, 4, 80, 0xff00ff, 0.9
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2, 200 - 38, 660, 4, 0x00ffff, 0.85
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2, 200 + 38, 660, 4, 0x00ffff, 0.85
    ).setDepth(49);

    this.promptText = this.add.text(
      this.scale.width / 2, 200, '',
      {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#00ffff',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 600 },
      }
    ).setOrigin(0.5).setDepth(49);

    // AAAA KIDS MODE — Hover-speakable prompt (replaces plain tap-to-speak).
    this.makeHoverSpeakable(this.promptText);

    this.renderRound();

    // Global pointer handler for reliable button clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canAnswer) return;
      const r = this.rounds[this.round];
      if (!r) return;
      // Hit-test each option button
      this.optionButtons.forEach((btn, i) => {
        const btnW = 300, btnH = 85;
        if (Math.abs(x - btn.x) < btnW / 2 && Math.abs(y - btn.y) < btnH / 2) {
          // ESL: speak the option text before answering
          audioBus.speak(r.options[i].term);
          this.handleAnswer(btn, i, r.correctIndex, r.options[i]);
        }
      });
    });
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  // ===========================================================================
  // AAAA — Host showman 🎤
  // Idle: gentle bounce + sweep (left-right tilt). NOT tappable.
  // ===========================================================================
  private _createHost() {
    this.hostBaseX = this.scale.width - 80;
    this.hostBaseY = 300;
    this.hostCharacter = this.add.text(
      this.hostBaseX, this.hostBaseY, '🎤',
      {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Arial Black, sans-serif',
        fontSize: '56px',
      }
    ).setOrigin(0.5).setDepth(60);

    // Idle bounce.
    this._hostBobTween = this.tweens.add({
      targets: this.hostCharacter,
      y: this.hostBaseY - 8,
      duration: 900, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
    // Idle sweep (small angle oscillation — left/right).
    this._hostSweepTween = this.tweens.add({
      targets: this.hostCharacter,
      angle: { from: -6, to: 6 },
      duration: 1500, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
  }

  // Host jumps + 360° spin on correct answer.
  private _hostCheer() {
    if (!this.hostCharacter) return;
    try {
      this._hostState = 'cheer';
      try { this.tweens.killTweensOf(this.hostCharacter); } catch {}
      this.hostCharacter.setAngle(0);
      const startY = this.hostCharacter.y;

      // Jump up.
      this.tweens.add({
        targets: this.hostCharacter,
        y: this.hostBaseY - 60,
        duration: 240, yoyo: true, repeat: 1, ease: 'Quad.out',
      });
      // 360° spin.
      this.tweens.add({
        targets: this.hostCharacter,
        angle: 360,
        duration: 650, ease: 'Cubic.out',
        onComplete: () => {
          if (!this.hostCharacter) return;
          this.hostCharacter.setAngle(0);
          this.hostCharacter.y = startY;
          this._hostState = 'idle';
          this._hostBobTween = this.tweens.add({
            targets: this.hostCharacter,
            y: this.hostBaseY - 8,
            duration: 900, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
          this._hostSweepTween = this.tweens.add({
            targets: this.hostCharacter,
            angle: { from: -6, to: 6 },
            duration: 1500, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        },
      });
    } catch (e) {
      console.error('[GameshowScene] _hostCheer error:', e);
    }
  }

  // Host wobbles + ducks down on wrong answer.
  private _hostDismay() {
    if (!this.hostCharacter) return;
    try {
      this._hostState = 'dismay';
      try { this.tweens.killTweensOf(this.hostCharacter); } catch {}
      this.hostCharacter.setAngle(0);

      // Duck down + wobble.
      this.tweens.add({
        targets: this.hostCharacter,
        y: this.hostBaseY + 20,
        duration: 220, yoyo: true, repeat: 1, ease: 'Quad.out',
      });
      this.tweens.add({
        targets: this.hostCharacter,
        angle: { from: -15, to: 15 },
        duration: 180, yoyo: true, repeat: 3, ease: 'Sine.inOut',
        onComplete: () => {
          if (!this.hostCharacter) return;
          this.hostCharacter.setAngle(0);
          this._hostState = 'idle';
          this._hostBobTween = this.tweens.add({
            targets: this.hostCharacter,
            y: this.hostBaseY - 8,
            duration: 900, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
          this._hostSweepTween = this.tweens.add({
            targets: this.hostCharacter,
            angle: { from: -6, to: 6 },
            duration: 1500, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        },
      });
    } catch (e) {
      console.error('[GameshowScene] _hostDismay error:', e);
    }
  }

  // ===========================================================================
  // AAAA — Neon borders (top + bottom pulsing rectangles)
  // ===========================================================================
  private _createNeonBorders() {
    const top = this.add.rectangle(
      this.scale.width / 2, 4, this.scale.width, 6, 0x00ffff, 0.9
    ).setStrokeStyle(2, 0xff00ff, 0.7).setDepth(45);
    const bottom = this.add.rectangle(
      this.scale.width / 2, this.scale.height - 4, this.scale.width, 6, 0x00ffff, 0.9
    ).setStrokeStyle(2, 0xff00ff, 0.7).setDepth(45);
    this.neonBorders.push(top, bottom);

    // Pulse: alpha 0.6 ↔ 1.0 + scaleY 0.6 ↔ 1.2 forever.
    this.tweens.add({
      targets: top,
      alpha: { from: 0.6, to: 1.0 },
      scaleY: { from: 0.6, to: 1.4 },
      duration: 700, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: bottom,
      alpha: { from: 1.0, to: 0.6 },
      scaleY: { from: 1.4, to: 0.6 },
      duration: 700, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
  }

  // ===========================================================================
  // AAAA — Arcade buzzer sink (button sinks + bounces back + whack SFX)
  // ===========================================================================
  private _arcadeBuzzerSink(btn: Phaser.GameObjects.Container) {
    try {
      audioBus.play('whack');
      const baseY = btn.y;
      this.tweens.add({
        targets: btn,
        y: baseY + 14,
        scaleY: 0.85,
        duration: 90, ease: 'Quad.out',
        onComplete: () => {
          this.tweens.add({
            targets: btn,
            y: baseY,
            scaleY: 1,
            duration: 280, ease: 'Bounce.out',
          });
        },
      });
    } catch {}
  }

  // ===========================================================================
  // AAAA — Camera zoom (zoomTo only, NEVER pan) — zoomTo 1.06 on correct.
  // CRITICAL: This scene must NEVER pan the camera (causes freeze).
  // ===========================================================================
  private _cameraZoom() {
    try {
      this.cameras.main.zoomTo(1.06, 220, 'Quad.out');
    } catch {}
  }

  private _cameraReset() {
    try {
      this.cameras.main.zoomTo(1, 260, 'Quad.in');
    } catch {}
  }

  // ===========================================================================
  // AAAA — Coin cascade (20 coins fall with Bounce.out)
  // ===========================================================================
  private _coinCascade(x: number, y: number) {
    const coinEmoji = '🪙';
    for (let i = 0; i < 20; i++) {
      const coin = this.add.text(
        x + (Math.random() - 0.5) * 200, -30 - i * 20, coinEmoji,
        {
          fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Arial Black, sans-serif',
          fontSize: '24px',
        }
      ).setOrigin(0.5).setDepth(70);

      const targetY = y + (Math.random() - 0.5) * 80;
      this.tweens.add({
        targets: coin,
        y: targetY,
        duration: 700 + Math.random() * 300, delay: i * 35,
        ease: 'Bounce.out',
        onComplete: () => {
          // Fade + shrink after landing.
          this.tweens.add({
            targets: coin,
            alpha: 0, scale: 0.5,
            duration: 500, delay: 200, ease: 'Cubic.in',
            onComplete: () => { try { coin.destroy(); } catch {} },
          });
        },
      });
      // Spin while falling.
      this.tweens.add({
        targets: coin,
        angle: 360,
        duration: 400, repeat: 2, ease: 'Linear',
      });
    }
  }

  // ===========================================================================
  // AAAA — Pie-in-face (🥧 drops on host)
  // ===========================================================================
  private _pieInFace() {
    if (!this.hostCharacter) return;
    try {
      const pie = this.add.text(
        this.hostBaseX, this.hostBaseY - 200, '🥧',
        {
          fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Arial Black, sans-serif',
          fontSize: '48px',
        }
      ).setOrigin(0.5).setDepth(75);

      // Drop onto host.
      this.tweens.add({
        targets: pie,
        y: this.hostBaseY,
        duration: 380, ease: 'Cubic.in',
        onComplete: () => {
          // Splat: scale + fade.
          this.tweens.add({
            targets: pie,
            scale: 1.6, alpha: 0,
            duration: 600, ease: 'Cubic.out',
            onComplete: () => { try { pie.destroy(); } catch {} },
          });
        },
      });
      // Spin pie while falling.
      this.tweens.add({
        targets: pie,
        angle: 180,
        duration: 380, ease: 'Quad.in',
      });
    } catch {}
  }

  private drawCurtains() {
    // Top curtain (scalloped)
    const curtainColor = 0x7f1d1d;
    for (let x = 0; x < this.scale.width; x += 40) {
      const drape = this.add.arc(x + 20, 0, 28, 0, 180, false, curtainColor, 0.8);
      drape.setDepth(-2);
    }
    // Bottom curtain
    for (let x = 0; x < this.scale.width; x += 40) {
      const drape = this.add.arc(x + 20, this.scale.height, 28, 180, 360, false, curtainColor, 0.8);
      drape.setDepth(-2);
    }
    // Gold tassels
    for (let x = 0; x < this.scale.width; x += 40) {
      this.add.circle(x + 20, 28, 3, 0xfbbf24, 0.9).setDepth(-1);
      this.add.circle(x + 20, this.scale.height - 28, 3, 0xfbbf24, 0.9).setDepth(-1);
    }
  }

  private createSpotlight(index: number) {
    const beam = this.add.container(0, 0).setDepth(-1);
    // Beam (triangle pointing down from top)
    const gfx = this.add.graphics();
    const colors = [this.theme.accent, this.theme.accent2, this.theme.warning];
    gfx.fillStyle(colors[index % 3], 0.08);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(-80, 600);
    gfx.lineTo(80, 600);
    gfx.closePath();
    gfx.fillPath();
    beam.add(gfx);

    // Light source (circle at top)
    const source = this.add.circle(0, 0, 8, colors[index % 3], 0.6);
    beam.add(source);

    // Sweep animation
    const startX = 150 + index * 250;
    beam.setPosition(startX, 0);
    this.tweens.add({
      targets: beam,
      x: startX + 200 * (index % 2 === 0 ? 1 : -1),
      angle: index % 2 === 0 ? 15 : -15,
      duration: 5000 + index * 2000,
      yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
    this.spotlights.push(beam);
  }

  private drawLifelines() {
    // Heart icons in top-right
    const heartX = this.scale.width - 30;
    const heartY = 55;
    for (let i = 0; i < 3; i++) {
      const heart = this.add.text(
        heartX - i * 30, heartY, '❤',
        {
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: '26px',
        }
      ).setOrigin(0.5).setDepth(50);
      this.lifelineHearts.push(heart);
      // Gentle pulse
      this.tweens.add({
        targets: heart,
        scale: { from: 1, to: 1.1 },
        duration: 800 + i * 200, yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });
    }
  }

  private renderRound() {
    if (this.round >= this.rounds.length || this.lifelines <= 0) {
      // Grand finale
      if (this.lifelines > 0 && this.score >= this.maxScore * 0.6) {
        this.juice.confettiRain(3000);
        // REMOVED zoomPunch — causes camera freeze; replaced with explicit _cameraZoom.
      }
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }
    this.canAnswer = true;
    this.questionNumber++;
    const r = this.rounds[this.round];
    const promptText = `"${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"`;
    this.promptText.setText(promptText);
    this.promptText.setData('speakText', promptText);

    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    const promptSpeech = r.prompt.definition ?? r.prompt.term;
    this.time.delayedCall(300, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, promptSpeech, { isQuestion: true });
    });

    // Dramatic reveal animation
    this.promptBg.setScale(0).setAlpha(0);
    this.promptText.setAlpha(0);
    this.tweens.add({
      targets: [this.promptBg, this.promptText],
      scale: 1, alpha: 1,
      duration: 400, ease: 'Back.out',
    });

    this.optionButtons.forEach(b => b.destroy());
    this.optionButtons = [];

    const cols = 2, rows = 2;
    const btnW = 300, btnH = 85;
    const gapX = 20, gapY = 20;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 340;
    const letters = ['A', 'B', 'C', 'D'];
    const btnColors = [0x3b82f6, 0xef4444, 0xfbbf24, 0x22c55e];

    r.options.forEach((opt, i) => {
      const cx = startX + (i % cols) * (btnW + gapX);
      const cy = startY + Math.floor(i / cols) * (btnH + gapY);

      // Button background (dark navy + neon colored stripe)
      const bg = this.add.rectangle(0, 0, btnW, btnH, 0x0a0a1a, 0.95)
        .setStrokeStyle(3, btnColors[i], 0.9);
      // Color stripe on left
      const stripe = this.add.rectangle(-btnW / 2 + 6, 0, 8, btnH - 6, btnColors[i], 1);
      // Letter badge
      const letterBg = this.add.circle(-btnW / 2 + 35, 0, 18, btnColors[i], 0.9);
      const letterTxt = this.add.text(-btnW / 2 + 35, 0, letters[i], {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      // Option text (Arial Black, white)
      const txt = this.add.text(20, 0, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(cx, cy, [bg, stripe, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);

      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(0x1a1a2e, 1);
          bg.setStrokeStyle(4, btnColors[i], 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        bg.setFillStyle(0x0a0a1a, 0.95);
        bg.setStrokeStyle(3, btnColors[i], 0.9);
      });
      // NOTE: per-container pointerdown removed — global handler handles answer taps.

      // Dramatic entrance: drop from above
      container.setAlpha(0).setY(cy - 60);
      this.tweens.add({
        targets: container,
        alpha: 1, y: cy,
        duration: 400, delay: i * 100, ease: 'Back.out',
      });

      this.optionButtons.push(container);
    });
  }

  private handleAnswer(
    btn: Phaser.GameObjects.Container,
    index: number,
    correctIndex: number,
    option: TermItem
  ) {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    const isCorrect = index === correctIndex;
    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;

    this.recordAnswer({
      term: this.rounds[this.round].prompt.term,
      response: option.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (isCorrect) {
      try {
        bg.setFillStyle(this.theme.success, 1);
        bg.setStrokeStyle(5, this.theme.success, 1);
        // AAAA — Arcade buzzer sink + camera zoom + coin cascade + host cheer.
        this._arcadeBuzzerSink(btn);
        this._cameraZoom();
        this._coinCascade(btn.x, btn.y);
        this._hostCheer();
        this.juice.squash(btn, 1.2);
        this.juice.burst(btn.x, btn.y, 'correct');
        audioBus.play('correct');
        // Spotlight flash on correct answer
        const flash = this.add.circle(btn.x, btn.y, 100, this.theme.success, 0.3).setDepth(45);
        this.tweens.add({
          targets: flash,
          scale: 3, alpha: 0,
          duration: 500, ease: 'Cubic.out',
          onComplete: () => { try { flash.destroy(); } catch {} },
        });
      } catch (e) { /* ignore animation errors */ }
    } else {
      try {
        bg.setFillStyle(this.theme.danger, 1);
        bg.setStrokeStyle(5, this.theme.danger, 1);
        // AAAA — Arcade buzzer sink + pie-in-face + host dismay + whomp-whomp sound.
        this._arcadeBuzzerSink(btn);
        this._pieInFace();
        this._hostDismay();
        // Whomp-whomp sound: descending tone (whack) followed by a second whomp.
        audioBus.play('whack');
        this.time.delayedCall(220, () => { try { audioBus.play('incorrect'); } catch {} });
        this.time.delayedCall(420, () => { try { audioBus.play('whack'); } catch {} });

        this.lifelines--;
        // Update heart display safely
        const heart = this.lifelineHearts[this.lifelines];
        if (heart) {
          heart.setText('💔');
        }
        // Highlight the correct answer with pulsing green flash
        const correctBtn = this.optionButtons[correctIndex];
        const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
        cBg.setFillStyle(this.theme.success, 0.8);
        cBg.setStrokeStyle(5, this.theme.success, 1);
        // Pulsing animation on correct answer
        this.tweens.add({
          targets: correctBtn,
          scale: { from: 1, to: 1.15 },
          duration: 300, yoyo: true, repeat: 2, ease: 'Sine.inOut',
        });
        // Green glow ring
        this.juice.glowRing(correctBtn.x, correctBtn.y, this.theme.success, 80);
        // Speak the correct answer
        this.time.delayedCall(300, () => {
          audioBus.speak(`The answer is ${this.rounds[this.round].options[correctIndex].term}`);
        });
        this.juice.shake('heavy');
        this.juice.burst(btn.x, btn.y, 'incorrect');
        audioBus.play('incorrect');
      } catch (e) { /* ignore animation errors */ }
    }

    // Always advance to next round after delay (prevents freezing).
    // AAAA — Reset camera zoom BEFORE advancing round (NO pan anywhere).
    this.time.delayedCall(1200, () => {
      try { this._cameraReset(); } catch {}
      this.round++;
      this.renderRound();
    });
  }
}
