import Phaser from 'phaser';
import type { ThemeManifest, TermItem, GameLaunchConfig, XapiEvent } from '../lib/types';
import { ThemeAtlas, Juice, Hud } from './Juice';
import { audioBus } from '../lib/audio';
import { getLod } from '../lib/lod';
import { makeAnsweredEvent, makeCompletedEvent, pushEvent, getActor, verifyTelemetry } from '../lib/telemetry';

// ============================================================================
// BaseEngine — every game scene extends this.
// Provides:
//  - Procedural theme atlas build
//  - HUD (score / streak / timer / mascot)
//  - AAA Juice (particle bursts, shake, hit-stop, flash, squash)
//  - Audio bus hook
//  - Telemetry dispatch (xAPI)
//  - Win / Lose flow with anti-cheat verification
//  - Pause / Resume lifecycle
// ============================================================================

export abstract class BaseEngine extends Phaser.Scene {
  protected theme!: ThemeManifest;
  protected terms!: TermItem[];
  protected unit = 'unit-1';
  protected qrSlug?: string;
  protected tenantId?: string;
  protected studentId?: string;

  protected juice!: Juice;
  protected hud!: Hud;
  protected startTime = 0;
  protected score = 0;
  protected streak = 0;
  protected maxScore = 0;
  protected answeredEvents: XapiEvent[] = [];
  protected isFinished = false;
  protected lod = getLod();

  // Subclass contract
  protected abstract buildWorld(): void;
  protected abstract onTick(_remainingMs: number): void;
  protected abstract maxQuestions(): number;

  init(data: { config?: GameLaunchConfig }) {
    // Defensive: when Phaser auto-starts a scene, `data` may be undefined or empty.
    // Fall back to the registry-stored launch config in that case.
    const cfg = data?.config ?? (this.registry.get('launchConfig') as GameLaunchConfig | undefined);
    if (!cfg) {
      console.error('[MiniStar] BaseEngine.init: no launch config available!');
      return;
    }
    // Persist so restart() calls have the full manifest available.
    this.registry.set('launchConfig', cfg);
    this.theme = cfg.theme as unknown as ThemeManifest;
    this.terms = cfg.terms ?? [];
    this.unit = cfg.unit || 'unit-1';
    this.qrSlug = cfg.qrSlug;
    this.tenantId = cfg.tenantId;
    this.studentId = cfg.studentId;
    this.score = 0;
    this.streak = 0;
    this.isFinished = false;
    this.answeredEvents = [];
    this.maxScore = this.maxQuestions();
  }

  create() {
    // Build the theme atlas (procedural texture pack)
    ThemeAtlas.build(this, this.theme);

    // Paint background
    const bgKey = 'bg-' + this.theme.id;
    if (this.textures.exists(bgKey)) {
      this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(this.scale.width, this.scale.height);
    } else {
      this.cameras.main.setBackgroundColor(this.theme.bg);
    }

    // Parallax starfield (skipped on low LOD)
    if (this.lod.ambientParticles > 0) {
      const sfKey = 'starfield-' + this.theme.id;
      if (this.textures.exists(sfKey)) {
        for (let i = 0; i < Math.min(3, Math.ceil(this.lod.ambientParticles / 20)); i++) {
          const tile = this.add.tileSprite(
            Math.random() * this.scale.width,
            Math.random() * this.scale.height,
            200, 200, sfKey
          ).setAlpha(0.4).setDepth(-1);
          this.tweens.add({
            targets: tile,
            x: '+=10', y: '+=6',
            duration: 6000 + Math.random() * 4000,
            yoyo: true, repeat: -1, ease: 'Sine.inOut',
          });
        }
      }
    }

    // Juice + HUD
    this.juice = new Juice(this, this.theme);
    this.hud = new Hud(this, this.theme, (state) => this.onHudUpdate(state));
    this.startTime = this.time.now;

    // Wire global pause key (P)
    this.input.keyboard?.on('keydown-P', () => {
      if (this.scene.isPaused()) this.scene.resume();
      else this.scene.pause();
    });

    // Subclass builds the actual game world
    this.buildWorld();

    // HUD loop
    this.events.on('update', () => {
      if (this.isFinished) return;
      const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
      this.onTick(remainingMs);
      if (remainingMs <= 0) this.finishGame(false);
    });
  }

  protected onHudUpdate(_state: { score: number; streak: number; remainingMs: number }) {
    // subclasses can override
  }

  // ------------------------------------------------------------------------
  // Telemetry
  // ------------------------------------------------------------------------
  protected recordAnswer(opts: {
    term: string;
    response: string;
    success: boolean;
    coordinate?: { x: number; y: number; t: number };
  }) {
    const actor = getActor();
    const ev = makeAnsweredEvent({
      actor,
      gameMode: this.scene.key,
      unit: this.unit,
      term: opts.term,
      response: opts.response,
      success: opts.success,
      score: this.score,
      maxScore: this.maxScore,
      durationMs: this.time.now - this.startTime,
      coordinate: opts.coordinate,
      streak: this.streak,
      tenantId: this.tenantId,
    });
    this.answeredEvents.push(ev);
    pushEvent(ev);

    if (opts.success) {
      this.score++;
      this.streak++;
      this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, this.streak >= 3 ? 'streak' : 'correct');
      this.juice.shake('light');
      this.juice.flash(this.theme.success, 0.18, 100);
      // AAA 2029 additions — score popup + glow ring on streaks + zoom punch on big streaks
      this.juice.scorePopup(
        opts.coordinate?.x ?? this.scale.width / 2,
        opts.coordinate?.y ?? this.scale.height / 2,
        this.streak >= 3 ? `🔥 STREAK x${this.streak}!` : '+1',
        this.streak >= 3 ? this.theme.warning : this.theme.success
      );
      if (this.streak === 3 || this.streak === 5 || this.streak === 7) {
        this.juice.glowRing(
          opts.coordinate?.x ?? this.scale.width / 2,
          opts.coordinate?.y ?? this.scale.height / 2,
          this.theme.warning,
          120
        );
        this.juice.zoomPunch(1.04, 250);
      }
      audioBus.play('correct');
    } else {
      this.streak = 0;
      this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, 'incorrect');
      this.juice.shake('medium');
      this.juice.flash(this.theme.danger, 0.25, 140);
      // AAA 2029 — negative feedback popup
      this.juice.scorePopup(
        opts.coordinate?.x ?? this.scale.width / 2,
        opts.coordinate?.y ?? this.scale.height / 2,
        '✗',
        this.theme.danger
      );
      audioBus.play('incorrect');
    }
    this.hud.tick(this.score, this.streak, this.maxScore);
  }

  // ------------------------------------------------------------------------
  // Win / Lose flow with anti-cheat verification
  // ------------------------------------------------------------------------
  protected finishGame(won: boolean) {
    if (this.isFinished) return;
    this.isFinished = true;

    const durationMs = this.time.now - this.startTime;
    const actor = getActor();
    const completed = makeCompletedEvent({
      actor,
      gameMode: this.scene.key,
      unit: this.unit,
      totalCorrect: this.score,
      totalQuestions: this.maxScore,
      durationMs,
      streak: this.streak,
      tenantId: this.tenantId,
    });
    pushEvent(completed);

    // Run dual-verification gate
    const verify = verifyTelemetry({
      events: [...this.answeredEvents, completed],
      totalQuestions: this.maxScore,
      durationMs,
    });

    // Pause world, dim overlay, show result panel
    this.physics.world.pause();
    const overlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x000000, 0.65
    ).setDepth(500);

    const isQuarantined = verify.status === 'quarantine';
    const isReview = verify.status === 'review';
    const statusColor = isQuarantined
      ? this.theme.danger
      : isReview
      ? this.theme.warning
      : won
      ? this.theme.success
      : this.theme.danger;

    if (isQuarantined) {
      audioBus.play('quarantine');
      this.juice.shake('heavy');
    } else if (won) {
      this.hud.celebrate();
      this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win');
      // AAA 2029 — confetti rain + zoom punch on win
      this.juice.confettiRain(2500);
      this.juice.zoomPunch(1.06, 400);
      this.juice.glowRing(this.scale.width / 2, this.scale.height / 2, this.theme.success, 200);
    } else {
      this.hud.sad();
    }

    const title = isQuarantined
      ? '⚠ SCORE QUARANTINED'
      : isReview
      ? '⎯ FLAGGED FOR REVIEW'
      : won
      ? '🎉 PERFECT SCORE!'
      : '⏱ TIME UP';

    const subtitle = isQuarantined
      ? verify.anomalyReason ?? 'anomaly detected'
      : isReview
      ? verify.anomalyReason ?? 'review required'
      : `Score ${this.score} / ${this.maxScore} · ${(durationMs / 1000).toFixed(1)}s`;

    const titleText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 - 50,
      title,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '40px',
        color: '#' + statusColor.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(501);

    const subText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 10,
      subtitle,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setDepth(501);

    const btnBg = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2 + 80,
      200, 50, statusColor, 0.9
    ).setDepth(501);
    const btn = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 80,
      'Play Again',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#000000',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(502).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', () => {
      audioBus.play('tap');
      this.scene.restart({ config: this.registry.get('launchConfig') });
    });

    // Animate overlay in
    overlay.setAlpha(0);
    titleText.setAlpha(0);
    subText.setAlpha(0);
    btnBg.setAlpha(0);
    btn.setAlpha(0);
    this.tweens.add({
      targets: [overlay, titleText, subText, btnBg, btn],
      alpha: 1, duration: 400, ease: 'Cubic.out',
    });
  }

  // Helper used by subclasses to signal natural completion
  protected checkWin() {
    if (this.score >= this.maxScore && !this.isFinished) {
      this.time.delayedCall(400, () => this.finishGame(true));
    }
  }

  // Pick N random terms
  protected pickTerms(n: number): TermItem[] {
    const copy = [...this.terms];
    Phaser.Utils.Array.Shuffle(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }

  protected hex(c: number): string {
    return '#' + c.toString(16).padStart(6, '0');
  }
}
