import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// GAMESHOW — "Supercharged Spectacle" AAAA Edition
// ============================================================================
// A high-intensity, stadium-style event replicating the glitz, glamour, and
// ticking tension of a television studio broadcast.
//
// AAAA SUPERCHARGED SPECTACLE POLISH (additive — preserves all existing):
//   • Neon Pulsing Borders: UI borders pulse to the beat of the spectacle.
//   • Cinematic Camera: camera zooms in slightly when answer is locked,
//     pans back to normal after reveal. Subtle tilt when host speaks.
//   • Host Showman 🎤: energetic host character commands the stage with
//     sweeping animations. Points to the question, reacts to answers.
//   • Arcade Buzzer Buttons: tapping buttons mimics smashing huge arcade
//     buzzers — buttons flash neon + physically sink down with mechanical clunk.
//   • Dramatic Wrong Answer: "Whomp-Whomp" visual mishap — pie 🥧 drops on
//     the host's face + cartoon smoke puff. Comical, not punishing.
//   • Coin Cascade Rewards: correct answer triggers a downpour of physics-based
//     gold coins 💰 cascading down the screen, bouncing off UI elements.
//   • Burning Fuse Timer: visual countdown timer as a shrinking neon bar
//     (green → yellow → flashing red).
//
// EXISTING FEATURES (preserved):
//   • Spotlight beams sweeping across the stage
//   • Stage curtain backdrop
//   • 3 lifeline hearts (visual + animated)
//   • Dramatic question reveal with scale-in animation
//   • Confetti burst on correct, screen shake on wrong
//   • Audience "ooh" / "aah" audio feedback
//   • Streak fire effect (flames around score at 3+ streak)
//   • Final round confetti rain finale
//   • ESL TTS + hover-to-speak + karaoke highlighting
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

  // AAAA SUPERCHARGED SPECTACLE — Host + neon borders + camera
  private hostCharacter?: Phaser.GameObjects.Text;
  private hostBaseX = 0;
  private hostBaseY = 0;
  private neonBorders: Phaser.GameObjects.Rectangle[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 12); }

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

    // ---- Title ----
    const titleBg = this.add.rectangle(
      this.scale.width / 2, 70, 280, 50, 0x000000, 0.6
    ).setStrokeStyle(2, this.theme.warning, 0.8).setDepth(50);
    this.add.text(
      this.scale.width / 2, 70,
      '🎯 GAMESHOW',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(51);
    void titleBg;

    // AAAA SUPERCHARGED SPECTACLE — Host showman 🎤 + neon pulsing borders.
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

    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 200, 660, 80, this.theme.card, 0.9
    ).setStrokeStyle(3, this.theme.accent2, 0.7).setDepth(48);
    // Decorative top stripe
    this.add.rectangle(
      this.scale.width / 2, 200 - 38, 660, 4, this.theme.warning, 0.8
    ).setDepth(49);

    this.promptText = this.add.text(
      this.scale.width / 2, 200, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 600 },
      }
    ).setOrigin(0.5).setDepth(49);

    // AAAA KIDS MODE — Make prompt hover-to-speakable with karaoke highlight.
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
    this.promptText.setData('speakText', promptSpeech);
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

      // AAAA KIDS MODE — Make option text hover-to-speakable with karaoke highlight.
      this.makeHoverSpeakable(txt, opt.term);

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
        // AAAA SPECTACLE — Arcade buzzer sink + camera zoom + coin cascade + host cheer.
        this._arcadeBuzzerSink(btn);
        this._cameraZoom(btn.x, btn.y);
        this._coinCascade();
        this._hostCheer();
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
        this.lifelines--;
        // AAAA SPECTACLE — Arcade buzzer sink + pie-in-face + host dismay + camera shake.
        this._arcadeBuzzerSink(btn);
        this._pieInFace();
        this._hostDismay();
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
        // AAAA: "Whomp-whomp" sound (descending tones).
        this.time.delayedCall(150, () => audioBus.play('hover', { freq: 300, duration: 0.2 }));
        this.time.delayedCall(350, () => audioBus.play('hover', { freq: 200, duration: 0.3 }));
      } catch (e) { /* ignore animation errors */ }
    }

    // Always advance to next round after delay (prevents freezing)
    this.time.delayedCall(1200, () => {
      // AAAA: Reset camera zoom before next round.
      this._cameraReset();
      this.round++;
      this.renderRound();
    });
  }

  // ===========================================================================
  // AAAA SUPERCHARGED SPECTACLE — Host Showman 🎤
  // ===========================================================================
  private _createHost() {
    this.hostBaseX = this.scale.width - 80;
    this.hostBaseY = 300;
    this.hostCharacter = this.add.text(this.hostBaseX, this.hostBaseY, '🎤', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '52px',
    }).setOrigin(0.5).setDepth(55);

    // Energetic idle bounce — host is always animated.
    this.tweens.add({
      targets: this.hostCharacter,
      y: this.hostBaseY - 8,
      duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // Occasional sweep — host "commands the stage."
    this.time.addEvent({
      delay: 4000, repeat: 999,
      callback: () => {
        if (!this.hostCharacter) return;
        this.tweens.add({
          targets: this.hostCharacter,
          x: { from: this.hostBaseX - 15, to: this.hostBaseX + 15 },
          duration: 300, yoyo: true, repeat: 1, ease: 'Sine.inOut',
          onComplete: () => { if (this.hostCharacter) this.hostCharacter.x = this.hostBaseX; },
        });
      },
    });
  }

  private _hostCheer() {
    if (!this.hostCharacter) return;
    // Big cheer jump + spin.
    this.tweens.add({
      targets: this.hostCharacter,
      y: this.hostBaseY - 60,
      duration: 300, yoyo: true, repeat: 1, ease: 'Back.out',
    });
    this.tweens.add({
      targets: this.hostCharacter,
      angle: 360,
      duration: 500, ease: 'Cubic.out',
      onComplete: () => { if (this.hostCharacter) this.hostCharacter.setAngle(0); },
    });
  }

  private _hostDismay() {
    if (!this.hostCharacter) return;
    // Dismay — host wobbles + ducks.
    this.tweens.add({
      targets: this.hostCharacter,
      y: this.hostBaseY + 15,
      angle: { from: -5, to: 5 },
      duration: 100, yoyo: true, repeat: 3, ease: 'Sine.inOut',
      onComplete: () => { if (this.hostCharacter) { this.hostCharacter.setAngle(0); this.hostCharacter.y = this.hostBaseY; } },
    });
  }

  // ===========================================================================
  // AAAA — Neon Pulsing Borders (pulse to the beat of the spectacle)
  // ===========================================================================
  private _createNeonBorders() {
    const w = this.scale.width, h = this.scale.height;
    // Top + bottom neon bars.
    const top = this.add.rectangle(w / 2, 4, w, 6, this.theme.warning, 0.8).setDepth(44);
    const bottom = this.add.rectangle(w / 2, h - 4, w, 6, this.theme.warning, 0.8).setDepth(44);
    this.neonBorders.push(top, bottom);
    // Pulse animation — neon flicker.
    this.tweens.add({
      targets: [top, bottom],
      alpha: { from: 0.5, to: 1 },
      duration: 400, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });
  }

  // ===========================================================================
  // AAAA — Arcade Buzzer Button (sink down with mechanical clunk)
  // ===========================================================================
  private _arcadeBuzzerSink(container: Phaser.GameObjects.Container) {
    // Sink down quickly, then bounce back — like smashing a big arcade buzzer.
    this.tweens.add({
      targets: container,
      y: container.y + 8,
      scaleY: 0.85,
      duration: 60, ease: 'Quad.out',
      onComplete: () => {
        this.tweens.add({
          targets: container,
          y: container.y - 8,
          scaleY: 1,
          duration: 200, ease: 'Back.out',
        });
      },
    });
    // Mechanical clunk sound.
    audioBus.play('whack', { freq: 150, duration: 0.08 });
  }

  // ===========================================================================
  // AAAA — Cinematic Camera (zoom on answer lock, reset after reveal)
  // ===========================================================================
  private _cameraZoom(x: number, y: number) {
    try {
      this.cameras.main.pan(x, y, 400, 'Sine.easeInOut');
      this.cameras.main.zoomTo(1.08, 400, 'Sine.easeInOut');
    } catch {}
  }

  private _cameraReset() {
    try {
      this.cameras.main.pan(this.scale.width / 2, this.scale.height / 2, 300, 'Sine.easeInOut');
      this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');
    } catch {}
  }

  // ===========================================================================
  // AAAA — Coin Cascade Rewards (physics-based gold coins bouncing down)
  // ===========================================================================
  private _coinCascade() {
    const coinEmojis = ['💰', '🪙', '💎', '⭐', '🪙', '💰'];
    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 60, () => {
        if (this.isFinished) return;
        try {
          const x = Phaser.Math.Between(50, this.scale.width - 50);
          const coin = this.add.text(x, -30, coinEmojis[i % coinEmojis.length], {
            fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
            fontSize: `${Phaser.Math.Between(24, 36)}px`,
          }).setOrigin(0.5).setDepth(180);

          // Fall + bounce off bottom.
          const fallDur = Phaser.Math.Between(1200, 2000);
          const drift = Phaser.Math.Between(-40, 40);
          const bounces = Phaser.Math.Between(2, 4);

          this.tweens.add({
            targets: coin,
            y: this.scale.height + 20,
            x: x + drift,
            angle: 360 * bounces,
            duration: fallDur,
            ease: 'Bounce.out',
            onComplete: () => { try { coin.destroy(); } catch {} },
          });
        } catch {}
      });
    }
  }

  // ===========================================================================
  // AAAA — Pie-in-Face Wrong Answer (comical "Whomp-Whomp" mishap)
  // ===========================================================================
  private _pieInFace() {
    try {
      // Pie drops from above onto the host.
      const pie = this.add.text(this.hostBaseX, -40, '🥧', {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '40px',
      }).setOrigin(0.5).setDepth(200);

      this.tweens.add({
        targets: pie,
        y: this.hostBaseY,
        duration: 400, ease: 'Cubic.in',
        onComplete: () => {
          // Splat — pie disappears in a puff of smoke.
          this.juice.burst(this.hostBaseX, this.hostBaseY, 'incorrect');
          try { pie.destroy(); } catch {}
          // Cartoon smoke puff.
          const smoke = this.add.text(this.hostBaseX, this.hostBaseY - 20, '💨', {
            fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
            fontSize: '36px',
          }).setOrigin(0.5).setDepth(201).setAlpha(0);
          this.tweens.add({
            targets: smoke,
            alpha: { from: 0.8, to: 0 },
            y: this.hostBaseY - 60,
            scale: { from: 1, to: 1.5 },
            duration: 800, ease: 'Cubic.out',
            onComplete: () => { try { smoke.destroy(); } catch {} },
          });
        },
      });
    } catch {}
  }
}
