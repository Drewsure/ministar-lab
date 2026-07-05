import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// SPACE EXPLORER — Discover planets by matching vocabulary words.
// Fuel system. Each wrong answer costs fuel. Run out = mission failed.

const EMOJI_MAP: Record<string, string> = {
  star: '⭐', planet: '🪐', moon: '🌙', comet: '☄️', galaxy: '🌌',
  orbit: '🔄', rocket: '🚀', astronaut: '👨‍🚀', telescope: '🔭', universe: '🌠',
};

export default class SpaceExplorerScene extends BaseEngine {
  private currentRound = 0;
  private fuel = 100;
  private planetsDiscovered = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private fuelText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private canAct = true;
  private starSystem!: Phaser.GameObjects.Container;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 35, '🚀 Space Explorer', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.fuelText = this.add.text(20, 60, '⛽ 100%', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setDepth(50);

    // Star system display
    this._buildStarSystem();

    this.promptBg = this.add.rectangle(this.scale.width / 2, 320, 600, 40, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 320, 'What do you see in this star system?', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this._renderRound();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      for (let i = 0; i < this.optionButtons.length; i++) {
        const btn = this.optionButtons[i];
        if (Math.abs(x - btn.x) < 110 && Math.abs(y - btn.y) < 25) {
          this._handleAnswer(i);
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildStarSystem() {
    const cx = this.scale.width / 2, cy = 180;
    this.starSystem = this.add.container(cx, cy).setDepth(20);
    // Starfield
    for (let i = 0; i < 20; i++) {
      const star = this.add.circle(
        (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 150,
        1 + Math.random() * 2, 0xffffff, 0.3 + Math.random() * 0.7
      );
      this.starSystem.add(star);
    }
    // Central star
    this.starSystem.add(this.add.text(0, 0, '⭐', { fontSize: '48px' }).setOrigin(0.5));
    // Unknown planet
    this.starSystem.add(this.add.text(80, -30, '🪐', { fontSize: '36px' }).setOrigin(0.5).setAlpha(0.4));
    // Scan text
    this.starSystem.add(this.add.text(0, 50, '📡 Scanning...', { fontSize: '12px', color: '#60a5fa' }).setOrigin(0.5));
  }

  private _renderRound() {
    if (this.currentRound >= this.maxScore) { this.finishGame(true); return; }
    const targetWord = this.terms[this.currentRound % this.terms.length];
    this.canAct = true;

    // Generate 4 options
    const others = this.terms.filter(t => t.id !== targetWord.id);
    Phaser.Utils.Array.Shuffle(others);
    const options = [targetWord, ...others.slice(0, 3)];
    Phaser.Utils.Array.Shuffle(options);

    // Clear old buttons
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];

    const startY = 380;
    options.forEach((term, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = this.scale.width / 2 + (col === 0 ? -130 : 130);
      const y = startY + row * 55;
      const emoji = EMOJI_MAP[term.term.toLowerCase()] || '✨';
      const bg = this.add.rectangle(0, 0, 240, 44, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, `${emoji} ${term.term}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(240, 44).setDepth(40);
      this.makeSpeakable(txt, term.term);
      this.optionButtons.push(container);
    });
  }

  private _handleAnswer(idx: number) {
    if (!this.canAct || this.isFinished) return;
    this.canAct = false;
    const targetWord = this.terms[this.currentRound % this.terms.length];
    const btn = this.optionButtons[idx];
    const selectedText = (btn.getAt(1) as Phaser.GameObjects.Text).text;
    const selectedWord = selectedText.replace(/^[^\s]+ /, '').trim();
    const isCorrect = selectedWord === targetWord.term;

    this.recordAnswer({
      term: targetWord.term, response: selectedWord, success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (isCorrect) {
      this.planetsDiscovered++;
      this.fuel = Math.max(0, this.fuel - 8);
      const emoji = EMOJI_MAP[targetWord.term.toLowerCase()] || '✨';
      audioBus.play('correct');
      audioBus.speak(targetWord.term);
      this.juice.burst(btn.x, btn.y, 'correct');
      this.juice.scorePopup(btn.x, btn.y - 30, '🪐 Discovered!', this.theme.success);
    } else {
      this.fuel = Math.max(0, this.fuel - 15);
      audioBus.play('incorrect');
      this.juice.shake('light');
    }

    this.fuelText.setText(`⛽ ${this.fuel}%`);
    if (this.fuel <= 30) this.fuelText.setColor(this.hex(this.theme.danger));
    else if (this.fuel <= 60) this.fuelText.setColor(this.hex(this.theme.warning));

    if (this.fuel <= 0) {
      this.finishGame(false);
      return;
    }

    this.time.delayedCall(1500, () => {
      if (this.isFinished) return;
      this.currentRound++;
      this._renderRound();
    });
  }
}
