import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// BALLOON POP — Pairing Engine  (AAA 2029 edition)
// ============================================================================
// Showcase game with:
//   • Glossy 3D-looking balloons (gradient + highlight + string)
//   • Themed carriers (UFO for space, submarine for ocean, cart for festival,
//     drone for cityscape, bird for jungle, ghost for haunted, etc.)
//   • Balloons rise from carriers at the bottom
//   • Pop animation: balloon bursts into colored confetti + sound
//   • Combo multiplier on rapid correct pops
//   • Level progression (inherited from BaseEngine)
//   • TTS on every prompt + tap-to-hear
// ============================================================================

interface Balloon {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  isCorrect: boolean;
  hit: boolean;
  glow: Phaser.GameObjects.Arc;
}

export default class BalloonPopScene extends BaseEngine {
  private balloons: Balloon[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private activePrompt?: TermItem;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private carrier!: Phaser.GameObjects.Container;
  private carrierX = 400;
  private lastCorrectTime = 0;
  private comboCount = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // ---- Prompt banner at top ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 95,
      this.scale.width - 40, 64,
      this.theme.card, 0.9
    ).setStrokeStyle(3, this.theme.accent, 0.7).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 95,
      'Pop the matching balloon!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Themed carrier at bottom (moves left-right, launches balloons) ----
    this.spawnCarrier();

    // ---- First prompt ----
    if (this.terms.length === 0) {
      this.finishGame(false);
      return;
    }
    this.activePrompt = this.terms[0];
    this.updatePrompt();

    // ---- Spawn loop ----
    this.spawnTimer = this.time.addEvent({
      delay: 1200, loop: true,
      callback: this.spawnBalloon,
      callbackScope: this,
    });

    // ---- Carrier patrol (move left-right) ----
    this.time.addEvent({
      delay: 50, loop: true,
      callback: this.updateCarrier,
      callbackScope: this,
    });

    // Global pointer handler for reliable balloon pops
    this.setupGlobalPointer((x, y) => {
      for (const b of this.balloons) {
        if (b.hit) continue;
        // Use larger hit radius for easier clicking (especially on mobile)
        if (Math.abs(x - b.container.x) < 45 && Math.abs(y - b.container.y) < 50) {
          // ESL: speak the balloon's term when tapped
          audioBus.speak(b.term.term);
          this.popBalloon(b);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {
    // Prompt is set in updatePrompt(), not every tick
  }

  // ===========================================================================
  // THEMED CARRIER — draws a vehicle based on theme
  // ===========================================================================
  private spawnCarrier() {
    const y = this.scale.height - 50;
    this.carrier = this.add.container(this.scale.width / 2, y).setDepth(30);
    this.carrierX = this.scale.width / 2;

    // Draw carrier based on theme
    switch (this.theme.id) {
      case 'space':       this.drawUFO(this.carrier); break;
      case 'ocean':       this.drawSubmarine(this.carrier); break;
      case 'jungle':      this.drawCart(this.carrier, 0x15803d); break;
      case 'festival':    this.drawFloat(this.carrier); break;
      case 'cityscape':   this.drawDrone(this.carrier); break;
      case 'candy':       this.drawCandyCart(this.carrier); break;
      case 'haunted':     this.drawGhostCarrier(this.carrier); break;
      case 'sports':      this.drawTeamBus(this.carrier); break;
      case 'christmas':   this.drawSleigh(this.carrier); break;
      case 'easter':      this.drawBunnyCarrier(this.carrier); break;
      default:            this.drawUFO(this.carrier);
    }

    // Glow under carrier
    const glow = this.add.circle(this.scale.width / 2, y + 15, 50, this.theme.accent, 0.2).setDepth(29);
    this.tweens.add({
      targets: glow,
      scale: { from: 1, to: 1.3 },
      alpha: { from: 0.2, to: 0.4 },
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  private drawUFO(c: Phaser.GameObjects.Container) {
    // Saucer body
    const body = this.add.ellipse(0, 0, 80, 24, 0x64748b, 1);
    body.setStrokeStyle(2, this.theme.accent, 0.8);
    // Dome
    const dome = this.add.arc(0, -10, 18, 180, 360, false, 0x22d3ee, 0.8);
    dome.setStrokeStyle(2, 0xffffff, 0.6);
    // Lights
    for (let i = -2; i <= 2; i++) {
      const light = this.add.circle(i * 14, 6, 2.5, this.theme.warning, 1);
      c.add(light);
      this.tweens.add({
        targets: light,
        alpha: { from: 1, to: 0.3 },
        duration: 400 + i * 50, yoyo: true, repeat: -1,
      });
    }
    c.add([body, dome]);
  }

  private drawSubmarine(c: Phaser.GameObjects.Container) {
    // Hull
    const hull = this.add.ellipse(0, 0, 90, 32, 0xfbbf24, 1);
    hull.setStrokeStyle(2, this.theme.accent, 0.8);
    // Conning tower
    const tower = this.add.rectangle(0, -18, 24, 16, 0xfbbf24, 1);
    tower.setStrokeStyle(2, this.theme.accent, 0.8);
    // Periscope
    const peri = this.add.rectangle(8, -28, 3, 12, 0x64748b, 1);
    // Window
    const window1 = this.add.circle(-20, 0, 6, 0x90e0ef, 1);
    window1.setStrokeStyle(1, 0xffffff, 0.6);
    c.add([hull, tower, peri, window1]);
  }

  private drawCart(c: Phaser.GameObjects.Container, color: number) {
    // Body
    const body = this.add.rectangle(0, -8, 80, 24, color, 1);
    body.setStrokeStyle(2, this.theme.accent, 0.8);
    // Wheels
    const w1 = this.add.circle(-25, 10, 10, 0x1e293b, 1);
    const w2 = this.add.circle(25, 10, 10, 0x1e293b, 1);
    w1.setStrokeStyle(2, 0x64748b, 0.8);
    w2.setStrokeStyle(2, 0x64748b, 0.8);
    // Spokes (rotating)
    this.tweens.add({ targets: [w1, w2], angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });
    c.add([body, w1, w2]);
  }

  private drawFloat(c: Phaser.GameObjects.Container) {
    // Parade float base
    const base = this.add.rectangle(0, 0, 90, 20, 0xc026d3, 1);
    base.setStrokeStyle(2, this.theme.warning, 0.8);
    // Decorative top
    const top = this.add.arc(0, -15, 25, 180, 360, false, 0xfbbf24, 0.9);
    top.setStrokeStyle(2, 0xfb7185, 0.8);
    // Flags
    for (let i = -1; i <= 1; i++) {
      const flag = this.add.triangle(i * 20, -30, -6, 0, 6, 0, 0, 10,
        i === 0 ? 0xfb7185 : (i < 0 ? 0x34d399 : 0x60a5fa), 1);
      c.add(flag);
    }
    c.add([base, top]);
  }

  private drawDrone(c: Phaser.GameObjects.Container) {
    // Body
    const body = this.add.rectangle(0, 0, 30, 16, 0x0f172a, 1);
    body.setStrokeStyle(2, this.theme.accent, 0.8);
    // Arms
    const arm1 = this.add.rectangle(-18, -2, 16, 3, 0x64748b, 1);
    const arm2 = this.add.rectangle(18, -2, 16, 3, 0x64748b, 1);
    // Propellers (spinning)
    const prop1 = this.add.ellipse(-22, -6, 18, 4, 0x22d3ee, 0.5);
    const prop2 = this.add.ellipse(22, -6, 18, 4, 0x22d3ee, 0.5);
    this.tweens.add({ targets: [prop1, prop2], angle: 360, duration: 100, repeat: -1, ease: 'Linear' });
    c.add([body, arm1, arm2, prop1, prop2]);
  }

  private drawCandyCart(c: Phaser.GameObjects.Container) {
    // Body (lollipop pattern)
    const body = this.add.rectangle(0, -8, 80, 24, 0xec4899, 1);
    body.setStrokeStyle(2, this.theme.warning, 0.8);
    // Lollipop on top
    const lolli = this.add.circle(0, -25, 12, 0xfbbf24, 1);
    lolli.setStrokeStyle(2, 0xec4899, 0.8);
    // Wheels
    const w1 = this.add.circle(-25, 10, 10, 0xfde047, 1);
    const w2 = this.add.circle(25, 10, 10, 0xfde047, 1);
    this.tweens.add({ targets: [w1, w2], angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });
    c.add([body, lolli, w1, w2]);
  }

  private drawGhostCarrier(c: Phaser.GameObjects.Container) {
    // Floating ghost
    const body = this.add.arc(0, 0, 24, 0, 180, false, 0xe2e8f0, 0.9);
    body.setStrokeStyle(2, 0xa3e635, 0.6);
    // Wavy bottom
    for (let i = -2; i <= 2; i++) {
      const bump = this.add.circle(i * 10, 18, 6, 0xe2e8f0, 0.9);
      c.add(bump);
    }
    // Eyes
    const e1 = this.add.circle(-8, -4, 3, 0x000000, 1);
    const e2 = this.add.circle(8, -4, 3, 0x000000, 1);
    c.add([body, e1, e2]);
    // Floating animation
    this.tweens.add({
      targets: c,
      y: c.y - 8,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  private drawTeamBus(c: Phaser.GameObjects.Container) {
    // Body
    const body = this.add.rectangle(0, -6, 90, 28, 0xfbbf24, 1);
    body.setStrokeStyle(2, 0x15803d, 0.8);
    // Windows
    for (let i = -1; i <= 1; i++) {
      const win = this.add.rectangle(i * 24, -10, 16, 10, 0x22d3ee, 0.8);
      c.add(win);
    }
    // Wheels
    const w1 = this.add.circle(-25, 12, 10, 0x1e293b, 1);
    const w2 = this.add.circle(25, 12, 10, 0x1e293b, 1);
    this.tweens.add({ targets: [w1, w2], angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });
    c.add([body, w1, w2]);
  }

  private drawSleigh(c: Phaser.GameObjects.Container) {
    // Sleigh body
    const body = this.add.rectangle(0, 0, 70, 20, 0xdc2626, 1);
    body.setStrokeStyle(2, 0xfbbf24, 0.8);
    // Sleigh runners
    const runner1 = this.add.rectangle(0, 12, 80, 4, 0x92400e, 1);
    // Gifts in sleigh
    const gift1 = this.add.rectangle(-15, -12, 18, 18, 0x22c55e, 1);
    gift1.setStrokeStyle(1, 0xfbbf24, 0.8);
    const gift2 = this.add.rectangle(10, -14, 14, 14, 0x3b82f6, 1);
    gift2.setStrokeStyle(1, 0xfbbf24, 0.8);
    // Ribbon
    const ribbon1 = this.add.rectangle(-15, -12, 2, 18, 0xfbbf24, 1);
    const ribbon2 = this.add.rectangle(10, -14, 2, 14, 0xfbbf24, 1);
    c.add([runner1, body, gift1, gift2, ribbon1, ribbon2]);
  }

  private drawBunnyCarrier(c: Phaser.GameObjects.Container) {
    // Basket body
    const body = this.add.rectangle(0, 0, 70, 24, 0x92400e, 1);
    body.setStrokeStyle(2, 0xfde047, 0.8);
    // Basket weave pattern
    for (let i = -3; i <= 3; i++) {
      const weave = this.add.rectangle(i * 10, 0, 2, 24, 0x6b3e22, 0.5);
      c.add(weave);
    }
    // Eggs in basket
    const egg1 = this.add.ellipse(-15, -12, 14, 18, 0xf472b6, 1);
    const egg2 = this.add.ellipse(5, -14, 14, 18, 0x4ade80, 1);
    const egg3 = this.add.ellipse(18, -10, 12, 16, 0xa78bfa, 1);
    // Bunny ears sticking out
    const ear1 = this.add.ellipse(-5, -25, 6, 18, 0xffffff, 1);
    const ear2 = this.add.ellipse(8, -27, 6, 18, 0xffffff, 1);
    const earInner1 = this.add.ellipse(-5, -25, 3, 14, 0xfbcfe8, 0.8);
    const earInner2 = this.add.ellipse(8, -27, 3, 14, 0xfbcfe8, 0.8);
    c.add([body, egg1, egg2, egg3, ear1, ear2, earInner1, earInner2]);
  }

  private updateCarrier() {
    if (this.isFinished) return;
    // Patrol left-right
    this.carrierX += Math.sin(this.time.now / 1500) * 2;
    this.carrierX = Phaser.Math.Clamp(this.carrierX, 80, this.scale.width - 80);
    this.carrier.x = this.carrierX;
  }

  // ===========================================================================
  // BALLOON SPAWN — glossy 3D balloon with string, rises from carrier
  // ===========================================================================
  private spawnBalloon() {
    if (this.isFinished || !this.activePrompt) return;

    // 40% chance correct, 60% decoy
    const isCorrect = Math.random() < 0.4;
    const term = isCorrect
      ? this.activePrompt
      : Phaser.Utils.Array.GetRandom(this.terms.filter(t => t.id !== this.activePrompt!.id)) ?? this.activePrompt;
    if (!term) return;

    const startX = this.carrierX + Phaser.Math.Between(-30, 30);
    const startY = this.scale.height - 80;

    // ---- Glossy balloon (3D effect with gradient + highlight) ----
    const balloonColor = isCorrect ? this.theme.success : this.theme.card;
    const balloonColor2 = isCorrect ? this.theme.success : this.theme.cardAlt;

    // Outer glow (for correct balloons)
    const glow = this.add.circle(0, -10, 38, balloonColor, 0.15).setDepth(14);

    // Balloon body (ellipse)
    const body = this.add.ellipse(0, -10, 56, 64, balloonColor, 1);
    body.setStrokeStyle(2, this.theme.accent, 0.6);

    // Inner gradient (darker bottom)
    const inner = this.add.ellipse(0, 0, 50, 50, balloonColor2, 0.4);

    // Highlight (glossy shine — top-left)
    const highlight = this.add.ellipse(-12, -22, 16, 22, 0xffffff, 0.6);
    const highlight2 = this.add.ellipse(-8, -18, 6, 8, 0xffffff, 0.8);

    // Knot at bottom
    const knot = this.add.triangle(0, 22, -4, 0, 4, 0, 0, 6, balloonColor2, 1);

    // String
    const stringGfx = this.add.graphics();
    stringGfx.lineStyle(1.5, 0xffffff, 0.7);
    stringGfx.beginPath();
    stringGfx.moveTo(0, 26);
    stringGfx.lineTo(2, 40);
    stringGfx.lineTo(-2, 54);
    stringGfx.lineTo(1, 68);
    stringGfx.strokePath();

    // Term text on balloon — bigger and with term name for readability
    const txt = this.add.text(0, -8, term.emoji ?? term.term.slice(0, 6), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    txt.setShadow(0, 2, '#000000', 3, true, true);

    // Term name below emoji (smaller, for ESL reading)
    const nameTxt = this.add.text(0, 12, term.term.slice(0, 8), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    nameTxt.setShadow(0, 1, '#000000', 2, true, true);

    const container = this.add.container(startX, startY, [
      glow, body, inner, highlight, highlight2, knot, stringGfx, txt, nameTxt
    ]).setSize(56, 70).setInteractive({ useHandCursor: true }).setDepth(15);

    const b: Balloon = { container, term, isCorrect, hit: false, glow };
    container.setData('balloon', b);
    this.balloons.push(b);

    // Pop-in animation (scale from 0)
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 300, ease: 'Back.out',
    });

    // AAAA — Balloon rise speed: SLOWER at start (12s), gets faster per level
    // Level 1=12s, Level 2=10s, Level 3=8s, Level 4=6s, Level 5=5s
    const riseDuration = Math.max(5000, 12000 - (this.level - 1) * 2000) + Math.random() * 1000;
    this.tweens.add({
      targets: container,
      y: -80,
      duration: riseDuration,
      ease: 'Sine.inOut',
      onComplete: () => {
        if (container.active) {
          container.destroy();
          this.balloons = this.balloons.filter(x => x !== b);
        }
      },
    });
    // Gentle wobble (horizontal sway)
    this.tweens.add({
      targets: container,
      x: `+=${Phaser.Math.Between(15, 30)}`,
      duration: 800 + Math.random() * 400,
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // NOTE: per-container pointerdown removed — the global handler in
    // setupGlobalPointer handles balloon taps. Double-listening caused
    // popBalloon() to fire twice on a single tap.
  }

  // ===========================================================================
  // POP — burst animation with confetti
  // ===========================================================================
  private popBalloon(b: Balloon) {
    if (b.hit) return;
    b.hit = true;

    const isCorrect = b.isCorrect;
    audioBus.play('pop');
    this.recordAnswer({
      term: this.activePrompt!.term,
      response: b.term.term,
      success: isCorrect,
      coordinate: { x: b.container.x, y: b.container.y, t: this.time.now },
    });

    // Big particle burst
    this.juice.burst(b.container.x, b.container.y, isCorrect ? 'correct' : 'incorrect');

    // Pop animation: scale up + fade
    this.tweens.add({
      targets: b.container,
      scale: 1.8, alpha: 0,
      duration: 250, ease: 'Back.in',
      onComplete: () => b.container.destroy(),
    });
    this.balloons = this.balloons.filter(x => x !== b);

    if (isCorrect) {
      // Combo system: rapid correct pops within 2.5s increase combo
      const now = this.time.now;
      if (now - this.lastCorrectTime < 2500) {
        this.comboCount++;
        if (this.comboCount >= 2) {
          this.juice.scorePopup(b.container.x, b.container.y, `COMBO x${this.comboCount}!`, this.theme.warning);
          this.juice.glowRing(b.container.x, b.container.y, this.theme.warning, 80);
        }
      } else {
        this.comboCount = 1;
      }
      this.lastCorrectTime = now;

      // Advance to next prompt
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
        this.updatePrompt();
      } else {
        this.activePrompt = undefined;
        this.promptText.setText('All balloons popped!');
      }
      this.checkWin();
    }
  }

  private updatePrompt() {
    if (!this.activePrompt) {
      this.promptText.setText('All balloons popped!');
      return;
    }
    this.promptText.setText(`Pop: ${this.activePrompt.emoji ?? ''} ${this.activePrompt.term}`);


  }
}
