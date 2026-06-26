import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// QUIZ — Selection Engine  (AAA 2029 edition)
// ============================================================================
// Premium multiple-choice quiz with:
//   • Per-question timer (10s) with visual countdown ring
//   • 50/50 lifeline (removes 2 wrong answers, 1 use per game)
//   • Skip lifeline (1 use per game)
//   • Letter-labeled buttons (A, B, C, D) with hover glow
//   • Streak multiplier (x2 at 3 streak, x3 at 5)
//   • Smooth question transitions (slide out + slide in)
//   • Correct/wrong reveal with particle bursts
//   • ESL TTS on every prompt + tap-to-hear on options
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
  private lifelinesUsed = { fiftyFifty: false, skip: false };
  private questionTimer = 10;
  private questionTimerEvent?: Phaser.Time.TimerEvent;
  private timerRing!: Phaser.GameObjects.Arc;
  private timerText!: Phaser.GameObjects.Text;
  private streakMultText!: Phaser.GameObjects.Text;
  private fiftyFiftyBtn!: Phaser.GameObjects.Container;
  private skipBtn!: Phaser.GameObjects.Container;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
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

    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 105,
      'Quiz Time',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

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

    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 215, 640, 70, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 215, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 580 },
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Lifeline buttons (bottom) ----
    this.createLifelineButtons();

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
          // ESL: speak the option text before answering
          audioBus.speak(r.options[i].term);
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
    // ESL: speak the prompt aloud



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

      const container = this.add.container(cx, cy, [bg, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);

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
      // Streak bonus particles
      if (this.streak >= 3) {
        this.juice.glowRing(btn.x, btn.y, this.theme.warning, 60);
      }
    } else {
      bg.setFillStyle(this.theme.danger, 1);
      bg.setStrokeStyle(4, this.theme.danger, 1);
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

    // Slide out transition
    this.time.delayedCall(900, () => {
      this.optionButtons.forEach((b, i) => {
        this.tweens.add({
          targets: b,
          alpha: 0, y: b.y - 30,
          duration: 200, delay: i * 30, ease: 'Cubic.in',
        });
      });
      this.time.delayedCall(300, () => {
        this.round++;
        this.renderRound();
      });
    });
  }
}
