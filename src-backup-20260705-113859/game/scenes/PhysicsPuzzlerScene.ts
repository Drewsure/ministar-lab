import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// PHYSICS PUZZLER — Aim cannon, fire at correct floating word blocks

interface WordBlock { text: Phaser.GameObjects.Text; container: Phaser.GameObjects.Container; term: TermItem; isCorrect: boolean; vx: number; vy: number; }

export default class PhysicsPuzzlerScene extends BaseEngine {
  private blocks: WordBlock[] = [];
  private projectiles: Phaser.GameObjects.Arc[] = [];
  private currentPrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private cannon!: Phaser.GameObjects.Container;
  private shotsLeft = 15;
  private shotsText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 105, 'Physics Puzzler', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(this.scale.width / 2, 140, 'Aim and fire at the correct word!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 185, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 185, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this.shotsText = this.add.text(this.scale.width - 20, 220, `🔫 ${this.shotsLeft}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    const cannonBase = this.add.rectangle(0, 0, 60, 30, this.theme.accent, 0.8).setStrokeStyle(2, 0xffffff, 0.4);
    const cannonBarrel = this.add.rectangle(0, -25, 16, 50, this.theme.accent2, 1).setStrokeStyle(2, 0xffffff, 0.3);
    this.cannon = this.add.container(this.scale.width / 2, this.scale.height - 40, [cannonBase, cannonBarrel]).setDepth(100);

    this.setupGlobalPointer((x, y) => { if (y < this.scale.height - 100) this.fireProjectile(x, y); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.y < this.scale.height - 80) {
        const angle = Math.atan2(p.y - this.cannon.y, p.x - this.cannon.x);
        this.cannon.setRotation(angle + Math.PI / 2);
      }
    });
    this.renderRound();
  }

  protected onTick(_remainingMs: number) {
    this.blocks.forEach(b => {
      if (!b.container.active) return;
      b.container.x += b.vx * 0.016; b.container.y += b.vy * 0.016;
      if (b.container.x < 60 || b.container.x > this.scale.width - 60) { b.vx *= -1; b.container.x = Math.max(60, Math.min(this.scale.width - 60, b.container.x)); }
      if (b.container.y < 230 || b.container.y > this.scale.height - 120) { b.vy *= -1; b.container.y = Math.max(230, Math.min(this.scale.height - 120, b.container.y)); }
    });
    this.projectiles.forEach(proj => {
      if (!proj.active) return;
      this.blocks.forEach(b => {
        if (!b.container.active || !proj.active) return;
        if (Phaser.Math.Distance.Between(proj.x, proj.y, b.container.x, b.container.y) < 50) this.handleHit(b, proj);
      });
    });
  }

  private renderRound() {
    if (this.score >= this.maxScore) { this.finishGame(true); return; }
    this.blocks.forEach(b => b.container.destroy()); this.blocks = [];
    const pool = [...this.terms]; Phaser.Utils.Array.Shuffle(pool);
    this.currentPrompt = pool[0];
    const def = this.currentPrompt.definition ?? this.currentPrompt.emoji ?? this.currentPrompt.term;
    this.promptText.setText(`Find: "${def}"`);
    this.promptText.setData('speakText', `Find the word for: ${def}`);
    this.promptBg.setData('speakText', `Find the word for: ${def}`);
    const blockCount = Math.min(6, pool.length);
    pool.slice(0, blockCount).forEach((term, i) => {
      const x = 100 + (i % 3) * 250, y = 260 + Math.floor(i / 3) * 120;
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'), padding: { x: 12, y: 8 },
      }).setOrigin(0.5);
      txt.setData('speakText', term.term);
      const container = this.add.container(x, y, [txt]).setDepth(40);
      this.blocks.push({ text: txt, container, term, isCorrect: term.id === this.currentPrompt!.id, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 60 });
    });
  }

  private fireProjectile(targetX: number, targetY: number) {
    if (this.shotsLeft <= 0 || this.isFinished) return;
    this.shotsLeft--; this.shotsText.setText(`🔫 ${this.shotsLeft}`);
    const proj = this.add.circle(this.cannon.x, this.cannon.y - 25, 8, this.theme.warning, 1).setStrokeStyle(2, 0xffffff, 0.6).setDepth(90);
    const angle = Math.atan2(targetY - this.cannon.y, targetX - this.cannon.x);
    proj.setData('vx', Math.cos(angle) * 500); proj.setData('vy', Math.sin(angle) * 500);
    this.projectiles.push(proj); audioBus.play('launch');
    const startTime = this.time.now;
    const updateProj = () => {
      if (!proj.active || this.isFinished) return;
      if (!this.sys.isActive()) return;
      if (this.time.now - startTime > 3000) { proj.destroy(); return; }
      proj.x += proj.getData('vx') * 0.016; proj.y += proj.getData('vy') * 0.016;
      proj.setData('vy', proj.getData('vy') + 200 * 0.016);
      if (Math.random() > 0.5) { const trail = this.add.circle(proj.x, proj.y, 4, this.theme.warning, 0.5).setDepth(89); this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 300, onComplete: () => trail.destroy() }); }
      requestAnimationFrame(updateProj);
    };
    updateProj();
    if (this.shotsLeft <= 0) this.time.delayedCall(2000, () => { if (!this.isFinished) this.finishGame(this.score >= this.maxScore * 0.5); });
  }

  private handleHit(block: WordBlock, proj: Phaser.GameObjects.Arc) {
    proj.destroy();
    const bx = block.container.x, by = block.container.y;
    block.container.destroy();
    this.recordAnswer({ term: this.currentPrompt!.term, response: block.term.term, success: block.isCorrect,
      coordinate: { x: bx, y: by, t: this.time.now } });
    if (block.isCorrect) {
      audioBus.play('correct'); this.juice.burst(bx, by, 'correct');
      this.time.delayedCall(500, () => {
        if (this.isFinished) return;
        this.blocks.forEach(b => { try { if (b.container && b.container.active) b.container.destroy(); } catch {} });
        this.blocks = [];
        this.renderRound();
      });
    } else { audioBus.play('incorrect'); this.juice.shake('medium'); }
  }
}
