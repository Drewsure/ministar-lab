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

// AAAA KIDS MODE — Storm cloud hazard
interface StormCloud {
  container: Phaser.GameObjects.Container;
  body: Phaser.Physics.Arcade.Body;
  hit: boolean;
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
  private speedMultiplier = 0.4; // AAAA KIDS MODE: Start slow, ramps gently to 1.5 (was 2.0)
  private catches = 0;
  private instructionsText!: Phaser.GameObjects.Text;
  // AAAA KIDS MODE — Storm cloud hazard
  private stormClouds: StormCloud[] = [];
  private slowedUntil = 0;
  private _spawnCount = 0; // AAAA: alternates correct/decoy clouds
  private _justUnpaused = false; // AAAA: reset velocity after unpause

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    // AAAA: Opt out of auto-celebration fanfare — Airplane is an action game
    // where each correct catch shouldn't trigger a full-screen celebration
    // overlay (would block gameplay). Correct catches get a green ripple +
    // score popup + mascot celebrate instead.
    this._skipAutoCelebrate = true;

    // ---- Title ----
    this.add.text(this.scale.width / 2, 30, '🚀 Rocket', {
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
    this.makeHoverSpeakable(this.promptText);

    // ---- Clear instructions ----
    this.instructionsText = this.add.text(
      this.scale.width / 2, 130,
      'Move LEFT or RIGHT to catch the correct cloud!\nUse arrow keys, A/D, or tap left/right side of screen!',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', color: this.hex(this.theme.warning),
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(50).setAlpha(0.7);
    this.makeHoverSpeakable(this.instructionsText, 'Move left or right to catch the correct banner! Use arrow keys or tap left or right side of screen!');

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
    // AAAA: GENEROUS hit body for kids (research: kids need larger hitboxes).
    // Plane sprite is 32×32 at 1.4× scale = ~45px. Body = 40×40 (slightly larger
    // than visual = forgiving catch zone). Centered on the sprite.
    const pBody = this.plane.body as Phaser.Physics.Arcade.Body;
    pBody.setSize(40, 40);
    pBody.setOffset(
      (this.plane.width - 40) / 2,
      (this.plane.height - 40) / 2
    );

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

    // ---- Banner group (for visual tracking only — NO physics overlap) ----
    // AAAA: Removed physics.add.overlap — was triggering on any body overlap,
    // including when the rocket just brushed past a wrong cloud. Now using
    // manual distance-based hit detection in update() for precise control.
    this.bannerGroup = this.physics.add.group();

    // ---- First prompt ----
    if (this.terms.length === 0) {
      this.finishGame(false);
      return;
    }
    this.activePrompt = this.terms[0];
    this.updatePromptText();

    // ---- Spawn loop ----
    // AAAA: Slower spawn (2.5s, was 1.8s) so kids have time to read + steer.
    // First spawn after 2s (was 1.2s) so the initial prompt is read first.
    this.time.delayedCall(2000, () => {
      if (this.isFinished) return;
      this.spawnBannerRow();
      this.spawnTimer = this.time.addEvent({
        delay: 2500, loop: true,
        callback: this.spawnBannerRow,
        callbackScope: this,
      });
    });

    // ---- Keyboard input (created ONCE) ----
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    }

    // AAAA: Full D-pad for mobile — LEFT/RIGHT/UP/DOWN.
    const dpadX = 70;
    const dpadY = this.scale.height - 70;
    const dpadStyle = {
      fontFamily: 'Inter, sans-serif', fontSize: '32px', color: '#ffffff',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 20, y: 12 }, fontStyle: 'bold',
    };

    const leftBtn = this.add.text(dpadX - 55, dpadY, '◀', dpadStyle)
      .setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    leftBtn.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this.plane.setVelocityX(-200 * this.speedMultiplier);
    });

    const rightBtn = this.add.text(dpadX + 55, dpadY, '▶', dpadStyle)
      .setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    rightBtn.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this.plane.setVelocityX(200 * this.speedMultiplier);
    });

    const upBtn = this.add.text(dpadX, dpadY - 45, '▲', dpadStyle)
      .setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    upBtn.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this.plane.setVelocityY(-200 * this.speedMultiplier);
    });

    const downBtn = this.add.text(dpadX, dpadY + 45, '▼', dpadStyle)
      .setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    downBtn.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this.plane.setVelocityY(200 * this.speedMultiplier);
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

    const bannerW = 120, bannerH = 44;

    // AAAA: GUARANTEE the correct cloud appears at least every other spawn.
    // Alternate: odd spawn = correct cloud, even spawn = decoy.
    // AAAA FIX: Storm clouds can only spawn on EVEN turns (decoy turns),
    // so they never steal the correct cloud's turn.
    this._spawnCount = (this._spawnCount || 0) + 1;
    const isCorrectTurn = (this._spawnCount % 2 === 1); // odd = correct, even = decoy

    // Storm cloud only on decoy turns (12% chance, after 1+ catch).
    if (!isCorrectTurn && Math.random() < 0.12 && this.catches >= 1) {
      this._spawnStormCloud();
      return;
    }

    const decoys = this.terms.filter(t => t.id !== this.activePrompt!.id);
    const term = isCorrectTurn ? this.activePrompt : (Phaser.Utils.Array.GetRandom(decoys) ?? this.activePrompt);

    // Random x position across the screen
    const x = Phaser.Math.Between(bannerW, this.scale.width - bannerW);

    this._spawnSingleBanner({ term, isCorrect: isCorrectTurn }, x, bannerW, bannerH, 0);
  }

  // AAAA KIDS MODE — Storm cloud hazard spawn.
  private _spawnStormCloud() {
    const cloudW = 160, cloudH = 70;
    const x = Phaser.Math.Between(cloudW, this.scale.width - cloudW);
    const y = -cloudH;

    const stormColor = 0x2d3748;
    const bg = this.add.ellipse(0, 0, cloudW, cloudH * 0.9, stormColor, 0.95)
      .setStrokeStyle(3, 0x1a202c, 1);
    const puff1 = this.add.circle(-cloudW * 0.3, -cloudH * 0.3, 18, stormColor, 0.95);
    const puff2 = this.add.circle(0, -cloudH * 0.4, 22, stormColor, 0.95);
    const puff3 = this.add.circle(cloudW * 0.3, -cloudH * 0.3, 18, stormColor, 0.95);
    const lightning = this.add.text(0, 5, '⚡', {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
      fontSize: '32px',
    }).setOrigin(0.5);
    const label = this.add.text(0, -12, 'STORM!', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [puff1, puff2, puff3, bg, lightning, label]).setSize(cloudW, cloudH);
    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    // AAAA: GENEROUS hit body for storm cloud (matching visual, centered).
    body.setSize(120, 50);
    body.setOffset(-60, -25);
    body.setAllowGravity(false);
    body.setImmovable(false);

    const storm: StormCloud = { container, body, hit: false };
    container.setData('storm', storm);
    this.stormClouds.push(storm);
    this.bannerGroup.add(container);

    // Storm clouds fall slower than banners (menacing, avoidable).
    const baseFallSpeed = (this.lod.isMobile ? 50 : 65) * this.speedMultiplier * this.timeMultiplier();
    const fallDuration = ((this.scale.height + cloudH + 100) / baseFallSpeed) * 1000;
    this.tweens.add({
      targets: container,
      y: this.scale.height + cloudH + 20,
      duration: fallDuration,
      ease: 'Linear',
      onComplete: () => {
        if (container.active) {
          container.destroy();
          this.stormClouds = this.stormClouds.filter(s => s !== storm);
        }
      },
    });

    // Lightning crackle.
    this.tweens.add({
      targets: lightning,
      alpha: { from: 1, to: 0.3 },
      duration: 150, yoyo: true, repeat: 999, ease: 'Sine.inOut',
    });

    container.setScale(0).setRotation(-0.2);
    this.tweens.add({ targets: container, scale: 1, rotation: 0, duration: 300, ease: 'Back.out' });
    audioBus.play('hover', { freq: 80, duration: 0.4 });
  }

  // Handle plane hitting a storm cloud — significant penalty.
  private _handleStormHit(storm: StormCloud) {
    if (storm.hit) return;
    storm.hit = true;

    // SIGNIFICANT IMPACT:
    // 1. Lose 2 catches.
    this.catches = Math.max(0, this.catches - 2);
    // 2. Plane slowed to 50% speed for 3 seconds.
    this.slowedUntil = this.time.now + 3000;
    // 3. Screen shake.
    this.juice.shake('medium');
    // 4. Lightning flash.
    this.juice.flash(0xffff00, 0.5, 200);
    // 5. Thunder sound.
    audioBus.play('incorrect', { freq: 60, duration: 0.5 });
    this.time.delayedCall(80, () => audioBus.play('hover', { freq: 200, duration: 0.3 }));

    this.juice.burst(storm.container.x, storm.container.y, 'incorrect');
    this.juice.scorePopup(storm.container.x, storm.container.y - 30, '⚡ STORM! -2 ⚡', this.theme.danger);
    audioBus.speak('Storm cloud! Watch out!');

    storm.container.destroy();
    this.stormClouds = this.stormClouds.filter(s => s !== storm);
    this.updatePromptText();
  }

  private _spawnSingleBanner(entry: { term: TermItem; isCorrect: boolean }, x: number, bannerW: number, bannerH: number, idx: number) {
    const y = -bannerH;

    // VISUAL: Correct cloud has green tint, wrong clouds are white.
    // AAAA: Check against current activePrompt at spawn time for initial color.
    const isCurrentlyCorrect = this.activePrompt ? (entry.term.id === this.activePrompt.id) : false;
    const cloudColor = isCurrentlyCorrect ? 0xe0f7fa : 0xffffff;
    const bg = this.add.ellipse(0, 0, bannerW, bannerH * 0.9, cloudColor, 0.95)
      .setStrokeStyle(3, isCurrentlyCorrect ? this.theme.success : this.theme.accent, 0.7);
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
    // AAAA: GENEROUS hit body matching the cloud visual size (research: kids need
    // forgiving hitboxes). Cloud is 120×44 visually. Body = 100×36 (slightly
    // smaller than visual, but still generous). Centered on container.
    body.setSize(100, 36);
    body.setOffset(-50, -18);
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
    // AAAA SLOW MODE: multiply by timeMultiplier() (0.7 = 30% slower fall).
    // AAAA: Slower fall speed (was 60/80, now 40/50) so kids can reach clouds.
    const baseFallSpeed = (this.lod.isMobile ? 40 : 50) * this.speedMultiplier * this.timeMultiplier();
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
    // AAAA: Update speakText data so hover reads the current prompt.
    this.promptText.setData('speakText', `Catch: ${this.activePrompt.term}`);
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Catch: ${this.activePrompt.term}`, { isQuestion: true });
  }

  // ===========================================================================
  // OVERLAP HANDLER — catch the banner
  // ===========================================================================
  private handleOverlap(_plane: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile, target: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile) {
    if (this.isFinished) return;
    const container = target as Phaser.GameObjects.Container;

    // AAAA KIDS MODE — Check if this is a storm cloud (hazard) or a banner.
    const storm = container.getData('storm') as StormCloud | undefined;
    if (storm) {
      this._handleStormHit(storm);
      return;
    }

    const banner = container.getData('banner') as Banner;
    if (!banner || banner.hit) return;
    banner.hit = true;

    // AAAA FIX: Check isCorrect at CATCH TIME, not spawn time.
    // A cloud is "correct" if its term matches the CURRENT activePrompt.
    // This fixes the bug where a cloud spawned as "correct" for an old
    // target word was still marked correct after the goal changed.
    // Also fixes: a cloud spawned as "decoy" but whose term happens to
    // match the current target (rare but possible) is correctly marked.
    const isCorrect = this.activePrompt ? (banner.term.id === this.activePrompt.id) : false;
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
      // AAAA: Positive feedback — green popup + correct sound.
      audioBus.play('correct');
      this.juice.scorePopup(container.x, container.y - 20, '✓ Catch!', this.theme.success);
      // Speed ramp every 4 catches
      if (this.catches % 4 === 0) {
        this.speedMultiplier = Math.min(1.5, this.speedMultiplier + 0.1);
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
    } else {
      // AAAA: Wrong cloud caught — clear verbal + visual feedback.
      audioBus.play('incorrect');
      this.juice.shake('light');
      this.juice.scorePopup(container.x, container.y - 20, '❌ Wrong!', this.theme.danger);
      this.time.delayedCall(200, () => {
        audioBus.speak(`That was ${banner.term.term}. Catch ${this.activePrompt?.term ?? 'the right one'}!`, { rate: 0.92 });
      });
    }
  }

  // ===========================================================================
  // PER-FRAME UPDATE
  // ===========================================================================
  update() {
    if (this.isFinished || this._isPaused || !this.plane) return;
    try {
      // AAAA: Reset velocity if we just unpaused.
      if (this._justUnpaused) {
        this._justUnpaused = false;
        this.plane.setVelocityX(0);
        this.plane.setVelocityY(0);
      }
      this.updateAirplane();
      // AAAA: Manual hit detection — check distance between rocket center
      // and each cloud center. Only triggers when rocket is WITHIN the cloud
      // (tight radius), not just brushing past.
      this._checkCloudCatches();
    } catch (e) {
      console.error('[MiniStar] Rocket update error:', e);
    }
  }

  // AAAA: Manual hit detection — uses box overlap (horizontal AND vertical
  // alignment), not distance. This means the rocket catches a cloud if:
  //   • Rocket X is within 55px of cloud X (horizontally aligned)
  //   • Rocket Y is within 30px of cloud Y (vertically overlapping)
  // This is generous enough that hitting a cloud "from the side" registers
  // (the rocket slides into the cloud horizontally), but not SO large that
  // passing nearby triggers a catch.
  private _checkCloudCatches() {
    if (!this.plane) return;
    const px = this.plane.x;
    const py = this.plane.y;

    // Check banners.
    for (const banner of [...this.banners]) {
      if (banner.hit) continue;
      const cx = banner.container.x;
      const cy = banner.container.y;
      // Box overlap: |dx| < 55 AND |dy| < 30.
      const dx = Math.abs(px - cx);
      const dy = Math.abs(py - cy);
      if (dx < 55 && dy < 30) {
        this.handleOverlap(this.plane, banner.container);
      }
    }

    // Check storm clouds.
    for (const storm of [...this.stormClouds]) {
      if (storm.hit) continue;
      const cx = storm.container.x;
      const cy = storm.container.y;
      const dx = Math.abs(px - cx);
      const dy = Math.abs(py - cy);
      if (dx < 60 && dy < 35) {
        this._handleStormHit(storm);
      }
    }
  }

  // AAAA: Override _togglePause to zero plane velocity on pause.
  // This ensures the rocket doesn't "drift" while paused or jump on resume.
  protected _togglePause() {
    // @ts-ignore — call parent's _togglePause
    super._togglePause();
    if (this._isPaused && this.plane) {
      this.plane.setVelocity(0, 0);
    }
    if (!this._isPaused) {
      this._justUnpaused = true;
    }
  }

  private updateAirplane() {
    const baseSpeed = 350;
    const slowFactor = this.time.now < this.slowedUntil ? 0.5 : 1.0;
    const speed = baseSpeed * Math.max(this.speedMultiplier, 0.6) * slowFactor * this.timeMultiplier();
    const pointer = this.input.activePointer;

    // AAAA: Full 4-directional movement — left/right AND up/down.
    let vx = 0, vy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) vx -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) vx += 1;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) vy -= 1;
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      this.plane.setVelocityX(vx * speed);
      this.plane.setVelocityY(vy * speed);
    } else if (pointer.isDown) {
      // Touch/mouse — move toward tap in BOTH X and Y.
      const dx = pointer.x - this.plane.x;
      const dy = pointer.y - this.plane.y;
      this.plane.setVelocityX(Math.sign(dx) * Math.min(Math.abs(dx) * 6, speed));
      this.plane.setVelocityY(Math.sign(dy) * Math.min(Math.abs(dy) * 6, speed));
    } else {
      this.plane.setVelocity(0, 0);
    }

    // AAAA: Constrain rocket to play area.
    const minY = 200;
    const maxY = this.scale.height - 30;
    if (this.plane.y < minY) { this.plane.y = minY; this.plane.setVelocityY(0); }
    if (this.plane.y > maxY) { this.plane.y = maxY; this.plane.setVelocityY(0); }

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
