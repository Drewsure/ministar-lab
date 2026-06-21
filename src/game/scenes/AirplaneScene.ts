import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// AIRPLANE — Selection Engine
// Steer an airplane left/right; collect correct-answer banners, avoid wrong.
// ============================================================================

interface Banner {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  isCorrect: boolean;
  hit: boolean;
}

export default class AirplaneScene extends BaseEngine {
  private plane!: Phaser.Physics.Arcade.Sprite;
  private bannerGroup!: Phaser.Physics.Arcade.Group;
  private banners: Banner[] = [];
  private cloudGroup!: Phaser.GameObjects.Group;
  private activePrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    // Title
    this.promptText = this.add.text(
      this.scale.width / 2, 70,
      'Airplane — collect the answer!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Clouds (parallax)
    this.cloudGroup = this.add.group();
    for (let i = 0; i < 8; i++) {
      const cloud = this.add.text(
        Math.random() * this.scale.width,
        Math.random() * 400 + 80,
        '☁️',
        { fontSize: (32 + Math.random() * 32) + 'px' }
      ).setAlpha(0.4).setDepth(2);
      this.tweens.add({
        targets: cloud,
        x: '-=80',
        duration: 6000 + Math.random() * 4000,
        repeat: -1, yoyo: true, ease: 'Sine.inOut',
      });
      this.cloudGroup.add(cloud);
    }

    // Plane
    const planeKey = 'player-' + this.theme.id;
    if (!this.textures.exists(planeKey)) {
      const g = this.make.graphics();
      g.fillStyle(this.theme.accent, 1);
      g.fillTriangle(16, 0, 32, 28, 0, 28);
      g.generateTexture(planeKey, 32, 32);
      g.destroy();
    }
    this.plane = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, planeKey);
    this.plane.setCollideWorldBounds(true).setDepth(30);
    this.plane.setRotation(Math.PI / 2);

    this.bannerGroup = this.physics.add.group();
    this.physics.add.overlap(this.plane, this.bannerGroup, this.handleOverlap, undefined, this);

    // Pick first prompt
    this.activePrompt = this.terms[0];
    this.promptText.setText(`Collect: ${this.activePrompt.term}`);

    // Spawn loop
    this.spawnTimer = this.time.addEvent({
      delay: 1400, loop: true,
      callback: this.spawnBannerRow,
      callbackScope: this,
    });

    // ---- Create keyboard input objects ONCE (fix: was leaking ~240 listeners/sec) ----
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('A,D') as Record<string, Phaser.Input.Keyboard.Key>;
    }
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.activePrompt) return;
    this.promptText.setText(`Collect: ${this.activePrompt.term}`);
  }

  private spawnBannerRow() {
    if (this.isFinished) return;
    if (!this.activePrompt) return;

    // 3 banners per row: 1 correct, 2 wrong
    const row = [this.activePrompt, ...this.pickTerms(2).filter(t => t.id !== this.activePrompt!.id).slice(0, 2)];
    Phaser.Utils.Array.Shuffle(row);

    const bannerW = 200, bannerH = 70;
    const gap = 40;
    const totalW = row.length * bannerW + (row.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + bannerW / 2;

    row.forEach((term, i) => {
      const x = startX + i * (bannerW + gap);
      const y = -bannerH;
      const isCorrect = term.id === this.activePrompt!.id;

      const bg = this.add.rectangle(0, 0, bannerW, bannerH, isCorrect ? this.theme.success : this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7);
      const txt = this.add.text(0, 0, term.emoji ?? term.term.slice(0, 8), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [bg, txt]).setSize(bannerW, bannerH);
      this.physics.add.existing(container);
      const body = (container.body as Phaser.Physics.Arcade.Body);
      body.setSize(bannerW, bannerH).setAllowGravity(false).setVelocityY(this.lod.isMobile ? 100 : 150);

      const banner: Banner = { container, term, isCorrect, hit: false };
      container.setData('banner', banner);
      this.banners.push(banner);
      this.bannerGroup.add(container);

      // Despawn when off-screen
      this.time.delayedCall(8000, () => {
        if (container.active) {
          container.destroy();
          this.banners = this.banners.filter(b => b !== banner);
        }
      });
    });
  }

  private handleOverlap(_plane: Phaser.GameObjects.GameObject, target: Phaser.GameObjects.GameObject) {
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

    // Animate banner off
    this.tweens.add({
      targets: container,
      scale: 0, alpha: 0,
      duration: 250, ease: 'Back.in',
      onComplete: () => container.destroy(),
    });

    if (isCorrect) {
      // Advance prompt to next term
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
      } else {
        this.activePrompt = undefined;
      }
      this.checkWin();
    }
  }

  update() {
    if (this.isFinished || !this.plane) return;
    const speed = 320;
    const pointer = this.input.activePointer;

    // ---- Use pre-created cursor/wasd objects (fix: input listener leak) ----
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      this.plane.setVelocityX(-speed);
    } else if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      this.plane.setVelocityX(speed);
    } else if (pointer.isDown) {
      // Tap-to-steer: head toward X
      const dx = pointer.x - this.plane.x;
      this.plane.setVelocityX(Math.sign(dx) * Math.min(Math.abs(dx) * 6, speed));
    } else {
      this.plane.setVelocityX(0);
    }

    // Tilt the plane based on velocity
    const tilt = Phaser.Math.Clamp(this.plane.body!.velocity.x / 200, -0.4, 0.4);
    this.plane.setRotation(Math.PI / 2 + tilt);
  }
}
