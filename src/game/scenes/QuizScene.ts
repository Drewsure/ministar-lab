import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// QUIZ — Selection Engine
// Multiple-choice quiz. Each round shows one term prompt and 4 answer options.
// Tap to answer; correct = streak, wrong = streak reset.
// ============================================================================

interface QuizRound {
  prompt: TermItem;
  options: TermItem[];
  correctIndex: number;
}

export default class QuizScene extends BaseEngine {
  private round = 0;
  private rounds: QuizRound[] = [];
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;

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

    // Title
    this.add.text(
      this.scale.width / 2, 70,
      'Quiz Time',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Progress bar
    const barY = 110;
    const barW = 600;
    const barX = (this.scale.width - barW) / 2;
    this.add.rectangle(this.scale.width / 2, barY, barW + 8, 14, 0x000000, 0.4).setDepth(40);
    this.progressBar = this.add.rectangle(barX, barY, 0, 10, this.theme.accent).setOrigin(0, 0.5).setDepth(41);

    // Prompt
    this.promptText = this.add.text(
      this.scale.width / 2, 180,
      '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '37px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 700 },
      }
    ).setOrigin(0.5).setDepth(50);

    this.renderRound();
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.score === this.maxScore);
      return;
    }
    this.canAnswer = true;
    const r = this.rounds[this.round];
    this.promptText.setText(`Which word matches: "${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"?`);
    // ESL: speak the prompt aloud
    this.speakPrompt(r.prompt.term, r.prompt.definition);
    this.makeSpeakable(this.promptText, `${r.prompt.term}. ${r.prompt.definition ?? ''}`);

    // Update progress bar
    const pct = this.round / this.rounds.length;
    this.tweens.add({
      targets: this.progressBar,
      width: 600 * pct,
      duration: 300, ease: 'Cubic.out',
    });

    // Render 4 option buttons
    this.optionButtons.forEach(b => b.destroy());
    this.optionButtons = [];

    const cols = 2, rows = 2;
    const btnW = 320, btnH = 90;
    const gapX = 20, gapY = 20;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const totalH = rows * btnH + (rows - 1) * gapY;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 320;

    r.options.forEach((opt, i) => {
      const cx = startX + (i % cols) * (btnW + gapX);
      const cy = startY + Math.floor(i / cols) * (btnH + gapY);

      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, opt.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '23px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(cx, cy, [bg, txt]).setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);

      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.92));
      container.on('pointerdown', () => this.handleAnswer(container, i, r.correctIndex, opt));

      // Entrance tween
      container.setScale(0.6).setAlpha(0);
      this.tweens.add({
        targets: container,
        scale: 1, alpha: 1,
        duration: 300, delay: i * 60, ease: 'Back.out',
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
      bg.setFillStyle(this.theme.success, 1);
      this.juice.squash(btn, 1.15);
    } else {
      bg.setFillStyle(this.theme.danger, 1);
      // Highlight the correct one
      const correctBtn = this.optionButtons[correctIndex];
      const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
      cBg.setFillStyle(this.theme.success, 0.6);
      this.juice.shake('medium');
    }

    this.time.delayedCall(900, () => {
      this.round++;
      this.renderRound();
    });
  }
}
