import Phaser from 'phaser';
import type { ThemeManifest } from '../lib/types';
import { getLod } from '../lib/lod';
import { audioBus } from '../lib/audio';

// ============================================================================
// ThemeAtlas — Procedural Texture Atlas Generator
// Generates all sprite textures at boot using Phaser Graphics → generateTexture.
// In production this is replaced by loading WebP/AVIF atlases + JSON coords;
// here it provides the same single-image-sourced rendering pipeline.
// ============================================================================

export class ThemeAtlas {
  static build(scene: Phaser.Scene, theme: ThemeManifest) {
    const tag = 'atlas-' + theme.id;
    if (scene.textures.exists('particle-' + theme.id)) return; // already built
    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Particle dot
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('particle-' + theme.id, 4, 4);
    g.clear();

    // 2. Particle streak
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 16, 3);
    g.generateTexture('streak-' + theme.id, 16, 3);
    g.clear();

    // 3. Player ship
    g.fillStyle(theme.accent, 1);
    g.beginPath();
    g.moveTo(16, 0); g.lineTo(28, 24); g.lineTo(4, 24); g.closePath(); g.fillPath();
    g.fillStyle(theme.accent2, 1);
    g.fillRect(12, 18, 8, 8);
    g.generateTexture('player-' + theme.id, 32, 32);
    g.clear();

    // 4. Card back
    g.fillStyle(theme.card, 1);
    g.fillRoundedRect(0, 0, 80, 100, 12);
    g.lineStyle(2, theme.accent, 0.6);
    g.strokeRoundedRect(2, 2, 76, 96, 10);
    g.fillStyle(theme.accent2, 0.5);
    g.fillRoundedRect(8, 8, 64, 12, 6);
    g.generateTexture('card-back-' + theme.id, 80, 100);
    g.clear();

    // 5. Card front
    g.fillStyle(theme.cardAlt, 1);
    g.fillRoundedRect(0, 0, 80, 100, 12);
    g.lineStyle(2, theme.accent, 1);
    g.strokeRoundedRect(2, 2, 76, 96, 10);
    g.generateTexture('card-front-' + theme.id, 80, 100);
    g.clear();

    // 6. Balloon
    g.fillStyle(theme.accent, 1);
    g.fillCircle(20, 22, 18);
    g.fillStyle(theme.accent2, 0.7);
    g.fillCircle(14, 16, 6);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(15, 14, 3);
    g.fillStyle(theme.text, 1);
    g.fillRect(19, 40, 2, 8);
    g.generateTexture('balloon-' + theme.id, 40, 50);
    g.clear();

    // 7. Mole hill
    g.fillStyle(0x4b2e1a, 1);
    g.fillEllipse(24, 28, 40, 18);
    g.fillStyle(0x6b3e22, 1);
    g.fillEllipse(24, 24, 32, 14);
    g.fillStyle(0x2c1810, 1);
    g.fillEllipse(24, 22, 18, 8);
    g.generateTexture('mole-hill-' + theme.id, 48, 40);
    g.clear();

    // 8. Mole
    g.fillStyle(0x8b5a2b, 1);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xffd6a0, 1);
    g.fillCircle(16, 20, 10);
    g.fillStyle(0x000000, 1);
    g.fillCircle(11, 12, 2);
    g.fillCircle(21, 12, 2);
    g.fillStyle(0xff8da1, 1);
    g.fillCircle(16, 22, 2);
    g.generateTexture('mole-' + theme.id, 32, 32);
    g.clear();

    // 9. Background gradient (vertical)
    const W = 800, H = 600;
    for (let y = 0; y < H; y += 4) {
      const t = y / H;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(theme.bgGradientTop),
        Phaser.Display.Color.IntegerToColor(theme.bgGradientBottom),
        100,
        Math.round(t * 100)
      );
      const int = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      g.fillStyle(int, 1);
      g.fillRect(0, y, W, 4);
    }
    g.generateTexture('bg-' + theme.id, W, H);
    g.clear();

    // 10. Star field (ambient parallax)
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(Math.random() * 200);
      const y = Math.floor(Math.random() * 200);
      const r = Math.random() * 1.5 + 0.3;
      g.fillStyle(0xffffff, Math.random() * 0.7 + 0.2);
      g.fillCircle(x, y, r);
    }
    g.generateTexture('starfield-' + theme.id, 200, 200);
    g.clear();

    // 11. Mascot cloudDog
    g.fillStyle(0xffffff, 1);
    g.fillCircle(24, 22, 18);
    g.fillStyle(0xe0e7ff, 1);
    g.fillEllipse(24, 32, 28, 10);
    g.fillStyle(0x000000, 1);
    g.fillCircle(18, 18, 2.5);
    g.fillCircle(30, 18, 2.5);
    g.fillStyle(0x000000, 1);
    g.fillRect(22, 26, 4, 1.5);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(20, 34, 8, 2);
    g.generateTexture('mascot-clouddog-' + theme.id, 48, 48);
    g.clear();

    // 12. Mascot starKid
    g.fillStyle(theme.accent2, 1);
    g.beginPath();
    const cx = 24, cy = 24, R = 18, r = 8;
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(20, 22, 3);
    g.fillCircle(28, 22, 3);
    g.fillStyle(0x000000, 1);
    g.fillCircle(20, 22, 1.5);
    g.fillCircle(28, 22, 1.5);
    g.fillStyle(0x000000, 1);
    g.fillRect(22, 28, 4, 1.5);
    g.generateTexture('mascot-starkid-' + theme.id, 48, 48);
    g.clear();

    // Mark tag for debugging
    void tag;
  }
}

// ============================================================================
// JUICE — particle bursts, screen shake, hit-stop, flash, squash
// ============================================================================

export class Juice {
  private lod = getLod();
  constructor(private scene: Phaser.Scene, private theme: ThemeManifest) {}

  burst(x: number, y: number, kind: 'correct' | 'incorrect' | 'streak' | 'win' = 'correct') {
    const palette = this.theme.particles[kind === 'win' ? 'streak' : kind];
    const count = Math.round((kind === 'win' ? 50 : 24) * this.lod.particleMultiplier);
    const key = 'particle-' + this.theme.id;
    if (!this.scene.textures.exists(key)) return;

    const emitter = this.scene.add.particles(x, y, key, {
      speed: { min: 120, max: 360 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 900 },
      tint: palette,
      quantity: count,
      blendMode: this.lod.blendAdd ? 'ADD' : 'NORMAL',
      emitting: false,
    });
    emitter.explode(count);
    this.scene.time.delayedCall(1100, () => emitter.destroy());

    if ((kind === 'streak' || kind === 'win') && this.lod.blendAdd) {
      const streakKey = 'streak-' + this.theme.id;
      if (this.scene.textures.exists(streakKey)) {
        const ribbon = this.scene.add.particles(x, y, streakKey, {
          speed: { min: 200, max: 480 },
          angle: { min: 0, max: 360 },
          scale: { start: 1.2, end: 0 },
          alpha: { start: 0.9, end: 0 },
          lifespan: 600,
          tint: palette,
          quantity: 12,
          blendMode: 'ADD',
          emitting: false,
        });
        ribbon.explode(12);
        this.scene.time.delayedCall(800, () => ribbon.destroy());
      }
    }
  }

  shake(intensity: 'light' | 'medium' | 'heavy' = 'light') {
    const map = { light: 0.004, medium: 0.01, heavy: 0.025 };
    this.scene.cameras.main.shake(220, map[intensity]);
  }

  hitStop(ms = 80) {
    this.scene.physics.world.pause();
    this.scene.time.delayedCall(ms, () => this.scene.physics.world.resume());
  }

  flash(color = 0xffffff, alpha = 0.4, ms = 120) {
    const r = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      color,
      alpha
    );
    r.setDepth(9999);
    this.scene.tweens.add({
      targets: r, alpha: 0, duration: ms, ease: 'Cubic.out',
      onComplete: () => r.destroy(),
    });
  }

  squash(target: Phaser.GameObjects.GameObject, scale = 1.25) {
    this.scene.tweens.add({
      targets: target,
      scaleX: scale, scaleY: 1 / scale,
      duration: 90, yoyo: true, ease: 'Quad.out',
    });
  }
}

// ============================================================================
// Mascot Controller — state machine driven by live telemetry
// ============================================================================

export type MascotState = 'idle' | 'hype' | 'urgent' | 'celebrate' | 'sad';

export class MascotController {
  private sprite: Phaser.GameObjects.Sprite;
  private state: MascotState = 'idle';
  private currentTween?: Phaser.Tweens.Tween;
  private secondaryTween?: Phaser.Tweens.Tween;
  private stateTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemeManifest,
    x: number, y: number
  ) {
    const texKey = theme.mascot === 'cloudDog'
      ? 'mascot-clouddog-' + theme.id
      : 'mascot-starkid-' + theme.id;
    if (!scene.textures.exists(texKey)) ThemeAtlas.build(scene, theme);
    this.sprite = scene.add.sprite(x, y, texKey).setDepth(100).setScale(1.2);
    this.enterState('idle');
  }

  setState(s: MascotState) {
    if (this.state === s) return;
    this.state = s;
    this.enterState(s);
  }

  private enterState(s: MascotState) {
    if (this.currentTween) { this.currentTween.stop(); this.currentTween = undefined!; }
    if (this.secondaryTween) { this.secondaryTween.stop(); this.secondaryTween = undefined!; }
    if (this.stateTimer) { this.stateTimer.remove(); this.stateTimer = undefined!; }
    const sp = this.sprite;
    sp.setScale(1.2);
    sp.setAngle(0);
    sp.setAlpha(1);
    sp.setPosition(sp.x, sp.y); // reset drift
    switch (s) {
      case 'idle':
        this.currentTween = this.scene.tweens.add({
          targets: sp, y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        break;
      case 'hype':
        audioBus.play('streak');
        this.currentTween = this.scene.tweens.add({
          targets: sp, scale: 1.6, y: '-=20', duration: 180, yoyo: true, repeat: -1, ease: 'Quad.out',
        });
        this.secondaryTween = this.scene.tweens.add({
          targets: sp, angle: 12, duration: 90, yoyo: true, repeat: -1,
        });
        this.stateTimer = this.scene.time.delayedCall(4000, () => this.setState('idle'));
        break;
      case 'urgent':
        this.currentTween = this.scene.tweens.add({
          targets: sp, x: '+=4', duration: 60, yoyo: true, repeat: -1,
        });
        this.secondaryTween = this.scene.tweens.add({
          targets: sp, alpha: 0.6, duration: 200, yoyo: true, repeat: -1,
        });
        break;
      case 'celebrate':
        audioBus.play('win');
        this.currentTween = this.scene.tweens.add({
          targets: sp, scale: 1.8, duration: 200, yoyo: true, repeat: 3, ease: 'Back.out',
        });
        this.secondaryTween = this.scene.tweens.add({ targets: sp, angle: 360, duration: 1000, repeat: 0 });
        this.stateTimer = this.scene.time.delayedCall(2500, () => this.setState('idle'));
        break;
      case 'sad':
        audioBus.play('lose');
        this.currentTween = this.scene.tweens.add({
          targets: sp, y: '+=8', angle: -10, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        this.stateTimer = this.scene.time.delayedCall(3000, () => this.setState('idle'));
        break;
    }
  }

  setVisible(v: boolean) { this.sprite.setVisible(v); }
  destroy() {
    this.sprite.destroy();
  }
}

// ============================================================================
// HUD overlay — score, streak, timer, mascot
// ============================================================================

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private streakText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private mascot: MascotController;
  private startTime = 0;
  private lastUrgentTick = false;

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemeManifest,
    private onUpdate: (state: { score: number; streak: number; remainingMs: number }) => void,
    private initialTimeMs = 180_000,
  ) {
    const t = theme;
    const textHex = '#' + t.text.toString(16).padStart(6, '0');
    this.scoreText = scene.add.text(20, 16, 'Score: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: textHex,
    }).setDepth(200);
    this.streakText = scene.add.text(20, 42, '🔥 Streak: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: '#' + t.accent.toString(16).padStart(6, '0'),
    }).setDepth(200);
    this.timerText = scene.add.text(scene.scale.width - 20, 16, '⏱ 3:00', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: textHex,
    }).setOrigin(1, 0).setDepth(200);

    this.mascot = new MascotController(scene, theme, scene.scale.width - 60, scene.scale.height - 60);

    this.startTime = scene.time.now;
  }

  tick(score: number, streak: number, maxScore: number) {
    const elapsed = this.scene.time.now - this.startTime;
    const remainingMs = Math.max(0, this.initialTimeMs - elapsed);
    const sec = Math.floor(remainingMs / 1000);
    const mm = Math.floor(sec / 60);
    const ss = (sec % 60).toString().padStart(2, '0');
    this.timerText.setText(`⏱ ${mm}:${ss}`);

    const isUrgent = remainingMs < this.initialTimeMs * 0.2;
    if (isUrgent && !this.lastUrgentTick) {
      this.timerText.setColor('#' + this.theme.warning.toString(16).padStart(6, '0'));
      this.mascot.setState('urgent');
      this.lastUrgentTick = true;
    } else if (!isUrgent && this.lastUrgentTick) {
      this.timerText.setColor('#' + this.theme.text.toString(16).padStart(6, '0'));
      this.lastUrgentTick = false;
    }

    this.scoreText.setText(`Score: ${score}/${maxScore}`);
    this.streakText.setText(`🔥 Streak: ${streak}`);
    if (streak >= 3) this.mascot.setState('hype');
    this.onUpdate({ score, streak, remainingMs });
    return { remainingMs };
  }

  celebrate() { this.mascot.setState('celebrate'); }
  sad() { this.mascot.setState('sad'); }

  destroy() {
    this.scoreText.destroy();
    this.streakText.destroy();
    this.timerText.destroy();
    this.mascot.destroy();
  }
}
