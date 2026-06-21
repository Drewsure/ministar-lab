import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// GAMESHOW QUIZ — Selection Engine
// Spotlight reveal, lifelines, dramatic timer. 3 wrong = game over.
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
  private lifelines = 3;
  private lifelineText!: Phaser.GameObjects.Text;
  private canAnswer = true;
  private spotlights: Phaser.GameObjects.Arc[] = [];

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

    // Spotlight backdrop
    for (let i = 0; i < 5; i++) {
      const sl = this.add.circle(
        this.scale.width / 2, this.scale.height / 2,
        220, this.theme.accent2, 0.06
      ).setDepth(-1);
      this.tweens.add({
        targets: sl,
        x: Math.random() * this.scale.width,
        y: Math.random() * this.scale.height,
        scale: 1.4,
        duration: 4000 + Math.random() * 3000,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
      this.spotlights.push(sl);
    }

    // Title
    this.add.text(
      this.scale.width / 2, 60,
      '🎯 GAMESHOW',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Lifelines
    this.lifelineText = this.add.text(
      this.scale.width - 20, 50,
      `❤❤❤ Lifelines`,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.danger),
      }
    ).setOrigin(1, 0).setDepth(50);

    // Prompt
    this.promptText = this.add.text(
      this.scale.width / 2, 180,
      '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
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
    if (this.round >= this.rounds.length || this.lifelines <= 0) {
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }
    this.canAnswer = true;
    const r = this.rounds[this.round];
    this.promptText.setText(`"${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"`);

    this.optionButtons.forEach(b => b.destroy());
    this.optionButtons = [];

    const cols = 2, rows = 2;
    const btnW = 320, btnH = 90;
    const gapX = 20, gapY = 20;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 320;

    r.options.forEach((opt, i) => {
      const cx = startX + (i % cols) * (btnW + gapX);
      const cy = startY + Math.floor(i / cols) * (btnH + gapY);

      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent2, 0.6);
      const letter = this.add.text(-btnW / 2 + 25, 0, ['A', 'B', 'C', 'D'][i], {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent2),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const txt = this.add.text(20, 0, opt.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.text),
      }).setOrigin(0, 0.5);

      const container = this.add.container(cx, cy, [bg, letter, txt]).setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);

      container.on('pointerover', () => {
        if (this.canAnswer) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.95));
      container.on('pointerdown', () => this.handleAnswer(container, i, r.correctIndex, opt));

      container.setScale(0.7).setAlpha(0);
      this.tweens.add({
        targets: container,
        scale: 1, alpha: 1,
        duration: 350, delay: i * 80, ease: 'Back.out',
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
      // Confetti
      this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win');
    } else {
      bg.setFillStyle(this.theme.danger, 1);
      this.lifelines--;
      this.lifelineText.setText(`${'❤'.repeat(Math.max(0, this.lifelines))}${'🖤'.repeat(3 - Math.max(0, this.lifelines))} Lifelines`);
      const correctBtn = this.optionButtons[correctIndex];
      const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
      cBg.setFillStyle(this.theme.success, 0.6);
      this.juice.shake('heavy');
    }

    this.time.delayedCall(1100, () => {
      this.round++;
      this.renderRound();
    });
  }
}
