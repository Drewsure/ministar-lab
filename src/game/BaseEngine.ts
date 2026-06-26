import * as Phaser from 'phaser';
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
  // AAA 2029 — Level progression system
  protected level = 1;
  protected levelBadge?: Phaser.GameObjects.Text;
  protected levelBg?: Phaser.GameObjects.Rectangle;
  protected termsPerLevel = 3; // every 3 correct answers = level up

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
    // CRASH GUARD: if init() didn't receive a config, theme is undefined.
    // This happens when Phaser auto-starts a scene before GameCanvas sets
    // the registry. Bail out gracefully instead of crashing on this.theme.bg.
    if (!this.theme) {
      console.error('[MiniStar] BaseEngine.create: no theme — scene aborted');
      // Try to recover from registry one more time
      const cfg = this.registry.get('launchConfig') as GameLaunchConfig | undefined;
      if (cfg?.theme) {
        this.theme = cfg.theme as unknown as ThemeManifest;
        this.terms = cfg.terms ?? [];
      } else {
        this.scene.stop();
        return;
      }
    }

    // Build the theme atlas (procedural texture pack)
    try {
      ThemeAtlas.build(this, this.theme);
    } catch (e) {
      console.error('[MiniStar] ThemeAtlas.build error:', e);
    }

    // Paint background — use camera background color (more reliable than generated texture)
    this.cameras.main.setBackgroundColor(this.theme.bg);

    // Try to add the illustrated background image (may not render in Phaser 4 WebGL)
    const bgKey = 'bg-' + this.theme.id;
    if (this.textures.exists(bgKey)) {
      try {
        this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(this.scale.width, this.scale.height).setDepth(-10);
      } catch { /* ignore texture errors */ }
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
    this.startTime = Date.now(); // Use real time, not Phaser game time (which accumulates)

    // AAA 2029 — Level badge (top-center, prominent like Wordwall)
    this.levelBg = this.add.rectangle(
      this.scale.width / 2, 45, 140, 44,
      0x000000, 0.7
    ).setStrokeStyle(2, this.theme.warning, 0.8).setDepth(250);
    this.levelBadge = this.add.text(
      this.scale.width / 2, 45,
      `LEVEL ${this.level}`,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(251);

    // Wire global pause key (P)
    this.input.keyboard?.on('keydown-P', () => {
      if (this.scene.isPaused()) this.scene.resume();
      else this.scene.pause();
    });

    // Subclass builds the actual game world
    this.buildWorld();

    // NOTE: Welcome speech removed — it was causing issues with TTS overlap.
    // TTS now only speaks when the user taps an interactive element.

    // HUD loop
    this.events.on('update', () => {
      try {
        if (this.isFinished) return;
        const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
        this.onTick(remainingMs);
        if (remainingMs <= 0) this.finishGame(false);
      } catch (e) {
        console.error('[MiniStar] Update loop error:', e);
      }
    });
  }

  // ===========================================================================
  // ESL GAME WELCOME — speaks instructions when game starts
  // ===========================================================================
  protected speakGameWelcome() {
    const gameMode = this.scene.key;
    const instructions: Record<string, string> = {
      'MazeChaseScene': 'Welcome to Maze Chase! Move through the maze and find the correct answer!',
      'QuizScene': 'Welcome to Quiz! Read the question and tap the correct answer!',
      'AirplaneScene': 'Welcome to Airplane! Steer your rocket and catch the correct answer!',
      'GameshowScene': 'Welcome to the Gameshow! Answer the question before time runs out!',
      'MemoryMatchScene': 'Welcome to Memory Match! Flip cards to find matching pairs!',
      'MatchUpScene': 'Welcome to Match Up! Drag the words to their meanings! Tap any text to hear it!',
      'BalloonPopScene': 'Welcome to Balloon Pop! Pop the balloon with the correct answer!',
      'WhackAMoleScene': 'Welcome to Whack a Mole! Bonk the mole with the correct answer!',
      'AnagramScene': 'Welcome to Anagram! Unscramble the letters to spell the word!',
      'WordsearchScene': 'Welcome to Word Search! Find the hidden words in the grid!',
      'BridgeBuilderScene': 'Welcome to Bridge Builder! Guess letters to help the rocket cross!',
      'CrosswordScene': 'Welcome to Crossword! Tap cells and type the answers!',
      'FlashCardsScene': 'Welcome to Flash Cards! Tap the card to flip and hear the word!',
      'SpinWheelScene': 'Welcome to Spin Wheel! Spin the wheel and match the answer!',
      'GroupSortScene': 'Welcome to Group Sort! Drag the words into the right boxes!',
      'TypeAnswerScene': 'Welcome to Type Answer! Read the meaning and type the word!',
      'SpotItScene': 'Welcome to Spot It! Find the matching symbol between the two cards! Be fast!',
    };
    const instruction = instructions[gameMode] ?? 'Welcome! Tap to play!';
    audioBus.speak(instruction);
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
    // CRASH GUARD: if juice/hud aren't initialized (scene still booting), bail
    if (!this.juice || !this.hud) {
      console.warn('[MiniStar] recordAnswer called before scene ready — skipping');
      return;
    }
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
      durationMs: Date.now() - this.startTime,
      coordinate: opts.coordinate,
      streak: this.streak,
      tenantId: this.tenantId,
    });
    this.answeredEvents.push(ev);
    pushEvent(ev);

    if (opts.success) {
      this.score++;
      this.streak++;
      // Stability: wrap juice calls in try-catch to prevent freezes
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, this.streak >= 3 ? 'streak' : 'correct');
        this.juice.shake('light');
        this.juice.flash(this.theme.success, 0.18, 100);
        this.juice.scorePopup(
          opts.coordinate?.x ?? this.scale.width / 2,
          opts.coordinate?.y ?? this.scale.height / 2,
          this.streak >= 3 ? `STREAK x${this.streak}!` : '+1',
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
      } catch (e) { /* ignore juice errors */ }
      // ESL: speak the correct term aloud when answered correctly
      // (user explicitly tapped — this is user-initiated, not automatic)
      audioBus.speak(opts.term);
      // Pitch-rising streak audio: each correct in a row goes up a semitone
      const baseFreq = 660;
      const streakFreq = baseFreq * Math.pow(2, Math.min(this.streak, 12) / 12);
      audioBus.play('correct', { freq: streakFreq });
      // Hit-stop on streaks (weighty game feel)
      if (this.streak >= 3) {
        try { this.juice.hitStop(60); } catch {}
      }
      // Check for level up
      this.checkLevelUp();
    } else {
      this.streak = 0;
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, 'incorrect');
        this.juice.shake('medium');
        this.juice.flash(this.theme.danger, 0.25, 140);
        this.juice.scorePopup(
          opts.coordinate?.x ?? this.scale.width / 2,
          opts.coordinate?.y ?? this.scale.height / 2,
          'X',
          this.theme.danger
        );
      } catch (e) { /* ignore juice errors */ }
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

    const durationMs = Date.now() - this.startTime;
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
    try { this.physics.world.pause(); } catch {}
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
      try { this.juice.shake('heavy'); } catch {}
    } else if (won) {
      try { this.hud.celebrate(); } catch {}
      try {
        this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win');
        // AAA 2029 — confetti rain + zoom punch on win
        this.juice.confettiRain(2500);
        this.juice.zoomPunch(1.06, 400);
        this.juice.glowRing(this.scale.width / 2, this.scale.height / 2, this.theme.success, 200);
      } catch {}
    } else {
      try { this.hud.sad(); } catch {}
    }

    const title = isQuarantined
      ? '⚠ SCORE QUARANTINED'
      : isReview
      ? '⎯ FLAGGED FOR REVIEW'
      : won
      ? this.score === this.maxScore ? 'PERFECT! 3 STARS!' : this.score >= this.maxScore * 0.7 ? 'GREAT JOB! 2 STARS!' : 'GOOD! 1 STAR!'
      : '⏱ TIME UP';

    const subtitle = isQuarantined
      ? verify.anomalyReason ?? 'anomaly detected'
      : isReview
      ? verify.anomalyReason ?? 'review required'
      : `Score: ${this.score} / ${this.maxScore}`;

    const titleText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 - 80,
      title,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '36px',
        color: '#' + statusColor.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(501);

    // AAA 2029 — Star rating display
    if (won) {
      const stars = this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1;
      const starSpacing = 50;
      const starY = this.scale.height / 2 - 30;
      for (let i = 0; i < 3; i++) {
        const filled = i < stars;
        const star = this.add.text(
          this.scale.width / 2 + (i - 1) * starSpacing, starY,
          filled ? '⭐' : '☆',
          {
            fontFamily: 'Inter, sans-serif',
            fontSize: '36px',
          }
        ).setOrigin(0.5).setDepth(501).setScale(0);
        // Animate stars appearing one by one
        this.tweens.add({
          targets: star,
          scale: 1,
          duration: 300, delay: 200 + i * 200, ease: 'Back.out',
        });
        if (filled) {
          this.time.delayedCall(200 + i * 200, () => {
            this.juice.burst(star.x, star.y, 'correct');
            audioBus.play('correct');
          });
        }
      }
    }

    const subText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 20,
      subtitle,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setDepth(501);

    // AAA 2029 — Detailed stats breakdown
    const accuracy = this.maxScore > 0 ? Math.round((this.score / this.maxScore) * 100) : 0;
    const timeSec = (durationMs / 1000).toFixed(1);
    const statsText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 50,
      `Accuracy: ${accuracy}%  ·  Best Streak: ${this.streak}  ·  Time: ${timeSec}s`,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(501).setAlpha(0.8);

    const btnBg = this.add.rectangle(
      this.scale.width / 2 - 110, this.scale.height / 2 + 80,
      180, 48, statusColor, 0.9
    ).setDepth(501);
    const btn = this.add.text(
      this.scale.width / 2 - 110, this.scale.height / 2 + 80,
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

    // "New Game" button — goes back to library (triggers onExit)
    const btnBg2 = this.add.rectangle(
      this.scale.width / 2 + 110, this.scale.height / 2 + 80,
      180, 48, this.theme.card, 0.9
    ).setStrokeStyle(2, this.theme.accent, 0.8).setDepth(501);
    const btn2 = this.add.text(
      this.scale.width / 2 + 110, this.scale.height / 2 + 80,
      'New Game',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(502).setInteractive({ useHandCursor: true });

    btn2.on('pointerover', () => btn2.setScale(1.05));
    btn2.on('pointerout', () => btn2.setScale(1));
    btn2.on('pointerdown', () => {
      audioBus.play('tap');
      // Tell React to exit the game canvas and show the library.
      // We dispatch a window event that GameCanvas listens for.
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ministar-exit-game'));
        }
      } catch {}
      // Destroy the Phaser game
      this.game.destroy(true);
    });

    // Animate overlay in
    overlay.setAlpha(0);
    titleText.setAlpha(0);
    subText.setAlpha(0);
    statsText.setAlpha(0);
    btnBg.setAlpha(0);
    btn.setAlpha(0);
    btnBg2.setAlpha(0);
    btn2.setAlpha(0);
    this.tweens.add({
      targets: [overlay, titleText, subText, statsText, btnBg, btn, btnBg2, btn2],
      alpha: { from: 0, to: 1 },
      duration: 400, ease: 'Cubic.out',
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

  // ===========================================================================
  // HIT TEST UTILITY — for global pointerdown handlers
  // Returns true if (px, py) is within the bounds of a game object
  // ===========================================================================
  protected hitTest(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle, px: number, py: number): boolean {
    const x = obj.x;
    const y = obj.y;
    let w = 100, h = 50;
    if ('width' in obj && obj.width) w = obj.width as number;
    if ('height' in obj && obj.height) h = obj.height as number;
    if ('size' in obj && typeof obj.size === 'function') {
      // Container — use default size
      w = 100; h = 50;
    }
    return px >= x - w / 2 && px <= x + w / 2 && py >= y - h / 2 && py <= y + h / 2;
  }

  // ===========================================================================
  // GLOBAL POINTER HANDLER — sets up a reliable pointerdown listener
  // that works even when Phaser's per-object input fails.
  // Also cancels any in-progress TTS on user activity.
  // ===========================================================================
  protected setupGlobalPointer(handler: (x: number, y: number) => void) {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Cancel any in-progress speech on user activity (prevents overlap)
      audioBus.stopSpeaking();
      handler(p.x, p.y);
    });
  }

  // ===========================================================================
  // AAA 2029 — LEVEL PROGRESSION SYSTEM
  // Every N correct answers triggers a level-up celebration.
  // ===========================================================================
  protected checkLevelUp() {
    const newLevel = Math.floor(this.score / this.termsPerLevel) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this.showLevelUp();
    }
  }

  protected showLevelUp() {
    if (!this.levelBadge || !this.juice) return;
    try {
      // Update badge text
      this.levelBadge.setText(`LEVEL ${this.level}`);
      // ESC: speak the level up
      audioBus.speak(`Level ${this.level}!`); // User earned this — speak it
      // Big celebration: zoom punch + glow ring + confetti + scale pulse
      this.juice.zoomPunch(1.08, 400);
      this.juice.glowRing(this.scale.width / 2, this.scale.height / 2, this.theme.warning, 200);
      this.juice.confettiRain(1500);
      this.juice.scorePopup(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `LEVEL ${this.level}!`,
        this.theme.warning
      );
      // Pulse the badge
      this.tweens.add({
        targets: [this.levelBadge, this.levelBg],
        scale: { from: 1, to: 1.3 },
        duration: 200, yoyo: true, repeat: 2, ease: 'Back.out',
      });
    } catch (e) {
      console.error('[MiniStar] showLevelUp error:', e);
    }
  }

  // ===========================================================================
  // ESL TEXT-TO-SPEECH HELPERS
  // ===========================================================================

  /** Speak the active prompt term aloud (called when a new prompt is shown) */
  protected speakPrompt(term: string, definition?: string) {
    audioBus.speakTerm(term, definition);
  }

  /** Make a text object speak its content when tapped (ESL tap-to-hear)
   *  NOTE: Phaser 4 per-object input is unreliable. The global pointer handler
   *  in each scene's setupGlobalPointer handles tap-to-speak.
   *  This method stores the speak text for reference but does NOT register
   *  its own pointerdown listener (which caused duplicate/repeated speech). */
  protected makeSpeakable(text: Phaser.GameObjects.Text, speechText?: string) {
    text.setData('speakText', speechText ?? text.text);
  }
}
