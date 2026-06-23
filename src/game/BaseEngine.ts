import * as Phaser from 'phaser';
import type { ThemeManifest, TermItem, GameLaunchConfig, XapiEvent } from '../lib/types';
import { ThemeAtlas, Juice, Hud } from './Juice';
import { WorldEffectsManager, WORLD_CONFIGS } from './WorldEffects';
import { audioBus } from '../lib/audio';
import { getLod } from '../lib/lod';
import { makeAnsweredEvent, makeCompletedEvent, pushEvent, getActor, verifyTelemetry } from '../lib/telemetry';
import { loadProfile, recordAnswer as recordAdaptive, recordGameCompletion, isBossLevel, createBossBattle, getStoryBeat, type StudentProfile, type BossBattle } from '../lib/adaptive';
import { earnStarDust, loadStarDust, getCurrentEvolution } from '../lib/stardust';

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

  // AAAA — Adaptive difficulty + Story mode
  protected profile: StudentProfile;
  protected bossBattle?: BossBattle;
  protected bossHealthBar?: Phaser.GameObjects.Rectangle;
  protected bossHealthBg?: Phaser.GameObjects.Rectangle;
  protected bossEmoji?: Phaser.GameObjects.Text;
  protected bossName?: Phaser.GameObjects.Text;
  protected storyOverlay?: Phaser.GameObjects.Container;

  // AAAA — Cinematic UI
  protected comboMeter?: Phaser.GameObjects.Container;
  protected comboFill?: Phaser.GameObjects.Rectangle;
  protected comboText?: Phaser.GameObjects.Text;

  // AAAA — World Effects Manager (world-specific gameplay + ambient)
  protected worldEffects?: WorldEffectsManager;
  protected worldScoreMultiplier = 1.0;
  protected worldTimerMultiplier = 1.0;

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
    // AAAA — Load adaptive profile
    this.profile = loadProfile();
  }

  create() {
    // Build the theme atlas (procedural texture pack)
    ThemeAtlas.build(this, this.theme);

    // Paint background — use camera background color (more reliable than generated texture)
    this.cameras.main.setBackgroundColor(this.theme.bg);

    // AAAA — Cinematic camera fade-in on scene start (300ms from black)
    try {
      this.cameras.main.fadeIn(300, 0, 0, 0);
    } catch {}

    // AAAA — Initialize World Effects Manager
    // Each world now has UNIQUE gameplay effects, not just visual skins!
    this.worldEffects = new WorldEffectsManager(this, this.theme);
    const mod = this.worldEffects.getModifier();
    this.worldScoreMultiplier = mod.scoreMultiplier;
    this.worldTimerMultiplier = mod.timerMultiplier;

    // AAAA — Play theatrical world intro, THEN build the game world
    this.worldEffects.playIntro(() => {
      // After intro completes, start ambient particles + build game
      this.worldEffects?.startAmbient();
      this.buildWorldWithEffects();
    });

    // Try to add the illustrated background image (may not render in Phaser 4 WebGL)
    const bgKey = 'bg-' + this.theme.id;
    if (this.textures.exists(bgKey)) {
      try {
        this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(this.scale.width, this.scale.height).setDepth(-10);
      } catch { /* ignore texture errors */ }
    }
  }

  // ===========================================================================
  // buildWorldWithEffects — called after theatrical intro completes
  // Sets up HUD, combo meter, level badge, then calls subclass buildWorld()
  // ===========================================================================
  protected buildWorldWithEffects() {
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

    // AAAA — COMBO METER: visual streak counter on the left side of screen
    // Shows current streak with animated fill bar — like fighting games
    // (Removed vignette overlay — was causing scene time to freeze)
    this.comboMeter = this.add.container(20, this.scale.height / 2, []);
    this.comboMeter.setDepth(180).setAlpha(0); // hidden until streak > 1
    const comboBg = this.add.rectangle(0, 0, 8, 120, 0x000000, 0.5).setDepth(180);
    const comboFill = this.add.rectangle(0, 60, 6, 0, this.theme.warning, 1).setOrigin(0.5, 1).setDepth(181);
    const comboText = this.add.text(0, -75, 'x1', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(182);
    const comboLabel = this.add.text(0, 80, 'COMBO', {
      fontFamily: 'Inter, sans-serif', fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(182);
    this.comboMeter.add([comboBg, comboFill, comboText, comboLabel]);
    this.comboFill = comboFill;
    this.comboText = comboText;

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
      if (this.isFinished) return;
      try {
        const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
        this.onTick(remainingMs);
        if (remainingMs <= 0) this.finishGame(false);
      } catch (e) {
        // AAAA — Never let an exception in the update loop kill the game.
        // Log it but keep the loop alive so the player can still finish.
        console.error('[MiniStar] Update loop error (suppressed):', e);
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

    // AAAA — Adaptive: record this answer to the student profile
    const reactionMs = Date.now() - this.startTime - (this.score * 2000); // rough estimate
    try {
      this.profile = recordAdaptive(this.profile, opts.term, opts.success, Math.max(500, reactionMs));
    } catch {}

    // ===== MULTIPLAYER: push to live leaderboard if active =====
    const mp = (this.registry.get('launchConfig') as any)?.multiplayer;
    if (mp && typeof mp.submitAnswer === 'function') {
      try {
        mp.submitAnswer(opts.success, opts.term, opts.response);
      } catch {}
    }

    // AAAA — Boss battle: damage boss on correct, take damage on wrong
    if (this.bossBattle && !this.isFinished) {
      if (opts.success) {
        this.bossBattle.currentHealth = Math.max(0, this.bossBattle.currentHealth - this.bossBattle.damagePerCorrect);
        this.updateBossHealthBar();
        if (this.bossBattle.currentHealth <= 0) {
          // Boss defeated!
          audioBus.play('win');
          this.juice.confettiRain(2000);
          this.juice.zoomPunch(1.06, 400);
          this.showBossDefeated();
        }
      } else {
        // Wrong answer = boss attacks (visual feedback only, no game over)
        this.juice.shake('heavy');
        this.juice.flash(this.theme.danger, 0.3, 200);
      }
    }

    if (opts.success) {
      this.score++;
      this.streak++;
      // AAAA — Update combo meter
      this.updateComboMeter();
      // AAAA — Mobile haptic feedback (subtle on correct, stronger on streak)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(this.streak >= 3 ? [15, 30, 30] : 12); } catch {}
      }
      // AAAA — THROTTLED effects: only fire the essentials to prevent tween
      // manager overload. Previous code fired 7+ simultaneous effects on
      // streak 3, which froze the scene.
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, this.streak >= 3 ? 'streak' : 'correct');
        this.juice.shake('light');
        this.juice.scorePopup(
          opts.coordinate?.x ?? this.scale.width / 2,
          opts.coordinate?.y ?? this.scale.height / 2,
          this.streak >= 3 ? `STREAK x${this.streak}!` : '+1',
          this.streak >= 3 ? this.theme.warning : this.theme.success
        );
        // Only fire glow ring + zoom punch on milestone streaks (3, 5, 7)
        // NOT every correct answer — prevents effect stacking
        if (this.streak === 3 || this.streak === 5 || this.streak === 7) {
          this.juice.glowRing(
            opts.coordinate?.x ?? this.scale.width / 2,
            opts.coordinate?.y ?? this.scale.height / 2,
            this.theme.warning,
            120
          );
          // Removed zoomPunch here — it conflicts with level-up zoomPunch
        }
      } catch (e) { /* ignore juice errors */ }
      // ESL: speak the correct term aloud when answered correctly
      // (user explicitly tapped — this is user-initiated, not automatic)
      audioBus.speak(opts.term);
      // AAAA — World-specific mascot phrase (not just "correct")
      if (this.worldEffects) {
        const phrase = this.worldEffects.getPhrase('correct');
        setTimeout(() => { try { audioBus.speak(phrase); } catch {} }, 600);
      }
      // Pitch-rising streak audio: each correct in a row goes up a semitone
      const baseFreq = 660;
      const streakFreq = baseFreq * Math.pow(2, Math.min(this.streak, 12) / 12);
      audioBus.play('correct', { freq: streakFreq });
      // Hit-stop on streaks (weighty game feel)
      if (this.streak >= 3) {
        try { this.juice.hitStop(60); } catch {}
      }
      // AAAA — Earn Star Dust (scaled by world multiplier + streak bonus)
      const starDustEarned = Math.round((10 + this.streak * 2) * this.worldScoreMultiplier);
      try {
        earnStarDust(starDustEarned, this.scene.key);
        // Floating Star Dust popup
        this.juice.scorePopup(
          (opts.coordinate?.x ?? this.scale.width / 2) + 40,
          (opts.coordinate?.y ?? this.scale.height / 2) - 30,
          `+${starDustEarned} ⭐`,
          0xfbbf24  // gold
        );
      } catch {}
      // Check for level up
      this.checkLevelUp();
    } else {
      this.streak = 0;
      // AAAA — Hide combo meter on wrong answer
      this.updateComboMeter();
      // AAAA — Mobile haptic feedback (long buzz on wrong answer)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([30, 50, 60]); } catch {}
      }
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

    // AAAA — Cinematic camera flash on game end (safe — wrapped in try/catch
    // and doesn't conflict with zoomPunch because finishGame only fires once)
    try {
      this.cameras.main.flash(400, this.theme.success, this.theme.success, this.theme.success, true);
    } catch {}

    const durationMs = Date.now() - this.startTime;
    // AAAA — Record game completion in adaptive profile
    try {
      this.profile = recordGameCompletion(this.profile, won);
    } catch {}
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
      // AAAA — World-specific win celebration (emoji rain)
      this.worldEffects?.playWinCelebration();
      // AAAA — World-specific win phrase
      if (this.worldEffects) {
        const phrase = this.worldEffects.getPhrase('win');
        setTimeout(() => { try { audioBus.speak(phrase); } catch {} }, 500);
      }
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
      // Destroy the game — the React layer will show the library
      this.game.destroy(true);
    });

    // AAAA — SWITCH TEMPLATE: show a row of game icons the player can
    // switch to. Same terms, different game. Wordwall's killer feature.
    const switchLabel = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 130,
      'Play same words as:',
      { fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(501).setAlpha(0);

    const switchGames = [
      { mode: 'quiz', emoji: '❓', name: 'Quiz' },
      { mode: 'maze-chase', emoji: '🧭', name: 'Maze' },
      { mode: 'balloon-pop', emoji: '🎈', name: 'Balloon' },
      { mode: 'memory-match', emoji: '🃏', name: 'Memory' },
      { mode: 'match-up', emoji: '🔗', name: 'Match' },
      { mode: 'anagram', emoji: '🔤', name: 'Anagram' },
    ];
    const currentMode = (this.registry.get('launchConfig') as any)?.mode;
    const btnSize = 50;
    const btnSpacing = 56;
    const switchBtns: Phaser.GameObjects.Text[] = [];
    switchGames.forEach((g, i) => {
      const sx = this.scale.width / 2 + (i - (switchGames.length - 1) / 2) * btnSpacing;
      const isCurrent = g.mode === currentMode;
      const sb = this.add.text(sx, this.scale.height / 2 + 165, g.emoji, {
        fontFamily: 'Inter, sans-serif', fontSize: '28px',
      }).setOrigin(0.5).setDepth(502).setAlpha(0).setInteractive({ useHandCursor: true });

      if (isCurrent) {
        sb.setScale(1.2).setTint(this.theme.warning);
      }

      sb.on('pointerover', () => { if (!isCurrent) sb.setScale(1.15); });
      sb.on('pointerout', () => { if (!isCurrent) sb.setScale(1); });
      sb.on('pointerdown', () => {
        if (isCurrent) return;
        audioBus.play('tap');
        // Signal the React layer to switch games
        const cfg = this.registry.get('launchConfig') as any;
        const switchData = { mode: g.mode, theme: cfg.theme, terms: cfg.terms, unit: cfg.unit, tenantId: cfg.tenantId };
        this.registry.set('switchGame', switchData);
        this.game.destroy(true);
      });
      switchBtns.push(sb);
    });

    // Print button — generates a printable PDF worksheet
    const printBtn = this.add.text(
      this.scale.width / 2, this.scale.height / 2 + 220,
      '🖨️ Print Worksheet',
      { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(501).setAlpha(0).setInteractive({ useHandCursor: true });

    printBtn.on('pointerover', () => printBtn.setScale(1.05));
    printBtn.on('pointerout', () => printBtn.setScale(1));
    printBtn.on('pointerdown', () => {
      audioBus.play('tap');
      const cfg = this.registry.get('launchConfig') as any;
      const printData = { mode: currentMode, terms: cfg.terms, theme: cfg.theme };
      this.registry.set('printRequest', printData);
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
    const animTargets: any[] = [overlay, titleText, subText, statsText, btnBg, btn, btnBg2, btn2, switchLabel, printBtn, ...switchBtns];
    this.tweens.add({
      targets: animTargets,
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
  // ALSO implements universal tap-to-speak: ANY text object that has been
  // registered via makeSpeakable() will be read aloud when tapped, BEFORE
  // the scene-specific handler runs. This means students can tap the
  // question prompt, any label, any option text, etc. to hear it.
  // ===========================================================================
  protected setupGlobalPointer(handler: (x: number, y: number) => void) {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Cancel any in-progress speech on user activity (prevents overlap)
      audioBus.stopSpeaking();

      // UNIVERSAL TAP-TO-SPEAK: check all children for speakText data
      const speakText = this.findSpeakableAt(p.x, p.y);
      if (speakText) {
        // Tap-to-speak: speak the text and don't also fire game logic
        // (prevents accidental answers when student just wanted to hear text)
        audioBus.speak(speakText, { isQuestion: speakText.includes('?') });
        // Small haptic feedback on mobile
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(8); } catch {}
        }
        return;
      }

      handler(p.x, p.y);
    });
  }

  /**
   * Find any display object at (x, y) that has speakText data.
   * Searches the entire display list (including container children).
   * Returns the speakText string if found, null otherwise.
   */
  private findSpeakableAt(x: number, y: number): string | null {
    // Iterate over all display list children (top-most first by depth)
    const all: Phaser.GameObjects.GameObject[] = [];
    this.children.each((child) => { all.push(child); return true; });

    // Sort by depth descending so top-most objects are hit-tested first
    all.sort((a: any, b: any) => (b.depth ?? 0) - (a.depth ?? 0));

    for (const child of all as any[]) {
      const speakText = child.getData && child.getData('speakText');
      if (!speakText) continue;

      // Recursively check container children too
      const found = this.checkSpeakableBounds(child, x, y, speakText);
      if (found) return found;
    }
    return null;
  }

  private checkSpeakableBounds(obj: any, x: number, y: number, speakText: string): string | null {
    // Direct hit test on this object
    if (this.pointInBounds(obj, x, y)) return speakText;

    // If it's a container, also check its children for speakable text
    if (obj.list && Array.isArray(obj.list)) {
      for (const child of obj.list) {
        const childSpeak = child.getData && child.getData('speakText');
        if (childSpeak && this.pointInBounds(child, x, y)) {
          return childSpeak;
        }
      }
    }
    return null;
  }

  private pointInBounds(obj: any, x: number, y: number): boolean {
    if (!obj || obj.visible === false || obj.alpha === 0) return false;
    // Get object's world bounds if available
    if (typeof obj.getBounds === 'function') {
      try {
        const bounds = obj.getBounds();
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          return true;
        }
        return false;
      } catch {}
    }
    // Fallback: use x/y/width/height with origin
    const w = obj.width ?? 100;
    const h = obj.height ?? 30;
    const ox = obj.originX ?? 0.5;
    const oy = obj.originY ?? 0.5;
    const left = obj.x - w * ox;
    const right = obj.x + w * (1 - ox);
    const top = obj.y - h * oy;
    const bottom = obj.y + h * (1 - oy);
    return x >= left && x <= right && y >= top && y <= bottom;
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
    if (!this.levelBadge) return;
    // Update badge text
    this.levelBadge.setText(`LEVEL ${this.level}`);
    // ESC: speak the level up
    audioBus.speak(`Level ${this.level}!`);
    // AAAA — Throttled celebration. Use setTimeout for any timed callbacks
    // to avoid Phaser's delayedCall queue (which can get stuck).
    try {
      this.juice.confettiRain(1000);
      this.juice.scorePopup(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `LEVEL ${this.level}!`,
        this.theme.warning
      );
    } catch {}
    // Pulse the badge — guard against destroyed objects
    if (this.levelBadge.active && this.levelBg?.active) {
      try {
        this.tweens.add({
          targets: [this.levelBadge, this.levelBg],
          scale: { from: 1, to: 1.3 },
          duration: 200, yoyo: true, repeat: 2, ease: 'Back.out',
        });
      } catch {}
    }

    // AAAA — Story beat on chapter change (every 5 levels)
    const beat = getStoryBeat(Math.ceil(this.level / 5));
    if (beat && this.level % 5 === 1 && this.level > 1) {
      setTimeout(() => {
        try { this.showStoryBeat(beat); } catch {}
      }, 800);
    }

    // AAAA — Boss battle every 5 levels
    if (isBossLevel(this.level)) {
      setTimeout(() => {
        try { this.startBossBattle(); } catch {}
      }, 600);
    }
  }

  // ===========================================================================
  // AAAA — COMBO METER: visual streak indicator (console-game style)
  // ===========================================================================
  protected updateComboMeter() {
    if (!this.comboMeter || !this.comboFill || !this.comboText) return;
    try {
      if (this.streak > 1) {
        // Show + animate
        this.comboMeter.setAlpha(1);
        this.comboText.setText(`x${this.streak}`);
        // Fill height proportional to streak (capped at 10)
        const fillH = Math.min(120, this.streak * 12);
        // AAAA — Guard: only add tween if comboFill is still active
        if (this.comboFill.active) {
          this.tweens.add({
            targets: this.comboFill,
            height: fillH,
            duration: 200, ease: 'Back.out',
          });
        }
        // Color shifts: 2-4 = warning (gold), 5+ = danger (red)
        const color = this.streak >= 5 ? this.theme.danger : this.theme.warning;
        this.comboFill.setFillStyle(color, 1);
        this.comboText.setColor('#' + color.toString(16).padStart(6, '0'));
        // Pulse on update — guard against destroyed objects
        if (this.comboMeter.active) {
          this.tweens.add({
            targets: this.comboMeter,
            scale: { from: 1.15, to: 1 },
            duration: 200, ease: 'Back.out',
          });
        }
      } else {
        // Fade out
        if (this.comboMeter.active) {
          this.tweens.add({
            targets: this.comboMeter,
            alpha: 0, scale: 0.8,
            duration: 300, ease: 'Cubic.in',
          });
        }
      }
    } catch (e) {
      console.error('[MiniStar] updateComboMeter error (suppressed):', e);
    }
  }

  // ===========================================================================
  // AAAA — STORY BEAT OVERLAY (narrative moment)
  // ===========================================================================
  private showStoryBeat(beat: { emoji: string; title: string; text: string }) {
    try {
      const overlay = this.add.rectangle(
        this.scale.width / 2, this.scale.height / 2,
        this.scale.width, this.scale.height,
        0x000000, 0.85
      ).setDepth(800).setAlpha(0);

      const emoji = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 100,
        beat.emoji, { fontSize: '64px' }
      ).setOrigin(0.5).setDepth(801).setAlpha(0);

      const title = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 30,
        beat.title, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '28px', color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
          fontStyle: 'bold',
        }
      ).setOrigin(0.5).setDepth(801).setAlpha(0);

      const text = this.add.text(
        this.scale.width / 2, this.scale.height / 2 + 30,
        beat.text, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px', color: '#ffffff',
          align: 'center', wordWrap: { width: 600 },
        }
      ).setOrigin(0.5).setDepth(801).setAlpha(0);

      const hint = this.add.text(
        this.scale.width / 2, this.scale.height / 2 + 130,
        'Tap to continue', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px', color: '#ffffff',
        }
      ).setOrigin(0.5).setDepth(801).setAlpha(0);

      this.tweens.add({
        targets: [overlay, emoji, title, text, hint],
        alpha: { from: 0, to: 1 },
        duration: 600, ease: 'Cubic.out',
      });

      // Tap to dismiss
      const dismiss = () => {
        this.tweens.add({
          targets: [overlay, emoji, title, text, hint],
          alpha: 0, duration: 400, ease: 'Cubic.in',
          onComplete: () => {
            overlay.destroy(); emoji.destroy(); title.destroy();
            text.destroy(); hint.destroy();
          },
        });
        this.input.off('pointerdown', dismiss);
      };
      this.time.delayedCall(1500, () => {
        this.input.on('pointerdown', dismiss);
      });

      audioBus.speak(beat.text.slice(0, 200));
    } catch {}
  }

  // ===========================================================================
  // AAAA — BOSS BATTLE (every 5 levels)
  // ===========================================================================
  private startBossBattle() {
    try {
      this.bossBattle = createBossBattle(this.level);
      // Boss UI at top of screen
      const bossY = 100;
      this.bossEmoji = this.add.text(
        this.scale.width / 2, bossY, this.bossBattle.emoji, { fontSize: '48px' }
      ).setOrigin(0.5).setDepth(300).setScale(0);

      this.bossName = this.add.text(
        this.scale.width / 2, bossY + 35,
        this.bossBattle.name, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '18px', color: '#' + this.theme.danger.toString(16).padStart(6, '0'),
          fontStyle: 'bold',
        }
      ).setOrigin(0.5).setDepth(301).setScale(0);

      // Health bar
      const barW = 300, barH = 16;
      this.bossHealthBg = this.add.rectangle(
        this.scale.width / 2, bossY + 60, barW + 4, barH + 4,
        0x000000, 0.7
      ).setStrokeStyle(2, this.theme.danger, 0.8).setDepth(301).setScale(0);
      this.bossHealthBar = this.add.rectangle(
        this.scale.width / 2 - barW / 2, bossY + 60, barW, barH,
        this.theme.danger, 1
      ).setOrigin(0, 0.5).setDepth(302).setScale(0);

      // Animate boss entrance
      this.tweens.add({
        targets: [this.bossEmoji, this.bossName, this.bossHealthBg, this.bossHealthBar],
        scale: 1, duration: 600, ease: 'Back.out',
      });

      audioBus.speak(`Boss battle! ${this.bossBattle.name}!`);
      audioBus.play('launch');
      this.juice.shake('heavy');
      this.juice.flash(this.theme.danger, 0.3, 300);
    } catch {}
  }

  private updateBossHealthBar() {
    if (!this.bossBattle || !this.bossHealthBar) return;
    const pct = this.bossBattle.currentHealth / this.bossBattle.maxHealth;
    this.tweens.add({
      targets: this.bossHealthBar,
      width: 300 * pct,
      duration: 300, ease: 'Cubic.out',
    });
  }

  private showBossDefeated() {
    if (!this.bossEmoji) return;
    // Boss fades out with explosion
    this.juice.burst(this.bossEmoji.x, this.bossEmoji.y, 'win');
    this.tweens.add({
      targets: [this.bossEmoji, this.bossName, this.bossHealthBg, this.bossHealthBar],
      alpha: 0, scale: 0,
      duration: 600, ease: 'Cubic.in',
      onComplete: () => {
        this.bossEmoji?.destroy();
        this.bossName?.destroy();
        this.bossHealthBg?.destroy();
        this.bossHealthBar?.destroy();
        this.bossBattle = undefined;
      },
    });
    audioBus.speak('Boss defeated! Great job!');
    this.juice.scorePopup(
      this.scale.width / 2, this.scale.height / 2 - 80,
      'BOSS DEFEATED!', this.theme.success
    );
  }

  // ===========================================================================
  // ESL TEXT-TO-SPEECH HELPERS
  // ===========================================================================

  /** Speak the active prompt term aloud (called when a new prompt is shown) */
  protected speakPrompt(term: string, definition?: string) {
    audioBus.speakTerm(term, definition);
  }

  /** Make a text object speak its content when tapped (ESL tap-to-hear).
   *  The global pointer handler in setupGlobalPointer automatically detects
   *  any object with `speakText` data and reads it aloud — students can
   *  tap ANY text (questions, options, labels) to hear it spoken.
   *
   *  This method also adds a small 🔊 speaker icon next to the text as a
   *  visual hint that the text is tappable for audio. */
  protected makeSpeakable(text: Phaser.GameObjects.Text, speechText?: string) {
    text.setData('speakText', speechText ?? text.text);
    // Visual hint: subtle 🔊 icon offset to the right of the text
    // (only if not already added)
    if (!text.getData('speakHintAdded')) {
      text.setData('speakHintAdded', true);
      try {
        const hint = this.add.text(
          (text.x + (text.width ?? 0) / 2 + 14),
          text.y,
          '🔊',
          { fontFamily: 'Inter, sans-serif', fontSize: '14px' }
        ).setOrigin(0.5).setDepth((text.depth ?? 0) + 1).setAlpha(0.55);
        text.setData('speakHint', hint);
        // Pulse the hint subtly to draw attention
        this.tweens.add({
          targets: hint,
          alpha: { from: 0.4, to: 0.75 },
          duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      } catch {}
    }
  }
}
