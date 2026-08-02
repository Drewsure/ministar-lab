import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// AIRPLANE — Selection Engine  (AAA 2029 edition)
// ============================================================================
// Steer a glowing airplane left/right to catch correct-answer banners.
// Features:
//   • Plane exhaust particle trail (LOD-aware)
//   • Banner unfurl animation on spawn (scale 0 → 1 with rotation)
//   • Parallax cloud layers (3 depths)
//   • Catch ripple + screen shake on correct
//   • Plane tilt animation based on velocity
//   • Banner sparkle when it enters view
//   • Combo multiplier display on 3+ streak
//   • Speed ramps every 4 correct catches
// ============================================================================

interface Banner {
  container: Phaser.GameObjects.Container;
  body: Phaser.Physics.Arcade.Body;
  term: TermItem;
  isCorrect: boolean;
  hit: boolean;
  sparkle: Phaser.GameObjects.Arc;
}

export default class AirplaneScene extends BaseEngine {
  private plane!: Phaser.Physics.Arcade.Sprite;
  private planeGlow!: Phaser.GameObjects.Arc;
  private planeExhaust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bannerGroup!: Phaser.Physics.Arcade.Group;
  private banners: Banner[] = [];
  private cloudLayers: Phaser.GameObjects.Text[] = [];
  private activePrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private speedMultiplier = 0.4; // FIX: Start VERY SLOW (was 0.6), ramps to 2.0
  private catches = 0;
  private instructionsText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 30, '✈️ Airplane', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt banner at top ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 80,
      this.scale.width - 40, 50,
      this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 80,
      'Catch: ...',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
        padding: { x: 16, y: 8 },
      }
    ).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // ---- Clear instructions ----
    this.instructionsText = this.add.text(
      this.scale.width / 2, 130,
      'Move LEFT or RIGHT to catch the correct banner!\nUse arrow keys, A/D, or tap left/right side of screen!',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', color: this.hex(this.theme.warning),
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(50).setAlpha(0.7);
    this.makeSpeakable(this.instructionsText, 'Move left or right to catch the correct banner! Use arrow keys or tap left or right side of screen!');

    // ---- Parallax clouds (3 layers, different speeds) ----
    this.spawnClouds();

    // ---- Plane ----
    const planeKey = 'player-' + this.theme.id;
    this.planeGlow = this.add.circle(
      this.scale.width / 2, this.scale.height - 80, 30, this.theme.accent, 0.2
    ).setDepth(28);
    // FIX: Finite tween (was repeat: 50)
    this.tweens.add({
      targets: this.planeGlow,
      scale: { from: 1, to: 1.3 },
      alpha: { from: 0.2, to: 0.4 },
      duration: 500, yoyo: true, repeat: 50, ease: 'Sine.inOut',
    });

    this.plane = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, planeKey);
    this.plane.setCollideWorldBounds(true).setDepth(30);
    this.plane.setScale(1.4);
    this.plane.setRotation(0);
    this.plane.setCircle(16, 0, 0);

    // ---- Exhaust particle trail ----
    const exhaustKey = 'particle-' + this.theme.id;
    if (this.textures.exists(exhaustKey) && this.lod.particleMultiplier > 0.3) {
      this.planeExhaust = this.add.particles(0, 0, exhaustKey, {
        speed: { min: 30, max: 80 },
        angle: { min: 70, max: 110 }, // downward
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: { min: 200, max: 400 },
        tint: [this.theme.warning, this.theme.accent2, this.theme.accent],
        blendMode: this.lod.blendAdd ? 'ADD' : 'NORMAL',
        quantity: 1,
        frequency: 40,
      }).setDepth(29);
    }

    // ---- Banner group + overlap detection ----
    this.bannerGroup = this.physics.add.group();
    this.physics.add.overlap(this.plane, this.bannerGroup, this.handleOverlap, undefined, this);

    // ---- First prompt ----
    if (this.terms.length === 0) {
      this.finishGame(false);
      return;
    }
    this.activePrompt = this.terms[0];
    this.updatePromptText();

    // ---- Spawn loop ----
    // PACING FIX (user feedback "way too excessive and slow"):
    // Spawn interval 1.8s (was 2.5s — too slow). First spawn after 1.2s.
    this.time.delayedCall(1200, () => {
      if (this.isFinished) return;
      this.spawnBannerRow();
      this.spawnTimer = this.time.addEvent({
        delay: 1800, loop: true,
        callback: this.spawnBannerRow,
        callbackScope: this,
      });
    });

    // ---- Keyboard input (created ONCE) ----
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('A,D') as Record<string, Phaser.Input.Keyboard.Key>;
    }

    // DRAMA: On-screen LEFT/RIGHT buttons for mobile — BIG tap targets
    const leftBtn = this.add.text(60, this.scale.height - 50, '◀', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px', color: '#ffffff',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 28, y: 16 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    leftBtn.on('pointerdown', () => {
      this.plane.setVelocityX(-200 * this.speedMultiplier);
    });

    const rightBtn = this.add.text(this.scale.width - 60, this.scale.height - 50, '▶', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px', color: '#ffffff',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 28, y: 16 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    rightBtn.on('pointerdown', () => {
      this.plane.setVelocityX(200 * this.speedMultiplier);
    });
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.activePrompt) return;
    // NOTE: updatePromptText() contains speakPrompt — do NOT call it every frame.
    // The prompt text is already set when the prompt changes (in buildWorld + after catch).
    // Just update the combo display here.
    const comboTxt = this.catches >= 3 ? `  (x${this.speedMultiplier.toFixed(1)} speed!)` : '';
    this.promptText.setText(`Catch: ${this.activePrompt.emoji ?? ''} ${this.activePrompt.term}${comboTxt}`);
  }

  // ===========================================================================
  // CLOUDS — parallax layers
  // ===========================================================================
  private spawnClouds() {
    // 3 layers, different speeds and opacities
    for (let layer = 0; layer < 3; layer++) {
      const count = 4 + layer * 2;
      const speed = 8000 + layer * 4000;
      const alpha = 0.15 + layer * 0.15;
      for (let i = 0; i < count; i++) {
        const cloud = this.add.text(
          Math.random() * this.scale.width,
          Math.random() * 400 + 120,
          '☁️',
          { fontSize: (24 + Math.random() * 32 + layer * 8) + 'px' }
        ).setAlpha(alpha).setDepth(2 + layer);
        this.tweens.add({
          targets: cloud,
          x: '-=' + (60 + layer * 40),
          duration: speed,
          repeat: 50, yoyo: true, ease: 'Sine.inOut',
        });
        this.cloudLayers.push(cloud);
      }
    }
  }

  // ===========================================================================
  // BANNER SPAWN — with unfurl animation + sparkle
  // ===========================================================================
  private spawnBannerRow() {
    if (this.isFinished || !this.activePrompt) return;

    const bannerW = 140, bannerH = 48;

    // USER REQUEST: "one cloud dropping per row - not 3 at the same time"
    // Spawn ONE cloud per row. Alternate between correct and wrong words
    // so the player has to read each one and decide.
    const decoys = this.terms.filter(t => t.id !== this.activePrompt!.id);
    const isCorrect = Math.random() < 0.5; // 50% chance correct
    const term = isCorrect ? this.activePrompt : (Phaser.Utils.Array.GetRandom(decoys) ?? this.activePrompt);

    // Random x position across the screen
    const x = Phaser.Math.Between(bannerW, this.scale.width - bannerW);

    this._spawnSingleBanner({ term, isCorrect }, x, bannerW, bannerH, 0);
  }

  private _spawnSingleBanner(entry: { term: TermItem; isCorrect: boolean }, x: number, bannerW: number, bannerH: number, idx: number) {
    const y = -bannerH;

    // VISUAL FIX (user feedback "change wall cubes to clouds"): Banner looks
    // like a cloud — rounded white shape with blue tint, not a brick rectangle.
    // Correct banner has a subtle green tint; wrong banners are neutral white.
    const cloudColor = entry.isCorrect ? 0xe0f7fa : 0xffffff;
    const bg = this.add.ellipse(0, 0, bannerW, bannerH * 0.9, cloudColor, 0.95)
      .setStrokeStyle(3, entry.isCorrect ? this.theme.success : this.theme.accent, 0.7);
    // Cloud puffs (3 small circles on top for a cloud shape)
    const puff1 = this.add.circle(-bannerW * 0.3, -bannerH * 0.3, 14, cloudColor, 0.95);
    const puff2 = this.add.circle(0, -bannerH * 0.4, 17, cloudColor, 0.95);
    const puff3 = this.add.circle(bannerW * 0.3, -bannerH * 0.3, 14, cloudColor, 0.95);

    const txt = this.add.text(0, 3, entry.term.emoji ?? entry.term.term.slice(0, 10), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#1e3a8a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, -6, entry.term.term.slice(0, 10), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#1e3a8a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.9);

    const container = this.add.container(x, y, [puff1, puff2, puff3, bg, txt, label]).setSize(bannerW, bannerH);
    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setSize(bannerW, bannerH);
    body.setOffset(-bannerW / 2, -bannerH / 2);
    body.setAllowGravity(false);
    body.setImmovable(false);

    // Sparkle that appears when banner enters view
    const sparkle = this.add.circle(x, 30, 8, this.theme.accent2, 0)
      .setDepth(40);

    const banner: Banner = { container, body, term: entry.term, isCorrect: entry.isCorrect, hit: false, sparkle };
    container.setData('banner', banner);
    this.banners.push(banner);
    this.bannerGroup.add(container);

    // PACING FIX: Vary fall speed per banner (idx 0=slow, 1=medium, 2=fast)
    // so they don't fall as a connected wall. Each banner falls at a different
    // speed, creating visual separation.
    const baseFallSpeed = (this.lod.isMobile ? 60 : 80) * this.speedMultiplier;
    const speedVariation = [0.9, 1.0, 1.1][idx % 3]; // minimal variation (was 0.8/1.0/1.2 — too extreme)
    const fallSpeed = baseFallSpeed * speedVariation;
    const fallDuration = ((this.scale.height + bannerH + 100) / fallSpeed) * 1000;
    this.tweens.add({
      targets: container,
      y: this.scale.height + bannerH + 20,
      duration: fallDuration,
      ease: 'Linear',
      onComplete: () => {
        if (container.active) {
          container.destroy();
          this.banners = this.banners.filter(b => b !== banner);
        }
      },
    });

    this.tweens.add({
      targets: sparkle,
      alpha: { from: 0, to: 0.6 },
      scale: { from: 0.5, to: 2 },
      duration: 400,
      yoyo: true,
      onComplete: () => sparkle.destroy(),
    });

    // Unfurl animation (scale 0 → 1 with slight rotation)
    container.setScale(0).setRotation(-0.3);
    this.tweens.add({
      targets: container,
      scale: 1, rotation: 0,
      duration: 300, ease: 'Back.out',
    });
  }

  private updatePromptText() {
    if (!this.activePrompt) {
      this.promptText.setText('All caught! 🎉');
      return;
    }
    const comboTxt = this.catches >= 3 ? `  (x${this.speedMultiplier.toFixed(1)} speed!)` : '';
    this.promptText.setText(`Catch: ${this.activePrompt.emoji ?? ''} ${this.activePrompt.term}${comboTxt}`);
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Catch: ${this.activePrompt.term}`, { isQuestion: true });
  }

  // ===========================================================================
  // OVERLAP HANDLER — catch the banner
  // ===========================================================================
  private handleOverlap(_plane: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile, target: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile) {
    if (this.isFinished) return;
    const container = target as Phaser.GameObjects.Container;
    const banner = container.getData('banner') as Banner;
    if (!banner || banner.hit) return;
    banner.hit = true;

    const isCorrect = banner.isCorrect;
    const coord = { x: container.x, y: container.y, t: this.time.now };

    this.recordAnswer({
      term: this.activePrompt!.term,
      response: banner.term.term,
      success: isCorrect,
      coordinate: coord,
    });

    // Catch ripple animation
    const ripple = this.add.circle(container.x, container.y, 20, isCorrect ? this.theme.success : this.theme.danger, 0.5)
      .setDepth(45);
    this.tweens.add({
      targets: ripple,
      scale: 4, alpha: 0,
      duration: 400, ease: 'Cubic.out',
      onComplete: () => ripple.destroy(),
    });

    // Banner poof
    this.tweens.add({
      targets: container,
      scale: 1.4, alpha: 0,
      duration: 250, ease: 'Back.in',
      onComplete: () => container.destroy(),
    });
    this.banners = this.banners.filter(b => b !== banner);

    if (isCorrect) {
      this.catches++;
      // Speed ramp every 4 catches
      if (this.catches % 4 === 0) {
        this.speedMultiplier = Math.min(2.5, this.speedMultiplier + 0.2);
        // REMOVED zoomPunch — causes camera freeze;
      }
      // Advance prompt to next term
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
      } else {
        this.activePrompt = undefined;
      }
      this.updatePromptText();
      this.checkWin();
    }
  }

  // ===========================================================================
  // PER-FRAME UPDATE
  // ===========================================================================
  update() {
    if (this.isFinished || !this.plane) return;
    try {
      this.updateAirplane();
    } catch (e) {
      console.error('[MiniStar] Airplane update error:', e);
    }
  }

  private updateAirplane() {
    // Plane speed: faster base (350 was 200 — too slow per user feedback)
    const baseSpeed = 350;
    const speed = baseSpeed * Math.max(this.speedMultiplier, 0.6); // min 0.6x so it's never too slow
    const pointer = this.input.activePointer;

    let vx = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) vx -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) vx += 1;

    if (vx !== 0) {
      this.plane.setVelocityX(vx * speed);
    } else if (pointer.isDown) {
      const dx = pointer.x - this.plane.x;
      this.plane.setVelocityX(Math.sign(dx) * Math.min(Math.abs(dx) * 6, speed));
    } else {
      this.plane.setVelocityX(0);
    }

    // Tilt the plane based on velocity (visual feedback)
    const vel = this.plane.body?.velocity.x ?? 0;
    const tilt = Phaser.Math.Clamp(vel / 400, -0.3, 0.3);
    this.plane.setRotation(tilt); // Rocket stays mostly upright, slight tilt when moving

    // Update glow + exhaust position
    this.planeGlow.setPosition(this.plane.x, this.plane.y);
    if (this.planeExhaust) {
      this.planeExhaust.setPosition(this.plane.x, this.plane.y + 20);
    }
  }
}
