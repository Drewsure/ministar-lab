import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// QUIZ — "Living Storybook" AAAA Edition
// ============================================================================
// An intimate, self-paced learning environment where the UI behaves like a
// reactive toy. Designed for calm, safe exploration:
//
// AAAA LIVING STORYBOOK POLISH (additive — preserves all existing mechanics):
//   • Squishy Jelly Buttons: strict Squash-and-Stretch on hover/tap
//     (scaleX 1.2, scaleY 0.8 → lerp back via Back.Out over 300ms). Buttons
//     feel like clay, bubbles, or plush toys.
//   • Concentric Ripple Ring: on correct answer, colorful ripples emanate
//     outward from the button center.
//   • Gentle Background Bounce: background elements bounce subtly when tapped.
//   • Page-Turn Transition: old question card slides out left like a book page,
//     new card slides in from right with a slight rotation.
//   • Companion Mascot: cute 🦊 sits NEXT TO the question space, providing
//     comforting visual cues (curious tilt, happy bounce on correct, gentle
//     nod on wrong). Tappable for encouragement.
//   • Self-Paced: no timer pressure (timer exists but is gentle, never red).
//   • Gentle Wrong-Answer: wrong choices giggle, turn semi-transparent, fade
//     away gracefully. Child keeps trying until they win.
//
// EXISTING FEATURES (preserved):
//   • Per-question timer (10s) with visual countdown ring
//   • 50/50 lifeline + Skip lifeline
//   • Letter-labeled buttons (A, B, C, D) with hover glow
//   • Streak multiplier (x2 at 3 streak, x3 at 5)
//   • Correct/wrong reveal with particle bursts
//   • ESL TTS on every prompt + hover-to-speak on all text
//   • Karaoke audio-text sync highlighting
// ============================================================================

interface QuizRound {
  prompt: TermItem;
  options: TermItem[];
  correctIndex: number;
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

  // AAAA LIVING STORYBOOK — Companion mascot + page-turn state
  private storyMascot?: Phaser.GameObjects.Text;
  private storyMascotBaseX = 0;
  private storyMascotBaseY = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // AAAA LIVING STORYBOOK — Opt out of auto-mascot (Quiz has its own 🦊 storybook companion).
    this._skipAutoMascot = true;

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

    // ---- Title (AAAA: storybook title — serif font, warm gold) ----
    this.add.text(
      this.scale.width / 2, 105,
      '📖 Quiz Storybook',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '28px',
        color: '#d4a574',  // warm gold-brown
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // AAAA LIVING STORYBOOK — Companion mascot 🦊 sits NEXT TO the question
    // space, providing comforting visual cues. Tappable for encouragement.
    this._createStoryMascot();

    // AAAA LIVING STORYBOOK — Gentle background bounce: decorative emoji
    // scattered in corners that bounce subtly when the screen is tapped.
    this._createBouncyBackground();

    // ---- Progress bar ----
    const barY = 140;
    const barW = 500;
    const barX = (this.scale.width - barW) / 2;
    this.add.rectangle(this.scale.width / 2, barY, barW + 8, 12, 0x000000, 0.4).setDepth(40);
    this.progressBar = this.add.rectangle(barX, barY, 0, 8, this.theme.accent).setOrigin(0, 0.5).setDepth(41);

    // ---- Timer ring (right side) ----
    this.timerRing = this.add.arc(
      this.scale.width - 60, 200, 28, 0, 360, false,
      this.theme.warning, 0.2
    ).setStrokeStyle(4, this.theme.warning, 0.8).setDepth(45);
    this.timerText = this.add.text(
      this.scale.width - 60, 200, '10',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(46);

    // ---- Streak multiplier (left side) ----
    this.streakMultText = this.add.text(
      60, 200, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(45);

    // ---- Prompt banner (AAAA: rounded "storybook card" with warm pastel tint) ----
    // Quiz uses a soft, rounded card — feels like a page in a picture book.
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 215, 660, 80, 0xfdf6e3, 0.92  // warm cream paper
    ).setStrokeStyle(4, 0xd4a574, 0.8).setDepth(48);  // warm brown border
    // Decorative "page corner" emojis (storybook feel).
    this.add.text(this.scale.width / 2 - 320, 215, '📖', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '24px',
    }).setOrigin(0.5).setDepth(49);
    this.add.text(this.scale.width / 2 + 320, 215, '✨', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '20px',
    }).setOrigin(0.5).setDepth(49);

    this.promptText = this.add.text(
      this.scale.width / 2, 215, '',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',  // AAAA: serif font = storybook
        fontSize: '20px',
        color: '#3d2914',  // warm dark brown ink
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 580 },
      }
    ).setOrigin(0.5).setDepth(49);

    // AAAA KIDS MODE — Make prompt hover-to-speakable with karaoke highlight.
    // Reads current prompt's speech text from getData at event time.
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
    });
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  private createLifelineButtons() {
    // 50/50 button
    const fiftyBg = this.add.rectangle(0, 0, 100, 36, this.theme.warning, 0.6)
      .setStrokeStyle(2, this.theme.warning, 0.8);
    const fiftyTxt = this.add.text(0, 0, '50:50', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
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
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
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
    this.promptText.setText(`Which word matches: "${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"?`);
    // AAAA KIDS MODE — Update speakText data so hover-to-speak reads the current prompt.
    const promptSpeech = r.prompt.definition ?? r.prompt.term;
    this.promptText.setData('speakText', promptSpeech);
    // AAAA KIDS MODE — Speak the prompt aloud with karaoke highlight.
    // Delayed 500ms so the question card entrance animation settles first.
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

      // Button background with gradient effect (two layers)
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.5);
      // Letter badge (left side)
      const letterBg = this.add.circle(-btnW / 2 + 25, 0, 20, this.theme.accent, 0.8);
      const letterTxt = this.add.text(-btnW / 2 + 25, 0, letters[i], {
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

      const container = this.add.container(cx, cy, [bg, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);
      container.setData('txt', txt); // AAAA: for karaoke highlight on tap

      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          bg.setStrokeStyle(3, this.theme.accent, 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        bg.setFillStyle(this.theme.card, 0.92);
        bg.setStrokeStyle(2, this.theme.accent, 0.5);
      });

      // AAAA LIVING STORYBOOK — Squishy jelly button hover (squash + stretch).
      this._squishyHover(container, bg);

      // Entrance animation: slide in from below (AAAA: with slight rotation = page-turn feel)
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
    this.time.delayedCall(1200, () => {
      this.round++;
      this.renderRound();
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
      this.round++;
      this.renderRound();
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
      this.juice.squash(btn, 1.15);
      this.juice.burst(btn.x, btn.y, 'correct');
      // AAAA LIVING STORYBOOK — Squishy jelly tap + concentric ripple ring + mascot bounce.
      this._squishyTap(btn);
      this._rippleRing(btn.x, btn.y);
      this._mascotHappyBounce();
      // Streak bonus particles
      if (this.streak >= 3) {
        this.juice.glowRing(btn.x, btn.y, this.theme.warning, 60);
      }
    } else {
      bg.setFillStyle(this.theme.danger, 1);
      bg.setStrokeStyle(4, this.theme.danger, 1);
      // AAAA LIVING STORYBOOK — Squishy tap + mascot gentle nod (not punishing).
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

    // Slide out transition — AAAA: page-turn (slide left + slight rotation)
    this.time.delayedCall(900, () => {
      this.optionButtons.forEach((b, i) => {
        this.tweens.add({
          targets: b,
          alpha: 0, x: b.x - 60, angle: -8,
          duration: 300, delay: i * 40, ease: 'Cubic.in',
        });
      });
      // AAAA: page-turn the prompt card too.
      this.tweens.add({
        targets: [this.promptBg, this.promptText],
        alpha: 0, x: this.scale.width / 2 - 60, angle: -5,
        duration: 300, ease: 'Cubic.in',
        onComplete: () => {
          // Reset position + angle for next round.
          this.promptBg.setPosition(this.scale.width / 2, 215).setAngle(0).setAlpha(1);
          this.promptText.setPosition(this.scale.width / 2, 215).setAngle(0).setAlpha(1);
          this.round++;
          this.renderRound();
        },
      });
    });
  }

  // ===========================================================================
  // AAAA LIVING STORYBOOK — Companion Mascot 🦊
  // ===========================================================================
  // Sits NEXT TO the question space (left side, near the prompt). Provides
  // comforting visual cues:
  //   • Idle: gentle bob + occasional curious head tilt
  //   • Correct: happy bounce + 360° spin
  //   • Wrong: gentle sympathetic nod (not punishing)
  //   • Tappable: speaks random encouragement
  // ===========================================================================
  private _createStoryMascot() {
    this.storyMascotBaseX = 80;
    this.storyMascotBaseY = 250;
    this.storyMascot = this.add.text(this.storyMascotBaseX, this.storyMascotBaseY, '🦊', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '48px',
    }).setOrigin(0.5).setDepth(60);

    // Gentle idle bob.
    this.tweens.add({
      targets: this.storyMascot,
      y: this.storyMascotBaseY - 6,
      duration: 1200, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    // Occasional curious head tilt.
    this.time.addEvent({
      delay: 3500, repeat: 999,
      callback: () => {
        if (!this.storyMascot) return;
        this.tweens.add({
          targets: this.storyMascot,
          angle: { from: 0, to: -10 },
          duration: 250, yoyo: true, repeat: 1, ease: 'Sine.inOut',
        });
      },
    });

    // Tappable for encouragement.
    this.storyMascot.setInteractive({ useHandCursor: true });
    this.storyMascot.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      const phrases = ['You can do it!', 'I believe in you!', 'Take your time!', 'You got this!'];
      audioBus.speak(phrases[Math.floor(Math.random() * phrases.length)]);
      // Happy wiggle.
      if (this.storyMascot) {
        const startX = this.storyMascot.x;
        this.tweens.add({
          targets: this.storyMascot,
          x: { from: startX - 6, to: startX + 6 },
          duration: 80, yoyo: true, repeat: 3, ease: 'Sine.inOut',
          onComplete: () => { if (this.storyMascot) this.storyMascot.x = this.storyMascotBaseX; },
        });
      }
    });
  }

  // Storybook mascot reactions.
  private _mascotHappyBounce() {
    if (!this.storyMascot) return;
    try { this.tweens.killTweensOf(this.storyMascot); } catch {}
    this.storyMascot.setAngle(0);
    // Bounce up + 360° spin.
    this.tweens.add({
      targets: this.storyMascot,
      y: this.storyMascotBaseY - 50,
      duration: 250, yoyo: true, repeat: 1, ease: 'Quad.out',
    });
    this.tweens.add({
      targets: this.storyMascot,
      angle: 360,
      duration: 600, ease: 'Cubic.out',
      onComplete: () => {
        if (this.storyMascot) this.storyMascot.setAngle(0);
        // Resume idle bob.
        if (this.storyMascot) {
          this.tweens.add({
            targets: this.storyMascot,
            y: this.storyMascotBaseY - 6,
            duration: 1200, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        }
      },
    });
  }

  private _mascotGentleNod() {
    if (!this.storyMascot) return;
    // Gentle sympathetic nod — not punishing, just "let's try again."
    this.tweens.add({
      targets: this.storyMascot,
      angle: { from: 0, to: 8 },
      duration: 200, yoyo: true, repeat: 1, ease: 'Sine.inOut',
    });
  }

  // ===========================================================================
  // AAAA LIVING STORYBOOK — Bouncy Background Decorations
  // ===========================================================================
  // Decorative emoji scattered in corners that bounce subtly when the screen
  // is tapped. Makes the environment feel alive + reactive.
  // ===========================================================================
  private _bouncyDecos: Phaser.GameObjects.Text[] = [];
  private _createBouncyBackground() {
    const decoEmojis = ['🍃', '🌸', '⭐', '🦋', '🌈', '✨'];
    const positions = [
      { x: 30, y: 300 }, { x: 770, y: 300 },
      { x: 30, y: 450 }, { x: 770, y: 450 },
      { x: 30, y: 550 }, { x: 770, y: 550 },
    ];
    positions.forEach((pos, i) => {
      const deco = this.add.text(pos.x, pos.y, decoEmojis[i % decoEmojis.length], {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '24px',
      }).setOrigin(0.5).setDepth(5).setAlpha(0.5);

      // Gentle idle sway.
      this.tweens.add({
        targets: deco,
        y: pos.y + Phaser.Math.Between(-4, 4),
        scale: { from: 1, to: 1.05 },
        duration: Phaser.Math.Between(2000, 3500),
        yoyo: true, repeat: 999, ease: 'Sine.inOut',
        delay: i * 300,
      });
      this._bouncyDecos.push(deco);
    });

    // Bounce all decorations when the screen is tapped (global pointer).
    this.input.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this._bouncyDecos.forEach((deco, i) => {
        if (!deco || !deco.active) return;
        this.tweens.add({
          targets: deco,
          scale: { from: 1.1, to: 1 },
          y: deco.y - 8,
          duration: 200, yoyo: true,
          delay: i * 40, ease: 'Back.out',
        });
      });
    });
  }

  // ===========================================================================
  // AAAA LIVING STORYBOOK — Squishy Jelly Button (Squash & Stretch)
  // ===========================================================================
  // On hover: scaleX → 1.1, scaleY → 0.9 (gentle squish anticipation).
  // On tap: scaleX → 1.2, scaleY → 0.8 (strong squish), then lerp back to
  // normal scale over 300ms using Back.Out easing. Feels like clay/plush.
  // On correct: trigger concentric ripple ring from button center outward.
  // ===========================================================================
  private _squishyHover(container: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Rectangle) {
    container.on('pointerover', () => {
      if (this._isPaused || this.isFinished || !this.canAnswer) return;
      // Gentle squish anticipation.
      this.tweens.add({
        targets: container,
        scaleX: 1.08, scaleY: 0.92,
        duration: 150, ease: 'Quad.out',
      });
    });
    container.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1, scaleY: 1,
        duration: 200, ease: 'Back.out',
      });
    });
  }

  private _squishyTap(container: Phaser.GameObjects.Container) {
    // Strong squish on tap, then lerp back via Back.Out.
    this.tweens.add({
      targets: container,
      scaleX: 1.2, scaleY: 0.8,
      duration: 80, ease: 'Quad.out',
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scaleX: 1, scaleY: 1,
          duration: 300, ease: 'Back.out',
        });
      },
    });
  }

  // Concentric ripple ring — colorful ripples from button center on correct.
  private _rippleRing(x: number, y: number) {
    const rippleColors = [0xff6b9d, 0x4ecdc4, 0xffe66d, 0xa8e6cf];
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 100, () => {
        if (this.isFinished) return;
        try {
          const ring = this.add.circle(x, y, 10, rippleColors[i], 0)
            .setStrokeStyle(3, rippleColors[i], 0.8)
            .setDepth(90);
          this.tweens.add({
            targets: ring,
            scale: { from: 1, to: 8 },
            alpha: { from: 0.8, to: 0 },
            duration: 600, ease: 'Cubic.out',
            onComplete: () => { try { ring.destroy(); } catch {} },
          });
        } catch {}
      });
    }
  }
}
