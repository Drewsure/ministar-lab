import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// PHYSICS PUZZLER — Aim a projectile at the correct word block
// ============================================================================
// A definition appears at the top. Multiple word blocks float around the
// screen. Player aims with mouse/touch and launches a projectile. Hitting
// the correct word block = score. Hitting wrong = lose a shot.
// Uses arcade physics for projectile + bouncing blocks.
// ============================================================================

interface WordBlock {
  text: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
  term: TermItem;
  isCorrect: boolean;
  vx: number;
  vy: number;
}

export default class PhysicsPuzzlerScene extends BaseEngine {
  private blocks: WordBlock[] = [];
  private projectiles: Phaser.GameObjects.Arc[] = [];
  private currentPrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private cannon!: Phaser.GameObjects.Container;
  private cannonAngle = -Math.PI / 2; // pointing up
  private shotsLeft = 15;
  private shotsText!: Phaser.GameObjects.Text;
  private isAiming = false;
  private aimLine?: Phaser.GameObjects.Line;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // Title
    this.add.text(this.scale.width / 2, 105, 'Physics Puzzler', {
      fontFamily: 'Inter, sans-serif', fontSize: '30px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(this.scale.width / 2, 140, 'Aim and fire at the correct word!', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Prompt banner
    this.promptBg = this.add.rectangle(this.scale.width / 2, 185, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 185, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText, 'Tap to hear the definition');

    // Shots display
    this.shotsText = this.add.text(this.scale.width - 20, 220, `🔫 ${this.shotsLeft}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Cannon at bottom center
    const cannonBase = this.add.rectangle(0, 0, 60, 30, this.theme.accent, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.4);
    const cannonBarrel = this.add.rectangle(0, -25, 16, 50, this.theme.accent2, 1)
      .setStrokeStyle(2, 0xffffff, 0.3);
    this.cannon = this.add.container(this.scale.width / 2, this.scale.height - 40, [cannonBase, cannonBarrel])
      .setDepth(100);

    // Pointer handlers — aim with mouse/touch, fire on release
    this.setupGlobalPointer((x, y) => {
      // If tap is in the upper area, fire a projectile toward that point
      if (y < this.scale.height - 100) {
        this.fireProjectile(x, y);
      }
    });

    // Track pointer for aiming
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.y < this.scale.height - 80) {
        this.cannonAngle = Math.atan2(p.y - this.cannon.y, p.x - this.cannon.x);
        this.cannon.setRotation(this.cannonAngle + Math.PI / 2);
      }
    });

    this.renderRound();
  }

  protected onTick(_remainingMs: number) {
    // Move blocks around
    this.blocks.forEach(block => {
      if (!block.container.active) return;
      block.container.x += block.vx * 0.016;
      block.container.y += block.vy * 0.016;

      // Bounce off walls
      if (block.container.x < 60 || block.container.x > this.scale.width - 60) {
        block.vx *= -1;
        block.container.x = Math.max(60, Math.min(this.scale.width - 60, block.container.x));
      }
      if (block.container.y < 230 || block.container.y > this.scale.height - 120) {
        block.vy *= -1;
        block.container.y = Math.max(230, Math.min(this.scale.height - 120, block.container.y));
      }
    });

    // Check projectile collisions
    this.projectiles.forEach(proj => {
      if (!proj.active) return;
      this.blocks.forEach(block => {
        if (!block.container.active || !proj.active) return;
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, block.container.x, block.container.y);
        if (dist < 50) {
          // Hit!
          this.handleHit(block, proj);
        }
      });
    });
  }

  private renderRound() {
    if (this.score >= this.maxScore) {
      this.finishGame(true);
      return;
    }

    // Clear old blocks
    this.blocks.forEach(b => b.container.destroy());
    this.blocks = [];

    // Pick a prompt
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.currentPrompt = pool[0];
    const def = this.currentPrompt.definition ?? this.currentPrompt.emoji ?? this.currentPrompt.term;
    this.promptText.setText(`Find: "${def}"`);
    this.promptText.setData('speakText', `Find the word for: ${def}`);
    this.promptBg.setData('speakText', `Find the word for: ${def}`);

    // Create 4-6 word blocks floating around
    const blockCount = Math.min(6, pool.length);
    const blockTerms = pool.slice(0, blockCount);
    blockTerms.forEach((term, i) => {
      const x = 100 + (i % 3) * 250;
      const y = 260 + Math.floor(i / 3) * 120;
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
        padding: { x: 12, y: 8 },
      }).setOrigin(0.5);
      txt.setData('speakText', term.term);

      const container = this.add.container(x, y, [txt]).setDepth(40);
      const isCorrect = term.id === this.currentPrompt!.id;

      this.blocks.push({
        text: txt,
        container,
        term,
        isCorrect,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 60,
      });
    });
  }

  private fireProjectile(targetX: number, targetY: number) {
    if (this.shotsLeft <= 0 || this.isFinished) return;
    this.shotsLeft--;
    this.shotsText.setText(`🔫 ${this.shotsLeft}`);

    const proj = this.add.circle(this.cannon.x, this.cannon.y - 25, 8, this.theme.warning, 1)
      .setStrokeStyle(2, 0xffffff, 0.6).setDepth(90);

    const angle = Math.atan2(targetY - this.cannon.y, targetX - this.cannon.x);
    const speed = 500;
    proj.setData('vx', Math.cos(angle) * speed);
    proj.setData('vy', Math.sin(angle) * speed);
    proj.setData('life', 3000); // 3s lifetime

    this.projectiles.push(proj);
    audioBus.play('launch');

    // Animate projectile
    const startTime = this.time.now;
    const updateProj = () => {
      if (!proj.active) return;
      const elapsed = this.time.now - startTime;
      if (elapsed > 3000) {
        proj.destroy();
        return;
      }
      proj.x += proj.getData('vx') * 0.016;
      proj.y += proj.getData('vy') * 0.016;
      proj.getData('vy') ? proj.setData('vy', proj.getData('vy') + 200 * 0.016) : null; // gravity
      // Trail effect
      if (Math.random() > 0.5) {
        const trail = this.add.circle(proj.x, proj.y, 4, this.theme.warning, 0.5).setDepth(89);
        this.tweens.add({
          targets: trail, alpha: 0, scale: 0, duration: 300, onComplete: () => trail.destroy(),
        });
      }
      requestAnimationFrame(updateProj);
    };
    updateProj();

    // Check if out of shots
    if (this.shotsLeft <= 0) {
      setTimeout(() => {
        if (!this.isFinished) this.finishGame(this.score >= this.maxScore * 0.5);
      }, 2000);
    }
  }

  private handleHit(block: WordBlock, proj: Phaser.GameObjects.Arc) {
    proj.destroy();
    block.container.destroy();
    block.container.setActive(false);

    this.recordAnswer({
      term: this.currentPrompt!.term,
      response: block.term.term,
      success: block.isCorrect,
      coordinate: { x: block.container.x, y: block.container.y, t: this.time.now },
    });

    if (block.isCorrect) {
      audioBus.play('correct');
      this.juice.burst(block.container.x, block.container.y, 'correct');
      // Clear remaining blocks + next round
      setTimeout(() => {
        this.blocks.forEach(b => { if (b.container.active) b.container.destroy(); });
        this.blocks = [];
        this.renderRound();
      }, 500);
    } else {
      audioBus.play('incorrect');
      this.juice.shake('medium');
    }
  }
}
