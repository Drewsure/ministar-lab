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
  protected termsPerLevel = 3; // every 3 correct answers = level up (5 levels total: 0-2, 3-5, 6-8, 9-11, 12+)
  // DRAMA: Urgency vignette for time pressure (all 24 games)
  protected urgencyVignette?: Phaser.GameObjects.Graphics;
  protected urgencyActive = false;

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
            yoyo: true, repeat: 50, ease: 'Sine.inOut',
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

    // DRAMA: Urgency vignette — red pulsing border that activates when time < 20%
    // This adds visible tension to ALL 24 Phaser games without per-scene code
    this.urgencyVignette = this.add.graphics();
    this.urgencyVignette.setDepth(400);
    this.urgencyVignette.setVisible(false);
    this.urgencyActive = false;

    // DRAMA: Pause/Quit button overlay — visible in top-left corner of all 24 games.
    // Tapping it pauses the game and shows a menu with Resume + Quit options.
    // This ensures every game has a "way out" (AA input robustness requirement).
    this._createPauseButton();

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

    // CRITICAL FIX: Kill all tweens + remove all timer events on scene shutdown.
    // This is the PRODUCTION FIX used by Phaser games in the wild:
    // https://git.atdunbg.xyz/Super_Z/stellar-drift/commit/0c139f5eeb
    //
    // Phaser's scene shutdown destroys game objects but leaves their tweens
    // running in the TweenManager. On the next frame, the TweenManager tries
    // to update tweens on destroyed objects → this.ease is null → crash.
    //
    // The fix: listen for SHUTDOWN event, kill all tweens + remove all timers
    // BEFORE Phaser destroys the objects.
    this.events.once('shutdown', () => {
      try { this.tweens.killAll(); } catch {}
      try { this.time.removeAllEvents(); } catch {}
    });
    this.events.once('destroy', () => {
      try { this.tweens.killAll(); } catch {}
      try { this.time.removeAllEvents(); } catch {}
    });

    // CRITICAL: Periodic tween cleanup sweep — every 8 seconds, kill all
    // tweens. This prevents tween accumulation across rounds which causes
    // "this.ease is not a function" crashes at level 3+.
    // Visual effect tweens (scorePopup, burst, etc.) complete in <2 seconds,
    // so killing every 8s only affects long-running decorative tweens.
    this.time.addEvent({
      delay: 8000,
      loop: true,
      callback: () => {
        if (this.isFinished) return;
        try { this.tweens.killAll(); } catch {}
      },
    });

    // ALSO: Override GameObject.destroy to kill tweens targeting the object
    // BEFORE destruction (catches mid-gameplay destroys, not just shutdown).
    const PhaserNS = Phaser as any;
    if (PhaserNS.GameObjects && PhaserNS.GameObjects.GameObject &&
        !PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched) {
      PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched = true;
      const originalDestroy = PhaserNS.GameObjects.GameObject.prototype.destroy;
      PhaserNS.GameObjects.GameObject.prototype.destroy = function (fromScene?: boolean) {
        if (this.scene && this.scene.tweens) {
          try { this.scene.tweens.killTweensOf(this); } catch {}
        }
        return originalDestroy.call(this, fromScene);
      };
    }
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

  protected onHudUpdate(state: { score: number; streak: number; remainingMs: number }) {
    // DRAMA: Activate urgency vignette when time < 20% remaining
    // This adds visible red pulsing border to ALL 24 games — dramatic tension
    if (state.remainingMs < 60000 && !this.urgencyActive && !this.isFinished) {
      // 60000ms = 1 minute (20% of 5-minute default timer)
      this.urgencyActive = true;
      if (this.urgencyVignette) {
        this.urgencyVignette.setVisible(true);
        // Pulsing red border
        this.tweens.add({
          targets: this.urgencyVignette,
          alpha: { from: 0.3, to: 0.7 },
          duration: 500, yoyo: true, repeat: 50, ease: 'Sine.inOut',
        });
      }
      audioBus.play('countdown'); // urgency audio cue
    }
    // Redraw vignette each update (cheap — just 4 rectangles)
    if (this.urgencyActive && this.urgencyVignette) {
      const w = this.scale.width;
      const h = this.scale.height;
      const bw = 20; // border width
      this.urgencyVignette.clear();
      this.urgencyVignette.fillStyle(this.theme.danger, 0.5);
      this.urgencyVignette.fillRect(0, 0, w, bw); // top
      this.urgencyVignette.fillRect(0, h - bw, w, bw); // bottom
      this.urgencyVignette.fillRect(0, 0, bw, h); // left
      this.urgencyVignette.fillRect(w - bw, 0, bw, h); // right
    }
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
      // STABILITY: Reduced simultaneous effects to prevent tween manager overload.
      // Prior sessions had 5-6 simultaneous tweens per correct answer + 10+ on
      // streak milestones. This overwhelmed Phaser's tween manager, causing
      // tweens to silently fail → flash/scorePopup overlays never destroyed →
      // screen covered in stacked semi-transparent rectangles → perceived freeze.
      // FIX: Only fire burst + scorePopup on every correct. Reserve glowRing +
      // zoomPunch for level-up only (not every streak milestone). Remove hitStop
      // entirely (it paused physics world and could fail to resume).
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, this.streak >= 3 ? 'streak' : 'correct');
        this.juice.scorePopup(
          opts.coordinate?.x ?? this.scale.width / 2,
          opts.coordinate?.y ?? this.scale.height / 2,
          this.streak >= 3 ? `STREAK x${this.streak}!` : '+1',
          this.streak >= 3 ? this.theme.warning : this.theme.success
        );
      } catch (e) { /* ignore juice errors */ }
      // ESL: speak the correct term aloud when answered correctly
      audioBus.speak(opts.term);
      // Pitch-rising streak audio: each correct in a row goes up a semitone
      const baseFreq = 660;
      const streakFreq = baseFreq * Math.pow(2, Math.min(this.streak, 12) / 12);
      audioBus.play('correct', { freq: streakFreq });
      // REMOVED: hitStop — was pausing physics world and could fail to resume,
      // causing permanent freeze in all physics-based games.
      // Check for level up (glowRing + zoomPunch only fire on level-up, not every streak)
      this.checkLevelUp();
    } else {
      this.streak = 0;
      // STABILITY: Reduced to burst + scorePopup only. Removed shake + flash
      // to prevent tween manager overload (same root cause as correct-answer freeze).
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, 'incorrect');
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

    // CRITICAL: Kill ALL tweens to prevent "this.ease is not a function" crash.
    // Infinite tweens (repeat: 50) on scene objects keep running after game end.
    // When those objects are destroyed, the tween's internal ease function
    // reference becomes invalid → crash on next tween step.
    // Fix: kill all tweens in the scene's tween manager.
    try { this.tweens.killAll(); } catch {}

    // Also destroy urgency vignette specifically (has infinite tween)
    if (this.urgencyVignette) {
      try { this.urgencyVignette.destroy(); } catch {}
      this.urgencyVignette = undefined;
    }
    this.urgencyActive = false;

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
      // SIMPLIFIED: Only burst + scorePopup. Removed confettiRain + zoomPunch +
      // glowRing — these create 5+ simultaneous tweens at game end → crash.
      try {
        this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win');
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

    // AAA 2029 — Detailed stats breakdown + XP + tokens + best score
    const accuracy = this.maxScore > 0 ? Math.round((this.score / this.maxScore) * 100) : 0;
    const timeSec = (durationMs / 1000).toFixed(1);
    const xpEarned = this.score * 10 + (this.score === this.maxScore ? 50 : 0);
    const tokensEarned = this.score * 5;
    const stars = won ? (this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1) : 0;

    // Track best score in registry (persists during session)
    const gameMode = this.scene.key;
    const bestKey = `best-score-${gameMode}`;
    const prevBest = (this.registry.get(bestKey) as number) || 0;
    const isNewBest = this.score > prevBest;
    if (isNewBest) this.registry.set(bestKey, this.score);

    const bestText = isNewBest ? '🏆 NEW BEST!' : `Best: ${prevBest}/${this.maxScore}`;
    const statsText = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 50,
      `Accuracy: ${accuracy}%  ·  Streak: ${this.streak}  ·  Time: ${timeSec}s\n⭐ ${stars}/3  ·  +${xpEarned} XP  ·  +${tokensEarned} tokens  ·  ${bestText}`,
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(501).setAlpha(0.8);

    // DRAMA: Achievement badges — based on Duolingo research
    // "Badge reward system is a core tactic to improve user retention through achievement"
    const badges: string[] = [];
    if (this.score === this.maxScore) badges.push('🏆 PERFECT GAME');
    if (this.streak >= 5) badges.push('🔥 ON FIRE (5+ streak)');
    if (this.streak >= 10) badges.push('💎 UNSTOPPABLE (10+ streak)');
    if (this.level >= 3) badges.push('⭐ LEVEL 3 REACHED');
    if (this.level >= 5) badges.push('👑 LEVEL 5 MASTER');
    if (durationMs < 30000 && this.score >= this.maxScore * 0.5) badges.push('⚡ SPEED DEMON');
    if (this.score === 0 && !won) badges.push('🌱 KEEP TRYING');

    if (badges.length > 0) {
      const badgeText = this.add.text(
        this.scale.width / 2, this.scale.height / 2 + 110,
        badges.join('  ·  '),
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: 500 },
        }
      ).setOrigin(0.5).setDepth(501);
    }

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

  // ===========================================================================
  // SAFE PULSE — Timer-based animation that replaces infinite tweens (repeat: 50)
  // WHY: Infinite tweens cause "this.ease is not a function" crashes when their
  // target is destroyed. Timer events are automatically cleaned up by
  // this.time.removeAllEvents() in the shutdown listener — no crash possible.
  // ===========================================================================
  protected safePulse(
    target: Phaser.GameObjects.GameObject | Phaser.GameObjects.Components.Transform | any,
    props: { scale?: { from: number; to: number }; alpha?: { from: number; to: number } },
    durationMs: number
  ): Phaser.Time.TimerEvent {
    const fromScale = props.scale?.from ?? 1;
    const toScale = props.scale?.to ?? 1;
    const fromAlpha = props.alpha?.from ?? 1;
    const toAlpha = props.alpha?.to ?? 1;
    let forward = true;
    return this.time.addEvent({
      delay: durationMs,
      loop: true,
      callback: () => {
        if (!target || !target.active) return;
        forward = !forward;
        const t = forward ? 1 : 0;
        if (props.scale && target.setScale) {
          const s = fromScale + (toScale - fromScale) * t;
          target.setScale(s);
        }
        if (props.alpha && target.setAlpha) {
          const a = fromAlpha + (toAlpha - fromAlpha) * t;
          target.setAlpha(a);
        }
      },
    });
  }

  // ===========================================================================
  // SAFE SPIN — Timer-based rotation that replaces infinite rotation tweens
  // ===========================================================================
  protected safeSpin(target: Phaser.GameObjects.GameObject | any, durationMs: number): Phaser.Time.TimerEvent {
    let angle = 0;
    return this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!target || !target.active) return;
        angle += (360 / (durationMs / 16));
        if (angle >= 360) angle -= 360;
        if (target.setAngle) target.setAngle(angle);
      },
    });
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
  // PAUSE/QUIT BUTTON — visible in all 24 games (AA input robustness)
  // ===========================================================================
  private pauseOverlay?: Phaser.GameObjects.Container;
  private _createPauseButton() {
    const btn = this.add.text(15, 95, '⏸', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
    }).setDepth(300).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      if (this.isFinished) return;
      if (this.scene.isPaused()) {
        this.scene.resume();
        if (this.pauseOverlay) { this.pauseOverlay.setVisible(false); }
      } else {
        this.scene.pause();
        this._showPauseOverlay();
      }
    });
  }

  private _showPauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.setVisible(true);
      return;
    }
    const overlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x000000, 0.7
    ).setDepth(450);

    const title = this.add.text(
      this.scale.width / 2, this.scale.height / 2 - 60,
      '⏸ Paused', {
        fontFamily: 'Inter, sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(451);

    const resumeBtn = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 10,
      '▶ Resume', {
        fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#22c55e', fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(451).setInteractive({ useHandCursor: true });

    resumeBtn.on('pointerdown', () => {
      this.scene.resume();
      if (this.pauseOverlay) this.pauseOverlay.setVisible(false);
    });

    const quitBtn = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 50,
      '✗ Quit to Library', {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#ef4444', fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(451).setInteractive({ useHandCursor: true });

    quitBtn.on('pointerdown', () => {
      try { this.game.destroy(true); } catch {}
    });

    this.pauseOverlay = this.add.container(0, 0, [overlay, title, resumeBtn, quitBtn]).setDepth(450);
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

  // ===========================================================================
  // DIFFICULTY MULTIPLIER — returns 1.0 at level 1, scaling up to 2.0 at level 5
  // Scenes use this to adjust speed, timer, enemy count, etc.
  // Research: "gradually increasing difficulty" is essential for flow state
  // ===========================================================================
  protected getDifficultyMultiplier(): number {
    return 1.0 + (this.level - 1) * 0.2; // L1=1.0, L2=1.2, L3=1.4, L4=1.6, L5=1.8
  }

  // ===========================================================================
  // SPEED BONUS — returns bonus XP based on answer speed
  // Research: Kahoot awards more points for faster answers
  // ===========================================================================
  protected getSpeedBonus(roundStartTime: number): number {
    const responseTime = Date.now() - roundStartTime;
    if (responseTime < 2000) return 5;  // <2s = +5 bonus
    if (responseTime < 4000) return 3;  // <4s = +3 bonus
    if (responseTime < 6000) return 1;  // <6s = +1 bonus
    return 0;
  }

  protected showLevelUp() {
    if (!this.levelBadge || !this.juice) return;
    try {
      // Update badge text
      this.levelBadge.setText(`LEVEL ${this.level}`);
      // DRAMA: Level badge color changes per level (visual progression)
      // L1=blue, L2=green, L3=yellow, L4=orange, L5=red
      const levelColors = [0x3b82f6, 0x22c55e, 0xfbbf24, 0xf97316, 0xef4444];
      const colorIdx = Math.min(this.level - 1, 4);
      const badgeColor = levelColors[colorIdx];
      this.levelBadge.setColor('#' + badgeColor.toString(16).padStart(6, '0'));
      if (this.levelBg) {
        this.levelBg.setStrokeStyle(2, badgeColor, 0.8);
      }

      audioBus.speak(`Level ${this.level}!`);
      this.juice.scorePopup(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `LEVEL ${this.level}!`,
        badgeColor
      );
      // Pulse the badge (finite tween — safe)
      this.tweens.add({
        targets: [this.levelBadge, this.levelBg],
        scale: { from: 1, to: 1.3 },
        duration: 200, yoyo: true, repeat: 2, ease: 'Back.out',
      });
      // DRAMA: Countdown audio at level 3+ (urgency increases)
      if (this.level >= 3) {
        audioBus.play('countdown');
      }
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
