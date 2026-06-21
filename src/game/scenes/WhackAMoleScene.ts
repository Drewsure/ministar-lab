import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// WHACK-A-MOLE — Pairing Engine
// Moles pop up carrying terms; whack the one matching the prompt.
// ============================================================================

interface Mole {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  isCorrect: boolean;
  active: boolean;
}

export default class WhackAMoleScene extends BaseEngine {
  private holes: { x: number; y: number; mole?: Mole }[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private activePrompt?: TermItem;
  private spawnTimer?: Phaser.Time.TimerEvent;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.promptText = this.add.text(
      this.scale.width / 2, 60,
      'Whack the correct mole!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '39px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Build 6 holes in a 3x2 grid
    const cols = 3, rows = 2;
    const cellW = 200, cellH = 160;
    const gap = 30;
    const totalW = cols * cellW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cellW / 2;
    const startY = 200;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.holes.push({
          x: startX + c * (cellW + gap),
          y: startY + r * (cellH + gap),
        });
      }
    }

    // Render hole sprites
    this.holes.forEach(h => {
      this.add.image(h.x, h.y + 30, 'mole-hill-' + this.theme.id).setDisplaySize(80, 60).setDepth(1);
    });

    this.activePrompt = this.terms[0];

    // Spawn loop — random mole pops every ~1.5s
    this.spawnTimer = this.time.addEvent({
      delay: 1100, loop: true,
      callback: this.spawnMole,
      callbackScope: this,
    });
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.activePrompt) return;
    this.promptText.setText(`Whack: "${this.activePrompt.term}"`);
    // ESL: speak the prompt aloud
    this.speakPrompt(this.activePrompt.term, this.activePrompt.definition);
    this.makeSpeakable(this.promptText, this.activePrompt.term);
  }

  private spawnMole() {
    if (this.isFinished || !this.activePrompt) return;
    // Find an empty hole
    const emptyHoles = this.holes.filter(h => !h.mole);
    if (emptyHoles.length === 0) return;
    const hole = Phaser.Utils.Array.GetRandom(emptyHoles);

    // 50/50 correct vs decoy
    const isCorrect = Math.random() < 0.5;
    const term = isCorrect
      ? this.activePrompt
      : Phaser.Utils.Array.GetRandom(this.terms.filter(t => t.id !== this.activePrompt!.id));
    if (!term) return;

    const moleImg = this.add.image(0, 0, 'mole-' + this.theme.id).setDisplaySize(60, 60);
    const txt = this.add.text(0, -45, term.emoji ?? term.term.slice(0, 5), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5);

    const container = this.add.container(hole.x, hole.y + 40, [moleImg, txt]).setSize(60, 60).setInteractive({ useHandCursor: true });
    container.setDepth(2);

    const mole: Mole = { container, term, isCorrect, active: true };
    container.setData('mole', mole);
    hole.mole = mole;

    // Pop up
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      y: hole.y, scale: 1, alpha: 1,
      duration: 250, ease: 'Back.out',
    });

    container.on('pointerdown', () => this.whack(hole, mole));

    // Auto retreat after 1.8s
    this.time.delayedCall(1800, () => {
      if (mole.active) this.retreat(hole, mole);
    });
  }

  private whack(hole: { mole?: Mole }, mole: Mole) {
    if (!mole.active) return;
    mole.active = false;
    audioBus.play('whack');
    this.recordAnswer({
      term: this.activePrompt!.term,
      response: mole.term.term,
      success: mole.isCorrect,
      coordinate: { x: mole.container.x, y: mole.container.y, t: this.time.now },
    });
    this.juice.burst(mole.container.x, mole.container.y, mole.isCorrect ? 'correct' : 'incorrect');
    this.juice.shake('light');

    // Bonk animation
    this.tweens.add({
      targets: mole.container,
      y: '+=20', scale: 0.8, alpha: 0,
      duration: 200, ease: 'Back.in',
      onComplete: () => {
        mole.container.destroy();
        if (hole.mole === mole) hole.mole = undefined;
      },
    });

    if (mole.isCorrect) {
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
      } else {
        this.activePrompt = undefined;
      }
      this.checkWin();
    }
  }

  private retreat(hole: { mole?: Mole }, mole: Mole) {
    if (!mole.active) return;
    mole.active = false;
    this.tweens.add({
      targets: mole.container,
      y: '+=40', scale: 0, alpha: 0,
      duration: 250, ease: 'Sine.in',
      onComplete: () => {
        mole.container.destroy();
        if (hole.mole === mole) hole.mole = undefined;
      },
    });
  }
}
