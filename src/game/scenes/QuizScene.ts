import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// QUIZ STORYBOOK — Living Storybook  (AAAA 2029 edition)
// ============================================================================
// Premium multiple-choice quiz rendered as a warm storybook:
//   • Storybook mascot 🦊 that nods gently on wrong, bounces + spins on correct
//   • Squishy hover (squash to scaleX 1.08 / scaleY 0.92) + squishy tap pop
//   • Ripple ring (4 colorful expanding circles) on correct answers
//   • Bouncy background emojis (6 corner deco emojis that bounce on tap)
//   • Georgia serif title + cream paper background + warm gold borders
//   • Page-turn transition: option buttons slide LEFT with -8° tilt,
//     promptBg + promptText also page-turn
//   • Per-question timer (10s) with visual countdown ring
//   • 50/50 lifeline + Skip lifeline
//   • Letter-labeled buttons (A, B, C, D)
//   • Streak multiplier (x2 at 3 streak, x3 at 5)
//   • Spaced repetition: wrong answers resurface later
//   • ESL TTS via makeHoverSpeakable — hover or tap prompt to hear it
// ============================================================================

interface QuizRound {
  prompt: TermItem;
  options: TermItem[];
  correctIndex: number;
}

// AAAA KIDS MODE — Bouncy background deco emoji
interface BouncyDeco {
  text: Phaser.GameObjects.Text;
  baseX: number;
  baseY: number;
}

export default class QuizScene extends BaseEngine {
  private round = 0;
  private rounds: QuizRound[] = [];
  private wrongQueue: QuizRound[] = []; // Spaced repetition: wrong answers resurface
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;
  private timeBar!: Phaser.GameObjects.Rectangle;
  private lifelinesUsed = { fiftyFifty: false, skip: false };
  private questionTimer = 10;
  private questionTimerEvent?: Phaser.Time.TimerEvent;
  private timerRing!: Phaser.GameObjects.Arc;
  private timerText!: Phaser.GameObjects.Text;
  private streakMultText!: Phaser.GameObjects.Text;
  private fiftyFiftyBtn!: Phaser.GameObjects.Container;
  private skipBtn!: Phaser.GameObjects.Container;

  // AAAA KIDS MODE — Living Storybook additions
  private storyMascot?: Phaser.GameObjects.Text;
  private storyMascotBaseX = 80;
  private storyMascotBaseY = 250;
  private _bouncyDecos: BouncyDeco[] = [];
  private _storybookMascotState: 'idle' | 'happy' | 'nod' = 'idle';
  private _storybookMascotBobTween?: Phaser.Tweens.Tween;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // AAAA KIDS MODE — Opt out of auto-mascot (we have our own storybook 🦊)
    // and auto-celebrate (we do our own ripple + mascot bounce).
    this._skipAutoMascot = true;
    this._skipAutoCelebrate = true;

    // Build rounds
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    const count = this.maxScore;
    for (let i = 0; i < count; i++) {
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

    // ---- Storybook title (Georgia serif + warm gold) ----
    this.add.text(
      this.scale.width / 2, 105,
      '📖 Quiz Storybook',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '30px',
        color: '#d4a574',
        fontStyle: 'bold',
        stroke: '#3d2914',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Progress bar ----
    const barY = 140;
    const barW = 500;
    const barX = (this.scale.width - barW) / 2;
    this.add.rectangle(this.scale.width / 2, barY, barW + 8, 12, 0x3d2914, 0.4).setDepth(40);
    this.progressBar = this.add.rectangle(barX, barY, 0, 8, 0xd4a574).setOrigin(0, 0.5).setDepth(41);

    // ---- Timer ring (right side) ----
    this.timerRing = this.add.arc(
      this.scale.width - 60, 200, 28, 0, 360, false,
      this.theme.warning, 0.2
    ).setStrokeStyle(4, this.theme.warning, 0.8).setDepth(45);
    this.timerText = this.add.text(
      this.scale.width - 60, 200, '10',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(46);

    // ---- Streak multiplier (left side) ----
    this.streakMultText = this.add.text(
      60, 200, '',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '18px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(45);

    // ---- Storybook mascot 🦊 (left side, NOT tappable) ----
    this._createStoryMascot();

    // ---- Bouncy background deco emojis (6 corners) ----
    this._createBouncyBackground();

    // ---- Prompt banner (cream paper + warm gold border) ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 215, 640, 70, 0xfdf6e3, 0.95
    ).setStrokeStyle(3, 0xd4a574, 0.9).setDepth(48);

    // Corner deco emojis on prompt banner
    this.add.text(this.scale.width / 2 - 320 + 12, 215 - 35 + 5, '📖',
      { fontSize: '20px' }).setOrigin(0.5).setDepth(49);
    this.add.text(this.scale.width / 2 + 320 - 12, 215 - 35 + 5, '✨',
      { fontSize: '20px' }).setOrigin(0.5).setDepth(49);
    this.add.text(this.scale.width / 2 - 320 + 12, 215 + 35 - 5, '✨',
      { fontSize: '20px' }).setOrigin(0.5).setDepth(49);
    this.add.text(this.scale.width / 2 + 320 - 12, 215 + 35 - 5, '📖',
      { fontSize: '20px' }).setOrigin(0.5).setDepth(49);

    this.promptText = this.add.text(
      this.scale.width / 2, 215, '',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '20px',
        color: '#3d2914',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 580 },
      }
    ).setOrigin(0.5).setDepth(49);

    // AAAA KIDS MODE — Replace manual pointerdown with makeHoverSpeakable so the
    // prompt is heard on hover (desktop) AND tap, with karaoke highlight.
    this.makeHoverSpeakable(this.promptText);

    // ---- Lifeline buttons (bottom) ----
    this.createLifelineButtons();

    // DRAMA: Timer pressure bar — shrinks + turns red when time is low
    this.timeBar = this.add.rectangle(this.scale.width / 2, 240, this.scale.width - 60, 6, this.theme.success, 1).setDepth(48);

    this.renderRound();

    // Global pointer handler for reliable button clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canAnswer) return;
      const r = this.rounds[this.round];
      if (!r) return;
      // Hit-test option buttons
      this.optionButtons.forEach((btn, i) => {
        const btnW = 300, btnH = 80;
        if (Math.abs(x - btn.x) < btnW / 2 && Math.abs(y - btn.y) < btnH / 2) {
          // AAAA KIDS MODE — Speak the option text with karaoke highlight on
          // the option's text element (retrieved via getData for stability).
          const optTxt = btn.getData('txt') as Phaser.GameObjects.Text;
          if (optTxt) this.speakPromptWithHighlight(optTxt, r.options[i].term, { pitch: 1.1 });
          this.handleAnswer(btn, i, r.correctIndex, r.options[i]);
        }
      });
      // Hit-test 50/50 button
      if (this.fiftyFiftyBtn && !this.lifelinesUsed.fiftyFifty) {
        if (Math.abs(x - this.fiftyFiftyBtn.x) < 50 && Math.abs(y - this.fiftyFiftyBtn.y) < 18) {
          this.useFiftyFifty();
        }
      }
      // Hit-test Skip button
      if (this.skipBtn && !this.lifelinesUsed.skip) {
        if (Math.abs(x - this.skipBtn.x) < 50 && Math.abs(y - this.skipBtn.y) < 18) {
          this.useSkip();
        }
      }
      // AAAA — Bouncy background: any tap triggers a deco bounce on the closest deco.
      this._bounceClosestDeco(x, y);
    });
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  // ===========================================================================
  // AAAA — Storybook Mascot 🦊
  // Lives on the left margin and provides emotional feedback.
  // NOT tappable (the global pointer handler routes taps elsewhere).
  // ===========================================================================
  private _createStoryMascot() {
    this.storyMascot = this.add.text(
      this.storyMascotBaseX, this.storyMascotBaseY, '🦊',
      {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '64px',
      }
    ).setOrigin(0.5).setDepth(60);

    // Gentle idle bob.
    this._storybookMascotBobTween = this.tweens.add({
      targets: this.storyMascot,
      y: this.storyMascotBaseY - 6,
      duration: 1100, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // Occasional chin-tap (idle gesture — same as auto-mascot).
    this.time.addEvent({
      delay: 4500, repeat: 999,
      callback: () => {
        if (this._storybookMascotState !== 'idle' || !this.storyMascot) return;
        try {
          this.tweens.add({
            targets: this.storyMascot,
            angle: { from: 0, to: -8 },
            duration: 220, yoyo: true, repeat: 1, ease: 'Sine.inOut',
          });
        } catch {}
      },
    });
  }

  // Mascot jumps up + 360° spin on correct answer.
  private _mascotHappyBounce() {
    if (!this.storyMascot) return;
    try {
      this._storybookMascotState = 'happy';
      try { this.tweens.killTweensOf(this.storyMascot); } catch {}
      this.storyMascot.setAngle(0);
      const startX = this.storyMascot.x;
      const startY = this.storyMascot.y;

      // Jump up.
      this.tweens.add({
        targets: this.storyMascot,
        y: this.storyMascotBaseY - 50,
        duration: 220, yoyo: true, repeat: 1, ease: 'Quad.out',
      });
      // 360° spin.
      this.tweens.add({
        targets: this.storyMascot,
        x: startX, // no-op to keep target stable
        angle: 360,
        duration: 600, ease: 'Cubic.out',
        onComplete: () => {
          if (!this.storyMascot) return;
          this.storyMascot.setAngle(0);
          this.storyMascot.y = startY;
          this._storybookMascotState = 'idle';
          this._storybookMascotBobTween = this.tweens.add({
            targets: this.storyMascot,
            y: this.storyMascotBaseY - 6,
            duration: 1100, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        },
      });
    } catch (e) {
      console.error('[QuizScene] _mascotHappyBounce error:', e);
    }
  }

  // Mascot gentle head tilt on wrong answer.
  private _mascotGentleNod() {
    if (!this.storyMascot) return;
    try {
      this._storybookMascotState = 'nod';
      try { this.tweens.killTweensOf(this.storyMascot); } catch {}
      this.tweens.add({
        targets: this.storyMascot,
        angle: { from: 0, to: -12 },
        duration: 280, yoyo: true, repeat: 1, ease: 'Sine.inOut',
        onComplete: () => {
          if (!this.storyMascot) return;
          this.storyMascot.setAngle(0);
          this._storybookMascotState = 'idle';
          this._storybookMascotBobTween = this.tweens.add({
            targets: this.storyMascot,
            y: this.storyMascotBaseY - 6,
            duration: 1100, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        },
      });
    } catch (e) {
      console.error('[QuizScene] _mascotGentleNod error:', e);
    }
  }

  // ===========================================================================
  // AAAA — Bouncy Background (6 emoji scattered in corners, bounce on tap)
  // ===========================================================================
  private _createBouncyBackground() {
    const decoEmojis = ['🌟', '📚', '✏️', '🎈', '🍁', '🌼'];
    // Place emojis in the four corners + two mid-edges, avoiding the center
    // where the question card sits.
    const positions: Array<[number, number]> = [
      [40, this.scale.height - 60],               // bottom-left
      [this.scale.width - 40, this.scale.height - 60], // bottom-right
      [40, 320],                                  // mid-left
      [this.scale.width - 40, 320],               // mid-right
      [this.scale.width / 2 - 200, this.scale.height - 30], // bottom-center-left
      [this.scale.width / 2 + 200, this.scale.height - 30], // bottom-center-right
    ];

    positions.forEach((pos, i) => {
      const txt = this.add.text(pos[0], pos[1], decoEmojis[i % decoEmojis.length], {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5).setDepth(20).setAlpha(0.85);

      // Perpetual gentle bob (each deco offset).
      this.tweens.add({
        targets: txt,
        y: pos[1] - 4,
        duration: 1400 + i * 220, yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });

      this._bouncyDecos.push({ text: txt, baseX: pos[0], baseY: pos[1] });
    });
  }

  // Trigger a big bounce on the closest deco to the tap point.
  private _bounceClosestDeco(x: number, y: number) {
    let closest: BouncyDeco | null = null;
    let closestDist = Infinity;
    for (const deco of this._bouncyDecos) {
      const dx = x - deco.text.x;
      const dy = y - deco.text.y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closest = deco;
      }
    }
    if (!closest) return;
    try {
      try { this.tweens.killTweensOf(closest.text); } catch {}
      this.tweens.add({
        targets: closest.text,
        scale: { from: 1.4, to: 1 },
        y: { from: closest.baseY - 16, to: closest.baseY },
        angle: { from: -10, to: 0 },
        duration: 350, ease: 'Back.out',
        onComplete: () => {
          if (!closest) return;
          // Resume gentle bob.
          this.tweens.add({
            targets: closest.text,
            y: closest.baseY - 4,
            duration: 1400, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        },
      });
    } catch {}
  }

  // ===========================================================================
  // AAAA — Squishy hover + tap
  // ===========================================================================
  private _squishyHover(container: Phaser.GameObjects.Container, _bg: Phaser.GameObjects.Rectangle) {
    container.on('pointerover', () => {
      if (!this.canAnswer) return;
      try {
        this.tweens.add({
          targets: container,
          scaleX: 1.08, scaleY: 0.92,
          duration: 120, ease: 'Quad.out',
        });
      } catch {}
    });
    container.on('pointerout', () => {
      try {
        this.tweens.add({
          targets: container,
          scaleX: 1, scaleY: 1,
          duration: 180, ease: 'Back.out',
        });
      } catch {}
    });
  }

  private _squishyTap(container: Phaser.GameObjects.Container) {
    try {
      this.tweens.add({
        targets: container,
        scaleX: 1.2, scaleY: 0.8,
        duration: 90, ease: 'Quad.out',
        onComplete: () => {
          this.tweens.add({
            targets: container,
            scaleX: 1, scaleY: 1,
            duration: 320, ease: 'Back.out',
          });
        },
      });
    } catch {}
  }

  // ===========================================================================
  // AAAA — Ripple ring (4 colorful expanding circles on correct answer)
  // ===========================================================================
  private _rippleRing(x: number, y: number) {
    const colors = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2];
    for (let i = 0; i < 4; i++) {
      const ring = this.add.circle(x, y, 10, colors[i], 0)
        .setStrokeStyle(4, colors[i], 0.9)
        .setDepth(70);
      this.tweens.add({
        targets: ring,
        radius: 70 + i * 12,
        alpha: { from: 0.9, to: 0 },
        duration: 600 + i * 90, delay: i * 70, ease: 'Cubic.out',
        onComplete: () => { try { ring.destroy(); } catch {} },
      });
    }
  }

  private createLifelineButtons() {
    // 50/50 button
    const fiftyBg = this.add.rectangle(0, 0, 100, 36, this.theme.warning, 0.6)
      .setStrokeStyle(2, this.theme.warning, 0.8);
    const fiftyTxt = this.add.text(0, 0, '50:50', {
      fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.fiftyFiftyBtn = this.add.container(this.scale.width / 2 - 60, 560, [fiftyBg, fiftyTxt])
      .setSize(100, 36).setInteractive({ useHandCursor: true }).setDepth(50);
    this.fiftyFiftyBtn.on('pointerover', () => fiftyBg.setFillStyle(this.theme.warning, 0.9));
    this.fiftyFiftyBtn.on('pointerout', () => fiftyBg.setFillStyle(this.theme.warning, 0.6));
    // NOTE: per-container pointerdown removed — global handler handles 50/50 taps.

    // Skip button
    const skipBg = this.add.rectangle(0, 0, 100, 36, this.theme.cardAlt, 0.6)
      .setStrokeStyle(2, this.theme.accent, 0.8);
    const skipTxt = this.add.text(0, 0, 'Skip', {
      fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.skipBtn = this.add.container(this.scale.width / 2 + 60, 560, [skipBg, skipTxt])
      .setSize(100, 36).setInteractive({ useHandCursor: true }).setDepth(50);
    this.skipBtn.on('pointerover', () => skipBg.setFillStyle(this.theme.cardAlt, 0.9));
    this.skipBtn.on('pointerout', () => skipBg.setFillStyle(this.theme.cardAlt, 0.6));
    // NOTE: per-container pointerdown removed — global handler handles Skip taps.
  }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      // Spaced repetition: if there are wrong answers queued, re-ask them
      if (this.wrongQueue.length > 0) {
        this.rounds.push(...this.wrongQueue);
        this.wrongQueue = [];
      } else {
        this.finishGame(this.score >= this.maxScore * 0.6);
        return;
      }
    }
    this.canAnswer = true;
    const r = this.rounds[this.round];
    const promptText = `Which word matches: "${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"?`;
    this.promptText.setText(promptText);
    // AAAA KIDS MODE — Update speakable text so hover/tap speaks the current prompt.
    this.promptText.setData('speakText', promptText);

    // AAAA KIDS MODE — Speak the prompt aloud with karaoke highlight.
    // Delayed 500ms so the question card entrance animation settles first.
    const promptSpeech = r.prompt.definition ?? r.prompt.term;
    this.time.delayedCall(500, () => {
      if (!this.isFinished && this.rounds[this.round] === r) {
        this.speakPromptWithHighlight(this.promptText, promptSpeech, { isQuestion: true });
      }
    });

    // Update progress bar
    const pct = this.round / this.rounds.length;
    this.tweens.add({
      targets: this.progressBar,
      width: 500 * pct,
      duration: 300, ease: 'Cubic.out',
    });

    // Start question timer
    this.startQuestionTimer();

    // Update streak multiplier display
    const mult = this.streak >= 5 ? 3 : this.streak >= 3 ? 2 : 1;
    this.streakMultText.setText(mult > 1 ? `x${mult} MULT!` : '');

    // Render 4 option buttons with letter labels
    this.optionButtons.forEach(b => b.destroy());
    this.optionButtons = [];

    const cols = 2, rows = 2;
    const btnW = 300, btnH = 80;
    const gapX = 16, gapY = 16;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 330;
    const letters = ['A', 'B', 'C', 'D'];

    r.options.forEach((opt, i) => {
      const cx = startX + (i % cols) * (btnW + gapX);
      const cy = startY + Math.floor(i / cols) * (btnH + gapY);

      // Button background — cream paper style with brown border
      const bg = this.add.rectangle(0, 0, btnW, btnH, 0xfdf6e3, 0.95)
        .setStrokeStyle(2, 0xd4a574, 0.7);
      // Letter badge (left side) — warm gold
      const letterBg = this.add.circle(-btnW / 2 + 25, 0, 20, 0xd4a574, 0.9);
      const letterTxt = this.add.text(-btnW / 2 + 25, 0, letters[i], {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      // Option text — Georgia serif + dark brown
      const txt = this.add.text(20, 0, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '20px',
        color: '#3d2914',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(cx, cy, [bg, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);
      container.setData('txt', txt); // AAAA: for karaoke highlight on tap

      // AAAA — Squishy hover on every option (replaces generic pointerover).
      this._squishyHover(container, bg);
      // Keep subtle color shift on hover too (in addition to squish).
      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(0xfff3d6, 1);
          bg.setStrokeStyle(3, 0xd4a574, 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        bg.setFillStyle(0xfdf6e3, 0.95);
        bg.setStrokeStyle(2, 0xd4a574, 0.7);
      });
      // NOTE: per-container pointerdown removed — global handler handles answer taps.

      // Entrance animation: slide in from below
      container.setAlpha(0).setY(cy + 30);
      this.tweens.add({
        targets: container,
        alpha: 1, y: cy,
        duration: 350, delay: i * 80, ease: 'Back.out',
      });

      this.optionButtons.push(container);
    });
  }

  private startQuestionTimer() {
    this.questionTimer = 10;
    this.timerText.setText('10');
    this.timerText.setColor(this.hex(this.theme.text));
    this.timerRing.setFillStyle(this.theme.warning, 0.2);

    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    this.questionTimerEvent = this.time.addEvent({
      delay: 1000, repeat: 9,
      callback: () => {
        this.questionTimer--;
        this.timerText.setText(String(this.questionTimer));
        // DRAMA: Update timer pressure bar
        if (this.timeBar) {
          const pct = this.questionTimer / 10;
          this.timeBar.width = (this.scale.width - 60) * pct;
          if (pct < 0.3) this.timeBar.setFillStyle(this.theme.danger, 1);
          else if (pct < 0.6) this.timeBar.setFillStyle(this.theme.warning, 1);
          else this.timeBar.setFillStyle(this.theme.success, 1);
        }
        // Color shift as time runs out
        if (this.questionTimer <= 3) {
          this.timerText.setColor(this.hex(this.theme.danger));
          this.timerRing.setFillStyle(this.theme.danger, 0.3);
          audioBus.play('countdown');
        }
        if (this.questionTimer <= 0) {
          this.timeUp();
        }
      },
    });
  }

  private timeUp() {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    // Reveal correct answer
    const r = this.rounds[this.round];
    const correctBtn = this.optionButtons[r.correctIndex];
    const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
    cBg.setFillStyle(this.theme.success, 0.6);
    this.recordAnswer({
      term: r.prompt.term,
      response: 'timeout',
      success: false,
      coordinate: { x: this.scale.width / 2, y: 300, t: this.time.now },
    });
    this.juice.shake('medium');
    // AAAA — Mascot gentle nod on timeout (treats as wrong).
    this._mascotGentleNod();
    this.time.delayedCall(1200, () => {
      this._pageTurnAdvance();
    });
  }

  private useFiftyFifty() {
    if (this.lifelinesUsed.fiftyFifty || !this.canAnswer) return;
    this.lifelinesUsed.fiftyFifty = true;
    this.fiftyFiftyBtn.disableInteractive();
    this.fiftyFiftyBtn.setAlpha(0.3);
    audioBus.play('tap');

    const r = this.rounds[this.round];
    // Remove 2 wrong answers
    const wrongIndices = r.options
      .map((_, i) => i)
      .filter(i => i !== r.correctIndex);
    Phaser.Utils.Array.Shuffle(wrongIndices);
    const toRemove = wrongIndices.slice(0, 2);

    toRemove.forEach(i => {
      const btn = this.optionButtons[i];
      btn.disableInteractive();
      this.tweens.add({
        targets: btn,
        alpha: 0.2, scale: 0.9,
        duration: 300, ease: 'Cubic.out',
      });
    });
  }

  private useSkip() {
    if (this.lifelinesUsed.skip || !this.canAnswer) return;
    this.lifelinesUsed.skip = true;
    this.skipBtn.disableInteractive();
    this.skipBtn.setAlpha(0.3);
    audioBus.play('tap');
    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    this.canAnswer = false;
    this.time.delayedCall(400, () => {
      this._pageTurnAdvance();
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
    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    const isCorrect = index === correctIndex;
    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;

    this.recordAnswer({
      term: this.rounds[this.round].prompt.term,
      response: option.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    // Spaced repetition: queue wrong answers to resurface later
    if (!isCorrect) {
      this.wrongQueue.push(this.rounds[this.round]);
    }

    if (isCorrect) {
      bg.setFillStyle(this.theme.success, 1);
      bg.setStrokeStyle(4, this.theme.success, 1);
      // AAAA — squishy tap pop + ripple ring + mascot happy bounce.
      this._squishyTap(btn);
      this._rippleRing(btn.x, btn.y);
      this._mascotHappyBounce();
      this.juice.squash(btn, 1.15);
      this.juice.burst(btn.x, btn.y, 'correct');
      // Streak bonus particles
      if (this.streak >= 3) {
        this.juice.glowRing(btn.x, btn.y, this.theme.warning, 60);
      }
    } else {
      bg.setFillStyle(this.theme.danger, 1);
      bg.setStrokeStyle(4, this.theme.danger, 1);
      // AAAA — squishy tap pop + mascot gentle nod.
      this._squishyTap(btn);
      this._mascotGentleNod();
      // Highlight the correct answer with pulsing green flash
      const correctBtn = this.optionButtons[correctIndex];
      const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
      cBg.setFillStyle(this.theme.success, 0.8);
      cBg.setStrokeStyle(5, this.theme.success, 1);
      // Pulsing animation on correct answer to draw attention
      this.tweens.add({
        targets: correctBtn,
        scale: { from: 1, to: 1.15 },
        duration: 300, yoyo: true, repeat: 2, ease: 'Sine.inOut',
      });
      // Green glow ring around correct answer
      this.juice.glowRing(correctBtn.x, correctBtn.y, this.theme.success, 80);
      // Speak the correct answer
      this.time.delayedCall(300, () => {
        audioBus.speak(`The answer is ${this.rounds[this.round].options[correctIndex].term}`);
      });
      this.juice.shake('medium');
      this.juice.burst(btn.x, btn.y, 'incorrect');
    }

    // Page-turn transition: slide option buttons LEFT with -8° tilt
    this.time.delayedCall(900, () => {
      this._pageTurnAdvance();
    });
  }

  // ===========================================================================
  // AAAA — Page-turn transition
  // Buttons slide LEFT with -8° tilt; promptBg + promptText also page-turn
  // (slide left + tilt) to give the round change a "flip the page" feel.
  // ===========================================================================
  private _pageTurnAdvance() {
    // Slide option buttons LEFT with angle -8.
    this.optionButtons.forEach((b, i) => {
      this.tweens.add({
        targets: b,
        x: b.x - 400,
        alpha: 0,
        angle: -8,
        duration: 280, delay: i * 30, ease: 'Cubic.in',
      });
    });
    // Page-turn the prompt banner + text too.
    if (this.promptBg && this.promptText) {
      this.tweens.add({
        targets: [this.promptBg, this.promptText],
        x: '-=400',
        alpha: { from: 1, to: 0 },
        angle: -8,
        duration: 280, ease: 'Cubic.in',
        onComplete: () => {
          // Reset position + angle for next round.
          try { this.promptBg.x = this.scale.width / 2; this.promptBg.setAngle(0).setAlpha(1); } catch {}
          try { this.promptText.x = this.scale.width / 2; this.promptText.setAngle(0).setAlpha(1); } catch {}
        },
      });
    }
    this.time.delayedCall(320, () => {
      this.round++;
      this.renderRound();
    });
  }
}
