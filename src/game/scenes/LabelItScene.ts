import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// LabelIt — Arcade Game
export default class LabelItScene extends BaseEngine {
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 100, 'LabelIt', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 160, 600, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 160, 'Game loading...', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    const roundTerms = pool.slice(0, Math.min(6, pool.length));

    // Display terms as tappable buttons
    const btnW = 200, btnH = 50, gap = 12;
    const cols = Math.min(roundTerms.length, 3);
    const totalW = cols * btnW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 300;

    roundTerms.forEach((term, i) => {
      const cx = startX + (i % cols) * (btnW + gap);
      const cy = startY + Math.floor(i / cols) * (btnH + gap + 20);
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      }).setOrigin(0.5);
      txt.setData('speakText', term.term);
      const container = this.add.container(cx, cy, [bg, txt]).setSize(btnW, btnH).setDepth(40);
      this.tweens.add({ targets: container, scale: { from: 0, to: 1 }, duration: 300, delay: i * 80, ease: 'Back.out' });
    });

    this.promptText.setText('Tap the correct answer!');
    this.setupGlobalPointer((x, y) => {
      if (!this.canAnswer) return;
      for (let i = 0; i < roundTerms.length; i++) {
        // Check each button position
        const cx = startX + (i % cols) * (btnW + gap);
        const cy = startY + Math.floor(i / cols) * (btnH + gap + 20);
        if (Math.abs(x - cx) < btnW / 2 && Math.abs(y - cy) < btnH / 2) {
          const term = roundTerms[i];
          const isCorrect = i === 0;
          this.recordAnswer({ term: roundTerms[0].term, response: term.term, success: isCorrect,
            coordinate: { x: cx, y: cy, t: this.time.now } });
          if (isCorrect) { audioBus.play('correct'); this.juice.burst(cx, cy, 'correct'); }
          else { audioBus.play('incorrect'); this.juice.shake('medium'); }
          this.canAnswer = false;
          this.time.delayedCall(500, () => { this.canAnswer = true; });
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}
}
