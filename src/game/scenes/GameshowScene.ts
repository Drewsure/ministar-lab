import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// GAMESHOW QUIZ — Selection Engine  (AAA 2029 edition)
// ============================================================================
// Premium gameshow experience with:
//   • Animated spotlight beams sweeping across the stage
//   • Stage curtain backdrop
//   • 3 lifeline hearts (visual + animated)
//   • Dramatic question reveal with scale-in animation
//   • Confetti burst on correct, screen shake on wrong
//   • Audience "ooh" / "aah" audio feedback
//   • Streak fire effect (flames around score at 3+ streak)
//   • Final round confetti rain finale
//   • ESL TTS on every question
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
  // AAAA "Supercharged Spectacle" state
  private hostCharacter?: Phaser.GameObjects.Text;
  private hostBaseX = 0;
  private hostBaseY = 0;
  private neonBorders: Phaser.GameObjects.Rectangle[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 5); }

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

    // ---- Title (AAAA Supercharged Spectacle — Arial Black neon yellow + magenta glow) ----
    const titleBg = this.add.rectangle(
      this.scale.width / 2, 70, 300, 54, 0x000000, 0.7
    ).setStrokeStyle(3, 0xff00ff, 0.9).setDepth(50);
    this.add.text(
      this.scale.width / 2, 70,
      '🎯 GAMESHOW',
      {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '32px',
        color: '#ffeb3b',
        stroke: '#ff00ff',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(51);
    void titleBg;

    // ---- AAAA Host showman 🎤 + neon stage borders ----
    this._createHost();
    this._createNeonBorders();

    // ---- Lifeline hearts (top-right) ----
    this.drawLifelines();

    // ---- Question number (top-left) ----
    this.add.text(
      20, 50,
      'Q 1',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setDepth(50);

    // ---- Prompt banner (AAAA — dark navy 0x0a0a1a "TV screen" + cyan 0x00ffff neon border + magenta/cyan double stripes) ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 200, 660, 80, 0x0a0a1a, 0.92
    ).setStrokeStyle(5, 0x00ffff, 0.9).setDepth(48);
    // Double-line TV-screen stripes (magenta outer + cyan inner) — top + bottom
    this.add.rectangle(
      this.scale.width / 2, 200 - 40, 660, 3, 0xff00ff, 0.95
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2, 200 - 36, 660, 2, 0x00ffff, 0.95
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2, 200 + 40, 660, 3, 0xff00ff, 0.95
    ).setDepth(49);
    this.add.rectangle(
      this.scale.width / 2, 200 + 36, 660, 2, 0x00ffff, 0.95
    ).setDepth(49);

    this.promptText = this.add.text(
      this.scale.width / 2, 200, '',
      {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#00ffff',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: 600 },
      }
    ).setOrigin(0.5).setDepth(49);
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
          fontFamily: 'Inter, sans-serif',
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
        // REMOVED zoomPunch — causes camera freeze;
      }
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }
    this.canAnswer = true;
    this.questionNumber++;
    const r = this.rounds[this.round];
    this.promptText.setText(`"${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"`);

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

      // Button background
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, btnColors[i], 0.7);
      // Color stripe on left
      const stripe = this.add.rectangle(-btnW / 2 + 6, 0, 8, btnH - 6, btnColors[i], 1);
      // Letter badge
      const letterBg = this.add.circle(-btnW / 2 + 35, 0, 18, btnColors[i], 0.9);
      const letterTxt = this.add.text(-btnW / 2 + 35, 0, letters[i], {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      // Option text
      const txt = this.add.text(20, 0, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(cx, cy, [bg, stripe, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);

      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          bg.setStrokeStyle(4, btnColors[i], 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        bg.setFillStyle(this.theme.card, 0.95);
        bg.setStrokeStyle(3, btnColors[i], 0.7);
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
      // AAAA Supercharged Spectacle — arcade buzzer sink + camera zoom + coin cascade + host cheer
      this._arcadeBuzzerSink(btn);
      this._cameraZoom(btn.x, btn.y);
      this._coinCascade();
      this._hostCheer();
    } else {
      try {
        bg.setFillStyle(this.theme.danger, 1);
        bg.setStrokeStyle(5, this.theme.danger, 1);
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
      // AAAA Supercharged Spectacle — arcade buzzer sink + pie-in-face + host dismay + whomp-whomp
      this._arcadeBuzzerSink(btn);
      this._pieInFace();
      this._hostDismay();
      this.time.delayedCall(150, () => { try { audioBus.play('hover', { freq: 300 }); } catch {} });
      this.time.delayedCall(350, () => { try { audioBus.play('hover', { freq: 200 }); } catch {} });
    }

    // Always advance to next round after delay (prevents freezing)
    this.time.delayedCall(1200, () => {
      this._cameraReset();
      this.round++;
      this.renderRound();
    });
  }

  // ===========================================================================
  // AAAA "SUPERCHARGED SPECTACLE" — host showman 🎤, neon stage borders,
  // arcade buzzer sink, camera zoom (NO pan — pan moves content off-frame),
  // coin cascade 💰🪙💎⭐, pie-in-face 🥧💨, host cheer / dismay.
  // ===========================================================================

  /** 🎤 Host showman — sits at (width-80, 300), idle bounce + sweeping x drift every 4s. */
  private _createHost() {
    const x = this.scale.width - 80;
    const y = 300;
    this.hostBaseX = x;
    this.hostBaseY = y;
    this.hostCharacter = this.add.text(x, y, '🎤', {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '48px',
    }).setOrigin(0.5).setDepth(60);

    // Idle bounce (gentle float)
    this.tweens.add({
      targets: this.hostCharacter,
      y: y - 10,
      duration: 700,
      yoyo: true,
      repeat: 999,
      ease: 'Sine.inOut',
    });

    // Sweeping x movement every 4s (showman pacing the stage)
    this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => {
        if (!this.hostCharacter || !this.hostCharacter.active) return;
        const driftX = this.hostBaseX + (Math.random() * 40 - 20);
        this.tweens.add({
          targets: this.hostCharacter,
          x: driftX,
          duration: 2000,
          yoyo: true,
          ease: 'Sine.inOut',
        });
      },
    });
  }

  /** Host cheer — jump up 60px + 360° spin on a correct answer. */
  private _hostCheer() {
    if (!this.hostCharacter || !this.hostCharacter.active) return;
    const baseY = this.hostBaseY;
    this.tweens.add({
      targets: this.hostCharacter,
      y: baseY - 60,
      duration: 250,
      yoyo: true,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: this.hostCharacter,
      angle: 360,
      duration: 500,
      ease: 'Cubic.out',
      onComplete: () => {
        if (this.hostCharacter) this.hostCharacter.setAngle(0);
      },
    });
  }

  /** Host dismay — wobble angle -5..+5 + duck down 15px on a wrong answer. */
  private _hostDismay() {
    if (!this.hostCharacter || !this.hostCharacter.active) return;
    const baseY = this.hostBaseY;
    this.tweens.add({
      targets: this.hostCharacter,
      y: baseY + 15,
      duration: 200,
      yoyo: true,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: this.hostCharacter,
      angle: { from: -5, to: 5 },
      duration: 120,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        if (this.hostCharacter) this.hostCharacter.setAngle(0);
      },
    });
  }

  /** Neon stage borders — top + bottom rectangles (warning color, depth 44),
   *  pulsing alpha 0.5↔1.0 every 400ms. */
  private _createNeonBorders() {
    const w = this.scale.width;
    const h = this.scale.height;
    const top = this.add.rectangle(w / 2, 6, w, 6, this.theme.warning, 1).setDepth(44);
    const bot = this.add.rectangle(w / 2, h - 6, w, 6, this.theme.warning, 1).setDepth(44);
    this.neonBorders.push(top, bot);
    [top, bot].forEach((r) => {
      this.tweens.add({
        targets: r,
        alpha: { from: 1, to: 0.5 },
        duration: 400,
        yoyo: true,
        repeat: 999,
        ease: 'Sine.inOut',
      });
    });
  }

  /** Arcade buzzer sink — button sinks y+8, scaleY 0.85 for 60ms, then bounces
   *  back y-8 scaleY 1 via Back.out 200ms. Plays 'whack' at 150Hz. */
  private _arcadeBuzzerSink(container: Phaser.GameObjects.Container) {
    try {
      const baseY = container.y;
      const baseScaleY = container.scaleY;
      this.tweens.add({
        targets: container,
        y: baseY + 8,
        scaleY: baseScaleY * 0.85,
        duration: 60,
        ease: 'Quad.in',
        onComplete: () => {
          this.tweens.add({
            targets: container,
            y: baseY - 8,
            scaleY: baseScaleY,
            duration: 200,
            ease: 'Back.out',
            onComplete: () => {
              container.y = baseY;
              container.scaleY = baseScaleY;
            },
          });
        },
      });
      audioBus.play('whack', { freq: 150 });
    } catch { /* ignore animation errors */ }
  }

  /** Camera zoom-in on the answer (zoomTo 1.06, 200ms, Sine.easeInOut).
   *  NO pan — pan moves content off-frame and freezes the camera. */
  private _cameraZoom(_x: number, _y: number) {
    try {
      this.cameras.main.zoomTo(1.06, 200, 'Sine.easeInOut');
    } catch { /* ignore camera errors */ }
  }

  /** Camera reset to 1.0 zoom before the next round (zoomTo 1, 300ms, Sine.easeInOut). NO pan. */
  private _cameraReset() {
    try {
      this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');
    } catch { /* ignore camera errors */ }
  }

  /** Coin cascade — 20 coins (💰🪙💎⭐) fall from top with Bounce.out,
   *  random x drift + full rotation. */
  private _coinCascade() {
    try {
      const coins = ['💰', '🪙', '💎', '⭐'];
      const w = this.scale.width;
      for (let i = 0; i < 20; i++) {
        const startX = Math.random() * w;
        const drift = (Math.random() - 0.5) * 120;
        const emoji = coins[i % coins.length];
        const coin = this.add.text(startX, -30, emoji, {
          fontFamily: 'Arial Black, Impact, sans-serif',
          fontSize: '28px',
        }).setOrigin(0.5).setDepth(70);
        this.tweens.add({
          targets: coin,
          y: this.scale.height + 40,
          x: startX + drift,
          angle: Math.random() * 720 - 360,
          duration: 1400 + Math.random() * 600,
          ease: 'Bounce.out',
          onComplete: () => { try { coin.destroy(); } catch {} },
        });
      }
    } catch { /* ignore animation errors */ }
  }

  /** Pie-in-face — 🥧 drops from above onto host (Cubic.in), then splats into 💨 smoke puff. */
  private _pieInFace() {
    try {
      if (!this.hostCharacter || !this.hostCharacter.active) return;
      const targetX = this.hostCharacter.x;
      const targetY = this.hostCharacter.y;
      const pie = this.add.text(targetX, -40, '🥧', {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '40px',
      }).setOrigin(0.5).setDepth(71);
      this.tweens.add({
        targets: pie,
        y: targetY,
        duration: 450,
        ease: 'Cubic.in',
        onComplete: () => {
          try { pie.setText('💨'); } catch {}
          this.tweens.add({
            targets: pie,
            alpha: 0,
            scale: 1.6,
            duration: 500,
            ease: 'Sine.out',
            onComplete: () => { try { pie.destroy(); } catch {} },
          });
        },
      });
    } catch { /* ignore animation errors */ }
  }
}
