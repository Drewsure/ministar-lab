import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// SpeakIt — Listen to a word spoken, then tap the matching text.
// Each round: speak a random term, show 4 options, tap the correct one.
export default class SpeakItScene extends BaseEngine {
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;
  private currentTerm!: TermItem;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private questionIdx = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 100, '🗣️ Speak It', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 160, 600, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 160, 'Listen, then tap the word!', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Replay button — tap to hear the word again
    const replayBtn = this.add.text(this.scale.width / 2, 220, '🔊 Tap to hear the word', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
      backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });
    replayBtn.on('pointerdown', () => {
      if (this.currentTerm) audioBus.speak(this.currentTerm.term);
    });

    this.setupGlobalPointer((x, y) => {
      if (!this.canAnswer) return;
      for (let i = 0; i < this.optionButtons.length; i++) {
        const btn = this.optionButtons[i];
        if (Math.abs(x - btn.x) < 110 && Math.abs(y - btn.y) < 30) {
          this.handleAnswer(i);
          return;
        }
      }
    });

    this.nextQuestion();
  }

  protected onTick(_remainingMs: number) {}

  private nextQuestion() {
    if (this.questionIdx >= this.maxScore) {
      this.finishGame(true);
      return;
    }
    this.canAnswer = true;

    // Pick a random term as the correct answer
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.currentTerm = pool[0];

    // Pick 3 decoys
    const decoys = pool.slice(1, 4);
    const options = [this.currentTerm, ...decoys];
    Phaser.Utils.Array.Shuffle(options);

    // Clear old buttons
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];

    const btnW = 220, btnH = 56, gap = 12;
    const cols = Math.min(options.length, 2);
    const totalW = cols * btnW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 320;

    options.forEach((term, i) => {
      const cx = startX + (i % cols) * (btnW + gap);
      const cy = startY + Math.floor(i / cols) * (btnH + gap + 10);
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(cx, cy, [bg, txt]).setSize(btnW, btnH).setDepth(40);
      container.setData('term', term);
      container.setData('isCorrect', term.id === this.currentTerm.id);
      this.optionButtons.push(container);

      // Entrance animation
      container.setScale(0);
      this.tweens.add({ targets: container, scale: 1, duration: 250, delay: i * 60, ease: 'Back.out' });
    });

    // Speak the word after buttons appear
    this.promptText.setText(`Listen... then tap "${this.currentTerm.term}"`);
    this.time.delayedCall(600, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, this.currentTerm.term);
    });
  }

  private handleAnswer(idx: number) {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    const btn = this.optionButtons[idx];
    const isCorrect = btn.getData('isCorrect') as boolean;
    const term = btn.getData('term') as TermItem;

    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(isCorrect ? this.theme.success : this.theme.danger, 1);

    this.recordAnswer({
      term: this.currentTerm.term,
      response: term.term,
      success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (isCorrect) {
      audioBus.play('correct');
      audioBus.speak(this.currentTerm.term);
      this.juice.burst(btn.x, btn.y, 'correct');
      this.juice.scorePopup(btn.x, btn.y - 30, '✅ Correct!', this.theme.success);
    } else {
      audioBus.play('incorrect');
      this.juice.shake('medium');
      this.juice.scorePopup(btn.x, btn.y - 30, '❌ Try again!', this.theme.danger);
    }

    this.questionIdx++;
    this.time.delayedCall(1200, () => {
      if (!this.isFinished) this.nextQuestion();
    });
  }
}
