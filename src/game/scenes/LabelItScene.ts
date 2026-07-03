import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// LabelIt — Arcade Game: tap the term that matches the definition prompt
export default class LabelItScene extends BaseEngine {
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;
  private rounds: TermItem[] = [];
  private currentRound = 0;
  private optionContainers: Phaser.GameObjects.Container[] = [];
  private scoreText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 100, 'Label It', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 160, 600, 60, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 160, 'Game loading...', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 560 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this.scoreText = this.add.text(this.scale.width - 20, 220, `0/${this.maxScore}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Build rounds from shuffled terms
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.rounds = pool.slice(0, this.maxScore);
    this.currentRound = 0;

    this.renderRound();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAnswer || this.isFinished) return;
      for (let i = 0; i < this.optionContainers.length; i++) {
        const c = this.optionContainers[i];
        if (!c || !c.active) continue;
        if (Math.abs(x - c.x) < 110 && Math.abs(y - c.y) < 28) {
          this.handleTap(i);
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private renderRound() {
    if (this.isFinished) return;
    if (this.currentRound >= this.rounds.length) {
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }

    // Clear old options
    this.optionContainers.forEach(c => { try { c.destroy(); } catch {} });
    this.optionContainers = [];

    const correct = this.rounds[this.currentRound];
    const decoys = this.terms.filter(t => t.id !== correct.id);
    Phaser.Utils.Array.Shuffle(decoys);
    const options = [correct, ...decoys.slice(0, 3)];
    Phaser.Utils.Array.Shuffle(options);

    // Prompt = definition of the correct term
    const promptLabel = correct.definition ?? correct.term;
    this.promptText.setText(`Find: "${promptLabel}"`);
    this.promptText.setData('speakText', `Find: ${promptLabel}`);
    this.promptBg.setData('speakText', `Find: ${promptLabel}`);

    // Speak the prompt
    this.time.delayedCall(300, () => {
      if (this.isFinished) return;
      if (!this.currentRound || this.currentRound < this.rounds.length) {
        audioBus.speak(`Find: ${promptLabel}`);
      }
    });

    const btnW = 220, btnH = 56, gap = 12;
    const cols = Math.min(options.length, 2);
    const totalW = cols * btnW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 320;

    options.forEach((term, i) => {
      const cx = startX + (i % cols) * (btnW + gap);
      const cy = startY + Math.floor(i / cols) * (btnH + gap);
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      txt.setData('speakText', term.term);
      const container = this.add.container(cx, cy, [bg, txt]).setSize(btnW, btnH).setDepth(40);
      container.setData('term', term);
      container.setData('isCorrect', term.id === correct.id);
      container.setAlpha(0).setScale(0.5);
      this.tweens.add({ targets: container, alpha: 1, scale: 1, duration: 300, delay: i * 80, ease: 'Back.out' });
      this.optionContainers.push(container);
    });

    this.canAnswer = true;
  }

  private handleTap(idx: number) {
    if (!this.canAnswer || this.isFinished) return;
    const container = this.optionContainers[idx];
    if (!container || !container.active) return;
    const isCorrect = container.getData('isCorrect') as boolean;
    const term = container.getData('term') as TermItem;
    const correctTerm = this.rounds[this.currentRound];

    this.canAnswer = false;
    this.recordAnswer({
      term: correctTerm.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: container.x, y: container.y, t: this.time.now },
    });

    if (isCorrect) {
      audioBus.play('correct');
      this.juice.burst(container.x, container.y, 'correct');
      this.tweens.add({ targets: container, scale: 1.3, alpha: 0, duration: 300, ease: 'Back.out',
        onComplete: () => { try { container.destroy(); } catch {} } });
      this.checkWin();
      this.time.delayedCall(800, () => {
        if (this.isFinished) return;
        this.currentRound++;
        this.scoreText.setText(`${this.score}/${this.maxScore}`);
        this.renderRound();
      });
    } else {
      audioBus.play('incorrect');
      this.juice.shake('medium');
      this.juice.flash(this.theme.danger, 0.15, 100);
      this.tweens.add({ targets: container, x: '+=10', duration: 50, yoyo: true, repeat: 3 });
      this.time.delayedCall(600, () => {
        if (this.isFinished) return;
        this.canAnswer = true;
      });
    }
  }
}
