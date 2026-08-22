import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// PHYSICS PUZZLER — Aim cannon, fire at correct floating word blocks

interface WordBlock { text: Phaser.GameObjects.Text; container: Phaser.GameObjects.Container; term: TermItem; isCorrect: boolean; vx: number; vy: number; }
interface Projectile { obj: Phaser.GameObjects.Arc; vx: number; vy: number; spawnedAt: number; }

export default class PhysicsPuzzlerScene extends BaseEngine {
  private blocks: WordBlock[] = [];
  private projectiles: Projectile[] = [];
  private currentPrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private cannon!: Phaser.GameObjects.Container;
  private shotsLeft = 15;
  private shotsText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 7); }

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
    this.makeHoverSpeakable(this.promptText);

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
    // Phaser's update loop already throttles to a stable 60fps by default,
    // and gives us delta time via this.game.loop.delta. Use that — never
    // requestAnimationFrame (which fires at the monitor's refresh rate, breaking
    // collision detection on 120/144Hz screens and when the tab is backgrounded).
    const dt = Math.min(this.game.loop.delta / 1000, 0.05); // seconds, capped at 50ms to prevent huge jumps after pause

    // Update floating word blocks
    this.blocks.forEach(b => {
      if (!b.container.active) return;
      b.container.x += b.vx * dt;
      b.container.y += b.vy * dt;
      if (b.container.x < 60 || b.container.x > this.scale.width - 60) {
        b.vx *= -1;
        b.container.x = Math.max(60, Math.min(this.scale.width - 60, b.container.x));
      }
      if (b.container.y < 230 || b.container.y > this.scale.height - 120) {
        b.vy *= -1;
        b.container.y = Math.max(230, Math.min(this.scale.height - 120, b.container.y));
      }
    });

    // Update projectiles + check collisions in the SAME loop, so the projectile
    // can't teleport past a block between collision checks (was happening when
    // requestAnimationFrame ran at 144Hz and onTick ran at 60Hz).
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const proj = p.obj;
      if (!proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // Lifetime cap — destroys after 3s to prevent pile-up
      if (this.time.now - p.spawnedAt > 3000) {
        proj.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }
      // Apply gravity + integrate position
      p.vy += 200 * dt;
      proj.x += p.vx * dt;
      proj.y += p.vy * dt;
      // Off-screen cleanup
      if (proj.x < -50 || proj.x > this.scale.width + 50 || proj.y > this.scale.height + 50) {
        proj.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }
      // Trail particle (cheap LOD)
      if (Math.random() > 0.5) {
        const trail = this.add.circle(proj.x, proj.y, 4, this.theme.warning, 0.5).setDepth(89);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 300, onComplete: () => trail.destroy() });
      }
      // Collision check against blocks
      for (let j = this.blocks.length - 1; j >= 0; j--) {
        const b = this.blocks[j];
        if (!b.container.active) continue;
        if (Phaser.Math.Distance.Between(proj.x, proj.y, b.container.x, b.container.y) < 50) {
          this.handleHit(b, proj);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
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
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.time.delayedCall(400, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, `Find the word for: ${def}`, { isQuestion: true });
    });
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
    this.shotsLeft--;
    this.shotsText.setText(`🔫 ${this.shotsLeft}`);
    const proj = this.add.circle(this.cannon.x, this.cannon.y - 25, 8, this.theme.warning, 1)
      .setStrokeStyle(2, 0xffffff, 0.6).setDepth(90);
    const angle = Math.atan2(targetY - this.cannon.y, targetX - this.cannon.x);
    // Speed is now in PIXELS PER SECOND (was pixels per 16ms frame, which
    // was 60fps-baked and broke on high-refresh monitors).
    const speed = 600;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.projectiles.push({ obj: proj, vx, vy, spawnedAt: this.time.now });
    audioBus.play('launch');
    if (this.shotsLeft <= 0) {
      this.time.delayedCall(2000, () => {
        if (!this.isFinished) this.finishGame(this.score >= this.maxScore * 0.5);
      });
    }
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
