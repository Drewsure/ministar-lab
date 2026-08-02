import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// WHACK-A-MOLE — Pairing Engine  (AAA 2029 edition)
// ============================================================================
// Premium whack-a-mole with:
//   • Hammer cursor that follows mouse + swings on click
//   • Moles emerge from holes with dirt particle burst
//   • Mole expressions (happy for correct, surprised when whacked)
//   • Combo system (rapid correct whacks = x2, x3 multiplier)
//   • Dirt mound with shadow
//   • Mole retreat animation (duck back into hole)
//   • Screen shake on whack + squash effect
//   • Streak fire effect on 3+ streak
//   • ESL TTS on every prompt
// ============================================================================

interface Mole {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  isCorrect: boolean;
  active: boolean;
  holeIdx: number;
}

interface Hole {
  x: number;
  y: number;
  mole?: Mole;
}

export default class WhackAMoleScene extends BaseEngine {
  private holes: Hole[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private activePrompt?: TermItem;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private hammer!: Phaser.GameObjects.Container;
  private comboCount = 0;
  private lastWhackTime = 0;
  private comboText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 90, 500, 56, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 90, 'Whack the correct mole!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Combo display ----
    this.comboText = this.add.text(
      this.scale.width / 2, 140, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Build 6 holes in a 3x2 grid ----
    const cols = 3, rows = 2;
    const cellW = 200, cellH = 170;
    const gap = 25;
    const totalW = cols * cellW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cellW / 2;
    const startY = 250;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (cellW + gap);
        const y = startY + r * (cellH + gap);
        this.holes.push({ x, y });
        this.drawHole(x, y);
      }
    }

    if (this.terms.length === 0) {
      this.finishGame(false);
      return;
    }
    this.activePrompt = this.terms[0];
    this.updatePrompt();

    // ---- Hammer cursor ----
    this.createHammer();

    // ---- Spawn loop ----
    // AAAA — Mole spawn rate: SLOWER at start (1.8s), gets faster per level
    // Level 1=1.8s, Level 2=1.5s, Level 3=1.2s, Level 4=1.0s, Level 5=0.8s
    const spawnDelay = Math.max(700, 1800 - (this.level - 1) * 300);
    this.spawnTimer = this.time.addEvent({
      delay: spawnDelay, loop: true,
      callback: this.spawnMole,
      callbackScope: this,
    });

    // ---- Hammer follows mouse ----
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hammer.setPosition(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swingHammer();
      // Hit-test moles
      for (const hole of this.holes) {
        if (!hole.mole || !hole.mole.active) continue;
        if (Math.abs(p.x - hole.mole.container.x) < 35 && Math.abs(p.y - hole.mole.container.y) < 35) {
          // ESL: speak the mole's term when whacked
          audioBus.speak(hole.mole.term.term);
          this.whack(hole, hole.mole);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* prompt set in updatePrompt */ }

  private drawHole(x: number, y: number) {
    // Dirt mound (larger, more detailed)
    const mound = this.add.ellipse(x, y + 25, 100, 36, 0x4b2e1a, 0.9);
    mound.setDepth(1);
    // Mound highlight
    const moundHighlight = this.add.ellipse(x, y + 20, 80, 24, 0x6b3e22, 0.8);
    moundHighlight.setDepth(2);
    // Hole opening (dark)
    const hole = this.add.ellipse(x, y + 22, 50, 18, 0x1a0f08, 1);
    hole.setDepth(3);
    // Grass around hole
    for (let i = 0; i < 8; i++) {
      const gx = x + (Math.random() - 0.5) * 90;
      const gy = y + 28 + (Math.random() - 0.5) * 10;
      this.add.rectangle(gx, gy, 2, 6 + Math.random() * 4, 0x22c55e, 0.6).setDepth(0);
    }
  }

  private createHammer() {
    this.hammer = this.add.container(0, 0).setDepth(100);
    // Handle
    const handle = this.add.rectangle(8, 8, 6, 28, 0x92400e, 1);
    handle.setRotation(Math.PI / 4);
    // Head
    const head = this.add.rectangle(-4, -4, 24, 16, 0x6b7280, 1);
    head.setStrokeStyle(2, 0x374151, 1);
    head.setRotation(Math.PI / 4);
    // Highlight
    const highlight = this.add.rectangle(-8, -8, 18, 4, 0xd1d5db, 0.8);
    highlight.setRotation(Math.PI / 4);
    this.hammer.add([handle, head, highlight]);
    this.hammer.setScale(1.2);
    // Hide default cursor
    this.input.manager.canvas.style.cursor = 'none';
  }

  private swingHammer() {
    audioBus.play('whack');
    this.tweens.add({
      targets: this.hammer,
      angle: -45,
      duration: 80, ease: 'Quad.out',
      yoyo: true,
    });
  }

  private updatePrompt() {
    if (!this.activePrompt) {
      this.promptText.setText('All moles whacked!');
      return;
    }
    this.promptText.setText(`Whack: ${this.activePrompt.emoji ?? ''} ${this.activePrompt.term}`);


  }

  private spawnMole() {
    if (this.isFinished || !this.activePrompt) return;
    const emptyHoles = this.holes.filter(h => !h.mole);
    if (emptyHoles.length === 0) return;
    const hole = Phaser.Utils.Array.GetRandom(emptyHoles);
    const holeIdx = this.holes.indexOf(hole);

    // 50% correct, 50% decoy
    const isCorrect = Math.random() < 0.5;
    const term = isCorrect
      ? this.activePrompt
      : Phaser.Utils.Array.GetRandom(this.terms.filter(t => t.id !== this.activePrompt!.id));
    if (!term) return;

    // Mole body (using generated texture)
    const moleImg = this.add.image(0, 0, 'mole-' + this.theme.id).setDisplaySize(60, 60);
    // Term label above mole
    const txt = this.add.text(0, -42, term.emoji ?? term.term.slice(0, 6), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#' + (isCorrect ? this.theme.success : this.theme.card).toString(16).padStart(6, '0'),
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    const container = this.add.container(hole.x, hole.y + 40, [moleImg, txt]).setSize(60, 60).setInteractive({ useHandCursor: false });
    container.setDepth(5);

    const mole: Mole = { container, term, isCorrect, active: true, holeIdx };
    container.setData('mole', mole);
    hole.mole = mole;

    // Emerge animation with dirt particles
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      y: hole.y, scale: 1, alpha: 1,
      duration: 300, ease: 'Back.out',
    });
    // Dirt burst
    this.juice.burst(hole.x, hole.y + 20, 'incorrect');
    audioBus.play('pop');

    container.on('pointerdown', () => this.whack(hole, mole));

    // Auto retreat after 1.8s
    // AAAA — Mole stay-up time: LONGER at start (3s), gets shorter per level
    const stayTime = Math.max(1200, 3000 - (this.level - 1) * 400);
    this.time.delayedCall(stayTime, () => {
      if (mole.active) this.retreat(hole, mole);
    });
  }

  private whack(hole: Hole, mole: Mole) {
    if (!mole.active) return;
    mole.active = false;
    this.swingHammer();

    // Combo system
    const now = this.time.now;
    if (now - this.lastWhackTime < 2000) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastWhackTime = now;

    this.recordAnswer({
      term: this.activePrompt!.term,
      response: mole.term.term,
      success: mole.isCorrect,
      coordinate: { x: mole.container.x, y: mole.container.y, t: now },
    });

    this.juice.burst(mole.container.x, mole.container.y, mole.isCorrect ? 'correct' : 'incorrect');
    this.juice.shake('light');
    this.juice.squash(mole.container, 1.3);

    if (mole.isCorrect) {
      // Combo display
      if (this.comboCount >= 2) {
        this.comboText.setText(`COMBO x${this.comboCount}!`);
        this.juice.scorePopup(mole.container.x, mole.container.y - 30, `+${this.comboCount}`, this.theme.warning);
        this.tweens.add({
          targets: this.comboText,
          scale: { from: 1.3, to: 1 },
          duration: 200, ease: 'Back.out',
        });
      }
      // Advance prompt
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
        this.updatePrompt();
      } else {
        this.activePrompt = undefined;
        this.updatePrompt();
      }
      this.checkWin();
    }

    // Bonk animation
    this.tweens.add({
      targets: mole.container,
      y: '+=30', scale: 0.7, alpha: 0,
      duration: 250, ease: 'Back.in',
      onComplete: () => {
        mole.container.destroy();
        if (hole.mole === mole) hole.mole = undefined;
      },
    });
  }

  private retreat(hole: Hole, mole: Mole) {
    if (!mole.active) return;
    mole.active = false;
    this.tweens.add({
      targets: mole.container,
      y: '+=40', scale: 0, alpha: 0,
      duration: 300, ease: 'Sine.in',
      onComplete: () => {
        mole.container.destroy();
        if (hole.mole === mole) hole.mole = undefined;
      },
    });
  }
}
