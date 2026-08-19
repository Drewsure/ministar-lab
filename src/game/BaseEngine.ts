import * as Phaser from 'phaser';
import type { ThemeManifest, TermItem, GameLaunchConfig, XapiEvent } from '../lib/types';
import { ThemeAtlas, Juice, Hud } from './Juice';
import { audioBus } from '../lib/audio';
import { getLod } from '../lib/lod';
import { makeAnsweredEvent, makeCompletedEvent, pushEvent, getActor, verifyTelemetry } from '../lib/telemetry';
import { GlobalPoolManager } from './GlobalPoolManager';
import { EventBus, GAME_EVENTS } from './EventBus';
import { KidsJuice } from './KidsJuice';

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
  protected totalAttempts = 0; // AAAA: tracks ALL attempts (correct + wrong) for real accuracy
  protected answeredEvents: XapiEvent[] = [];
  protected isFinished = false;
  protected _isPaused = false;
  protected lod = getLod();
  protected level = 1;
  protected levelBadge?: Phaser.GameObjects.Text;
  protected levelBg?: Phaser.GameObjects.Rectangle;
  protected termsPerLevel = 3;
  protected urgencyVignette?: Phaser.GameObjects.Graphics;
  protected urgencyActive = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private _lastSfxTime = 0;

  // IRONCLAD-POLISH — Rigid input debounce (100ms). Used by game-action
  // pointerdown handlers (NOT by setupGlobalPointer itself) to filter out
  // erratic touch patterns: rapid multi-tap, sliding fingers, kid mashing.
  // The pause button, spin button, and other UI controls bypass this because
  // the debounce check is added INSIDE game-action handlers, not in the
  // global pointer dispatcher.
  private _lastInputTime = 0;
  protected _INPUT_DEBOUNCE_MS = 100;

  // AAA ARCHITECTURE: Global Pool Manager + Event Bus
  protected poolManager: GlobalPoolManager = GlobalPoolManager.getInstance();
  protected eventBus: EventBus = new EventBus();

  // AAAA KIDS MODE — Auto-celebration opt-out (games with custom celebrations)
  protected _skipAutoCelebrate = false;

  // AAAA KIDS MODE — Auto-mascot (themed emoji per game, bottom-right corner)
  protected _skipAutoMascot = false;
  protected _mascot?: Phaser.GameObjects.Text;
  protected _mascotBaseX = 0;
  protected _mascotBaseY = 0;
  protected _mascotState: 'idle' | 'celebrate' = 'idle';
  private _mascotBobTween?: Phaser.Tweens.Tween;
  private _mascotChinTapEvent?: Phaser.Time.TimerEvent;

  // AAAA KIDS MODE — Persistent sticker book (localStorage)
  protected _skipAutoStickerBook = false;
  private _stickerBadge?: Phaser.GameObjects.Container;
  private _stickerBadgeText?: Phaser.GameObjects.Text;
  private static readonly STICKER_STORAGE_KEY = 'ministar-sticker-collection';
  private static readonly STICKER_EMOJIS = ['⭐', '🌟', '💫', '✨', '🎯', '🌈', '🏆', '🎀', '🎈', '🦄'];

  // AAAA KIDS MODE — Slow Mode + Extended Time (localStorage-backed)
  private static readonly SLOW_MODE_KEY = 'ministar-slow-mode';
  private static readonly EXTENDED_TIME_KEY = 'ministar-extended-time';
  private _slowModeCache: boolean | null = null;
  private _extendedTimeCache: boolean | null = null;

  // CINEMATIC SPECTACLE — Game Show Decorator (camera + stage lighting)
  // Set _cinematicIdleEnabled = true in any game's buildWorld() to enable
  // the subtle low-frequency camera drift (sine-wave ±2px/±1px) that keeps
  // the scene feeling alive without being distracting.
  protected _cinematicIdleEnabled = false;
  private _stageLightingColorIdx = 0;
  private static readonly _STAGE_LIGHTING_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];

  // AAAA KIDS MODE — Per-game themed mascot emojis
  private static readonly _MASCOT_EMOJIS: Record<string, string> = {
    'MazeChaseScene': '🦊', 'QuizScene': '🐶', 'AirplaneScene': '🚀',
    'GameshowScene': '🤖', 'MemoryMatchScene': '🧠', 'MatchUpScene': '🔗',
    'BalloonPopScene': '🎈', 'WhackAMoleScene': '🔨', 'AnagramScene': '🔤',
    'WordsearchScene': '🔍', 'BridgeBuilderScene': '🌉', 'CrosswordScene': '📝',
    'FlashCardsScene': '📇', 'SpinWheelScene': '⭐', 'GroupSortScene': '🗃️',
    'TypeAnswerScene': '⌨️', 'SpotItScene': '👁️', 'EndlessRunnerScene': '🏃',
    'PhysicsPuzzlerScene': '🎯', 'SnakingScene': '🐍', 'SpeakItScene': '🗣️',
    'TrainingAcademyScene': '🎓', 'RescueQuestScene': '🦸', 'LabelItScene': '🏷️',
    'StarFarmScene': '👨‍🌾', 'TreasureHuntScene': '🏴‍☠️', 'MonsterFighterScene': '⚔️',
    'TowerDefenseScene': '🏰', 'RhythmTapScene': '🎵', 'SpaceExplorerScene': '🚀',
    'StoryAdventureScene': '📖', 'FarmLifeScene': '🚜',
  };

  protected abstract buildWorld(): void;
  protected abstract onTick(_remainingMs: number): void;
  protected abstract maxQuestions(): number;

  // ===========================================================================
  // AAAA KIDS MODE — Slow Mode + Extended Time API
  // ===========================================================================
  protected isSlowMode(): boolean {
    if (this._slowModeCache === null) {
      try {
        this._slowModeCache = typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(BaseEngine.SLOW_MODE_KEY) === 'true' : false;
      } catch { this._slowModeCache = false; }
    }
    return this._slowModeCache;
  }

  protected isExtendedTime(): boolean {
    if (this._extendedTimeCache === null) {
      try {
        this._extendedTimeCache = typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(BaseEngine.EXTENDED_TIME_KEY) === 'true' : false;
      } catch { this._extendedTimeCache = false; }
    }
    return this._extendedTimeCache;
  }

  /** Speed multiplier: 0.7 if slow mode, 1.0 otherwise. */
  protected timeMultiplier(): number { return this.isSlowMode() ? 0.7 : 1.0; }

  /** Question count multiplier: 1.5 if extended time, 1.0 otherwise. */
  protected questionMultiplier(): number { return this.isExtendedTime() ? 1.5 : 1.0; }

  static setSlowMode(enabled: boolean) {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(BaseEngine.SLOW_MODE_KEY, String(enabled)); } catch {}
  }

  static setExtendedTime(enabled: boolean) {
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(BaseEngine.EXTENDED_TIME_KEY, String(enabled)); } catch {}
  }

  static getSlowMode(): boolean {
    try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(BaseEngine.SLOW_MODE_KEY) === 'true' : false; } catch { return false; }
  }

  static getExtendedTime(): boolean {
    try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(BaseEngine.EXTENDED_TIME_KEY) === 'true' : false; } catch { return false; }
  }

  static getStickerCount(): number {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return 0;
      const raw = window.localStorage.getItem(BaseEngine.STICKER_STORAGE_KEY);
      return raw ? JSON.parse(raw).count ?? 0 : 0;
    } catch { return 0; }
  }

  init(data: { config?: GameLaunchConfig }) {
    const cfg = data?.config ?? (this.registry.get('launchConfig') as GameLaunchConfig | undefined);
    if (!cfg) { console.error('[MiniStar] No launch config'); return; }
    this.registry.set('launchConfig', cfg);
    this.theme = cfg.theme as unknown as ThemeManifest;
    this.terms = cfg.terms ?? [];
    this.unit = cfg.unit || 'unit-1';
    this.qrSlug = cfg.qrSlug;
    this.tenantId = cfg.tenantId;
    this.studentId = cfg.studentId;
    this.score = 0; this.streak = 0; this.isFinished = false; this.totalAttempts = 0;
    this.answeredEvents = []; this.level = 1;
    // AAAA KIDS MODE — Apply Extended Time multiplier (+50% questions when enabled).
    const baseMax = this.maxQuestions();
    const extended = Math.round(baseMax * this.questionMultiplier());
    this.maxScore = Math.min(extended, Math.max(baseMax, this.terms.length));
  }

  create() {
    // AAA ARCHITECTURE: Initialize Global Pool Manager for this scene
    this.poolManager.init(this);

    // AAA ARCHITECTURE: Wire up Event Bus listeners
    // VFX system listens for burst/flash/shake/popup events
    this.eventBus.on(GAME_EVENTS.VFX_BURST, (p: { x: number; y: number; kind: any }) => {
      try { this.juice?.burst(p.x, p.y, p.kind); } catch {}
    });
    this.eventBus.on(GAME_EVENTS.VFX_FLASH, (p: { color: number; alpha: number; durationMs: number }) => {
      try { this.juice?.flash(p.color, p.alpha, p.durationMs); } catch {}
    });
    this.eventBus.on(GAME_EVENTS.VFX_SHAKE, (p: { intensity: any }) => {
      try { this.juice?.shake(p.intensity); } catch {}
    });
    this.eventBus.on(GAME_EVENTS.VFX_POPUP, (p: { x: number; y: number; text: string; color: number }) => {
      try { this.juice?.scorePopup(p.x, p.y, p.text, p.color); } catch {}
    });

    // AAAA KIDS MODE — Mascot celebrates + sticker awarded on every correct answer.
    this.eventBus.on(GAME_EVENTS.ANSWER_CORRECT, () => {
      try { if (!this._skipAutoMascot) this._mascotCelebrate(); } catch {}
      try { if (!this._skipAutoStickerBook) this._awardSticker(); } catch {}
    });

    ThemeAtlas.build(this, this.theme);
    this.cameras.main.setBackgroundColor(this.theme.bg);
    const bgKey = 'bg-' + this.theme.id;
    if (this.textures.exists(bgKey)) {
      try { this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(this.scale.width, this.scale.height).setDepth(-10); } catch {}
    }
    if (this.lod.ambientParticles > 0) {
      const sfKey = 'starfield-' + this.theme.id;
      if (this.textures.exists(sfKey)) {
        for (let i = 0; i < Math.min(3, Math.ceil(this.lod.ambientParticles / 20)); i++) {
          const tile = this.add.tileSprite(Math.random() * this.scale.width, Math.random() * this.scale.height, 200, 200, sfKey).setAlpha(0.4).setDepth(-1);
        }
      }
    }
    this.juice = new Juice(this, this.theme);
    this.hud = new Hud(this, this.theme, (state) => this.onHudUpdate(state));
    this.startTime = Date.now();

    // Level badge — TOP-RIGHT corner (separated from Score which is top-left).
    // Was at x=80 same area as Score badge — caused collision/blur in top-left.
    // Now sits in the top-right with a clear gap from the timer.
    const lvlX = Math.max(this.scale.width - 260, 360);
    this.levelBg = this.add.rectangle(lvlX, 45, 120, 36, 0x000000, 0.7).setStrokeStyle(2, this.theme.warning, 0.8).setDepth(250);
    this.levelBadge = this.add.text(lvlX, 45, `LVL ${this.level}`, { fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold' }).setOrigin(0.5).setDepth(251);

    // Urgency vignette
    this.urgencyVignette = this.add.graphics();
    this.urgencyVignette.setDepth(400).setVisible(false);
    this.urgencyActive = false;

    // Pause button
    this._createPauseButton();

    // Pause key — centralized via _togglePause (sets timeScale + pauses physics)
    this.input.keyboard?.on('keydown-P', () => {
      if (this.isFinished) return;
      this._togglePause();
    });

    this.buildWorld();

    // AAAA KIDS MODE — Auto-create companion mascot + sticker badge (unless opted out).
    if (!this._skipAutoMascot) {
      this.time.delayedCall(100, () => this._createAutoMascot());
    }
    if (!this._skipAutoStickerBook) {
      this.time.delayedCall(150, () => this._createStickerBadge());
    }

    // Skip entrance card — it was causing input delays and confusion.
    // The game starts immediately after buildWorld.
    // Camera fade in is quick (300ms) and doesn't block input.
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Spoken instructions on entry
    this.time.delayedCall(600, () => { if (!this.isFinished) this.speakGameInstructions(); });

    // HUD loop
    this.events.on('update', () => {
      try {
        if (this.isFinished || this._isPaused) return; // FIX: skip update when paused
        const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
        this.onTick(remainingMs);
        if (remainingMs <= 0) this.finishGame(false);
      } catch (e) { console.error('[MiniStar] Update loop error:', e); }
    });

    // CRITICAL: Shutdown/destroy cleanup
    this.events.once('shutdown', () => {
      try { this.tweens.killAll(); } catch {}
      try { this.time.removeAllEvents(); } catch {}
      // AAA: Flush pool + destroy event bus on shutdown
      this.poolManager.flushAll();
      this.eventBus.removeAllListeners();
      // AAAA: Cleanup auto-mascot
      try { this._mascotChinTapEvent?.remove(); } catch {}
      try { this._mascotBobTween?.stop(); } catch {}
      try { this._mascot?.destroy(); } catch {}
      this._mascot = undefined;
      // AAAA: Cleanup sticker badge
      try { this._stickerBadge?.destroy(); } catch {}
      this._stickerBadge = undefined;
      // AAAA: Cleanup KidsJuice highlights
      try { KidsJuice.clearHighlights(this as any); } catch {}
    });
    this.events.once('destroy', () => {
      try { this.tweens.killAll(); } catch {}
      try { this.time.removeAllEvents(); } catch {}
      this.poolManager.flushAll();
      this.eventBus.destroy();
    });

    // NOTE: The periodic `tweens.killAll()` every 8s was REMOVED — it was the
    // ROOT CAUSE of the "stuck cards" bug in Memory Match. When it fired during
    // a card-flip animation (scaleX 1→0→1), the tween's onComplete never ran,
    // leaving the card permanently stuck in a half-flip state (scaleX=0,
    // isFlipped=true, back still visible, unclickable). Phaser's tween manager
    // auto-GCs completed tweens, so this carpet-bomb was unnecessary.
    // The shutdown/destroy handlers above + GameObject.destroy override below
    // are sufficient for cleanup.

    // GameObject.destroy override
    const PhaserNS = Phaser as any;
    if (PhaserNS.GameObjects?.GameObject?.prototype && !PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched) {
      PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched = true;
      const origDestroy = PhaserNS.GameObjects.GameObject.prototype.destroy;
      PhaserNS.GameObjects.GameObject.prototype.destroy = function (fromScene?: boolean) {
        if (this.scene?.tweens) { try { this.scene.tweens.killTweensOf(this); } catch {} }
        return origDestroy.call(this, fromScene);
      };
    }
  }

  // GC FIX: Static instruction map — created once, not per scene instance
  private static readonly _GAME_INSTRUCTIONS: Record<string, string> = {
    'MazeChaseScene': 'Welcome to Maze Chase! Move through the maze, collect the correct words, and dodge the ghosts! Use arrow keys or tap to move.',
    'QuizScene': 'Welcome to Quiz! Read each question, tap to hear it, then tap the correct answer!',
    'AirplaneScene': 'Welcome to Rocket! Steer your rocket left and right to catch the correct clouds! Watch out for storm clouds!',
    'GameshowScene': 'Welcome to the Gameshow! Answer each question before time runs out!',
    'MemoryMatchScene': 'Welcome to Memory Match! Flip cards to find matching pairs! Tap any card to hear it!',
    'MatchUpScene': 'Welcome to Match Up! Drag the words on the left to their meanings on the right! Tap any text to hear it!',
    'BalloonPopScene': 'Welcome to Balloon Pop! Pop balloons to drop words into matching definitions!',
    'WhackAMoleScene': 'Welcome to Whack a Mole! Bonk the mole showing the correct answer! They pop up fast!',
    'AnagramScene': 'Welcome to Anagram! Tap the letters in the correct order to spell the word!',
    'WordsearchScene': 'Welcome to Word Search! Drag across letters to find the hidden words!',
    'BridgeBuilderScene': 'Welcome to Bridge Builder! Guess letters to spell the word!',
    'CrosswordScene': 'Welcome to Crossword! Tap a cell, then type letters to fill in the grid!',
    'FlashCardsScene': 'Welcome to Flash Cards! Tap a card to flip it and hear the word!',
    'SpinWheelScene': 'Welcome to Spin Wheel! Spin the wheel, then match the term to its definition!',
    'GroupSortScene': 'Welcome to Group Sort! Drag each word into the correct category box!',
    'TypeAnswerScene': 'Welcome to Type Answer! Read the meaning, then type the correct word!',
    'SpotItScene': 'Welcome to Spot It! Find the one symbol that appears on both cards! Tap it fast!',
    'EndlessRunnerScene': 'Welcome to Endless Runner! Switch lanes to catch the correct word! Tap left or right side of screen!',
    'PhysicsPuzzlerScene': 'Welcome to Physics Puzzler! Aim your cannon and fire at the correct word block!',
    'SnakingScene': 'Welcome to Word Snake! Guide the snake to eat the correct word! Use arrow keys or tap to steer!',
    'SpeakItScene': 'Welcome to Speak It! Listen to the word, then tap the matching word below!',
    'TrainingAcademyScene': 'Welcome to Training Academy! Say the action command to make the mascot move!',
    'RescueQuestScene': 'Welcome to Rescue Quest! Say the verb to clear each obstacle and rescue the friend!',
    'LabelItScene': 'Welcome to Label It! Tap the word that matches the definition!',
    'StarFarmScene': 'Welcome to Star Farm! A complete farming adventure! Tap the hoe, then tap a tile to till soil. Water it, plant seeds, and harvest crops!',
  };

  protected speakGameInstructions() {
    const instruction = BaseEngine._GAME_INSTRUCTIONS[this.scene.key] ?? 'Welcome! Tap to play!';
    audioBus.speak(instruction);
  }

  // ===========================================================================
  // AAAA KIDS MODE — Shared prompt-highlight helper for all games
  // ===========================================================================
  // Convenience wrapper around KidsJuice.speakWithHighlight so individual
  // scenes don't need to import KidsJuice directly. Any game can call:
  //   this.speakPromptWithHighlight(this.promptText, 'Find the match!');
  // ===========================================================================
  protected speakPromptWithHighlight(
    textObj: Phaser.GameObjects.Text,
    text: string,
    opts: { rate?: number; pitch?: number; volume?: number; isQuestion?: boolean } = {}
  ) {
    try {
      KidsJuice.speakWithHighlight(this as any, textObj, text, opts);
    } catch (e) {
      console.error('[BaseEngine] speakPromptWithHighlight error:', e);
      // Fallback: just speak without highlight.
      try { audioBus.speak(text, opts); } catch {}
    }
  }

  // Clear all karaoke highlights (call on round transitions / scene shutdown).
  protected clearPromptHighlights() {
    try { KidsJuice.clearHighlights(this as any); } catch {}
  }

  // AAAA: Color Assist — global toggle for highlighting correct answers.
  // When ON (default): correct options get distinct color (green/gold).
  // When OFF: all options look identical — child must read/listen to decide.
  // All 32 games can call this.isColorAssist() to check the toggle.
  protected isColorAssist(): boolean {
    if (this._colorAssistCache === null) {
      try {
        this._colorAssistCache = typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('ministar-color-assist') !== 'false'
          : true;
      } catch { this._colorAssistCache = true; }
    }
    return this._colorAssistCache;
  }
  private _colorAssistCache: boolean | null = null;

  // ===========================================================================
  // AAAA — THREE-TIER JUICE LOOP (Juice-to-Cognition Ratio Enforcer)
  // ===========================================================================
  // Every player interaction gets a strict three-tier feedback architecture:
  //
  // Tier 1 — Immediate Physical Response (0-50ms):
  //   Squash-and-stretch matrix scaling on the tapped object using a bouncy
  //   cubic-bezier curve. scaleX→1.3, scaleY→0.7 instantly, then lerp back.
  //
  // Tier 2 — Neurological Validation (50-150ms):
  //   2-frame viewport freeze (Hit-Stop) via physics.world.pause() for ~33ms,
  //   then a burst of 8-12 high-contrast primary-colored particles behind the
  //   interaction point using juice.burst().
  //
  // Tier 3 — Persistent Structural Reward (150-500ms):
  //   A physics-based reward asset (⭐ emoji) spawns at the interaction point
  //   and accelerates toward the score UI anchor (top-center) using a spring-
  //   damper tween. Plays 'pop' on arrival.
  //
  // This method is GC-free: all objects are either pooled (juice.burst) or
  // destroyed via tween onComplete. No per-frame allocations.
  // ===========================================================================
  protected _threeTierJuice(x: number, y: number, target?: Phaser.GameObjects.GameObject) {
    try {
      // ---- TIER 1: Immediate Physical Response (0-50ms) ----
      // Squash-and-stretch on the target object (if provided).
      if (target && 'setScale' in target) {
        const obj = target as Phaser.GameObjects.GameObject & { setScale: (x: number, y: number) => any };
        // Instant squash: scaleX 1.3, scaleY 0.7 (compressed).
        obj.setScale(1.3, 0.7);
        // Bouncy cubic-bezier lerp back to (1, 1) over 250ms.
        this.tweens.add({
          targets: target,
          scaleX: 1, scaleY: 1,
          duration: 250,
          ease: 'Back.out', // cubic-bezier-like bouncy curve
        });
      }

      // ---- TIER 2: Neurological Validation (50-150ms) ----
      // Hit-Stop: 2-frame physics freeze (~33ms) for mechanical weight.
      try {
        this.physics.world.pause();
        this.time.delayedCall(33, () => {
          try { if (this.sys.isActive()) this.physics.world.resume(); } catch {}
        });
      } catch {}

      // Particle burst: 8-12 high-contrast primary-colored shapes.
      this.juice?.burst(x, y, 'correct');

      // ---- TIER 3: Persistent Structural Reward (150-500ms) ----
      // Spawn a ⭐ that flies to the score UI anchor (top-center, y=55).
      const star = this.add.text(x, y, '⭐', {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '24px',
      }).setOrigin(0.5).setDepth(200);

      // Spring-damper tween toward UI anchor (top-center of screen).
      const targetX = this.scale.width / 2;
      const targetY = 55;
      this.tweens.add({
        targets: star,
        x: targetX,
        y: targetY,
        scale: { from: 1.2, to: 0.4 },
        alpha: { from: 1, to: 0.7 },
        duration: 400,
        ease: 'Cubic.in', // accelerating = spring-damper feel
        onComplete: () => {
          try {
            // Pop on arrival.
            audioBus.play('pop');
            star.destroy();
          } catch {}
        },
      });
    } catch (e) {
      console.error('[BaseEngine] _threeTierJuice error:', e);
    }
  }

  // ===========================================================================
  // CINEMATIC SPECTACLE — Game Show Decorator
  // ===========================================================================
  // Three reusable cinematic helpers shared by ALL games. Wired into
  // milestone moments (combo 5/10/15, wave clears, perfect hits, kill
  // streaks) to deliver the "game show" feel without removing any existing
  // juice. All methods are wrapped in try/catch so a camera/tween failure
  // can NEVER crash the game loop.
  //
  // 1) _cinematicCamera(x, y) — focal zoom + pan + rumble on the action,
  //    then auto-resets to the default framing after 400ms.
  // 2) _cinematicIdle() — subtle sine-wave drift (±2px x, ±1px y) applied
  //    every frame. Skipped while paused or finished.
  // 3) _stageLighting(color) — 4 neon border rectangles flash + fade.
  //    Cycles through cyan/magenta/yellow/green on repeated calls.
  // ===========================================================================
  protected _cinematicCamera(targetX: number, targetY: number) {
    try {
      // 15% focal zoom onto the action.
      this.cameras.main.zoomTo(1.15, 200, 'Sine.easeInOut');
      // Pan toward the target so the player's eye is led to the moment.
      this.cameras.main.pan(targetX, targetY, 200, 'Sine.easeInOut');
      // Subtle rumble — 0.003 intensity is gentle (below nausea threshold).
      this.cameras.main.shake(120, 0.003);
      // Reset to default framing after the focal moment passes.
      this.time.delayedCall(400, () => {
        try {
          this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');
          this.cameras.main.pan(this.scale.width / 2, this.scale.height / 2, 300, 'Sine.easeInOut');
        } catch {}
      });
    } catch (e) {
      console.error('[BaseEngine] _cinematicCamera error:', e);
    }
  }

  protected _cinematicIdle() {
    // Hard guard: never drift while paused or after the game ends — the
    // camera must hold rock-steady on the pause overlay / finish card.
    if (!this._cinematicIdleEnabled || this._isPaused || this.isFinished) return;
    try {
      const t = this.time.now;
      // ±2px horizontal drift @ ~0.3Hz, ±1px vertical drift @ ~0.4Hz.
      this.cameras.main.scrollX = Math.sin(t * 0.002) * 2;
      this.cameras.main.scrollY = Math.sin(t * 0.0015) * 1;
    } catch {}
  }

  protected _stageLighting(color: number = 0, duration: number = 300) {
    try {
      // Auto-cycle through neon hues when caller passes 0 (default).
      // Pass an explicit color to override the cycle.
      let c = color;
      if (c === 0) {
        c = BaseEngine._STAGE_LIGHTING_COLORS[this._stageLightingColorIdx % BaseEngine._STAGE_LIGHTING_COLORS.length];
        this._stageLightingColorIdx++;
      }
      const w = this.scale.width, h = this.scale.height, bw = 15;
      const borders = [
        this.add.rectangle(w / 2, bw / 2, w, bw, c, 0.6).setDepth(940),
        this.add.rectangle(w / 2, h - bw / 2, w, bw, c, 0.6).setDepth(940),
        this.add.rectangle(bw / 2, h / 2, bw, h, c, 0.6).setDepth(940),
        this.add.rectangle(w - bw / 2, h / 2, bw, h, c, 0.6).setDepth(940),
      ];
      this.tweens.add({
        targets: borders, alpha: 0, duration,
        ease: 'Cubic.out', onComplete: () => borders.forEach(b => b.destroy()),
      });
    } catch (e) {
      console.error('[BaseEngine] _stageLighting error:', e);
    }
  }

  // ===========================================================================
  // AAAA KIDS MODE — Auto-Mascot (themed emoji per game, bottom-right corner)
  // ===========================================================================
  // Override this in scenes that have on-screen controls in the bottom-right
  // (e.g. MazeChase has a joystick there) — return a non-conflicting position.
  protected _getMascotPosition(): { x: number; y: number } {
    return { x: this.scale.width - 50, y: this.scale.height - 50 };
  }

  private _createAutoMascot() {
    try {
      const pos = this._getMascotPosition();
      this._mascotBaseX = pos.x;
      this._mascotBaseY = pos.y;
      const mascotEmoji = BaseEngine._MASCOT_EMOJIS[this.scene.key] ?? '⭐';

      this._mascot = this.add.text(this._mascotBaseX, this._mascotBaseY, mascotEmoji, {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '40px',
      }).setOrigin(0.5).setDepth(350);

      // Gentle bob.
      this._mascotBobTween = this.tweens.add({
        targets: this._mascot,
        y: this._mascotBaseY - 5,
        duration: 1000, yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });

      // Occasional chin-tap.
      this._mascotChinTapEvent = this.time.addEvent({
        delay: 4000, repeat: 999,
        callback: () => {
          if (this._mascotState !== 'idle' || !this._mascot) return;
          try {
            this.tweens.add({
              targets: this._mascot,
              angle: { from: 0, to: -8 },
              duration: 200, yoyo: true, repeat: 1, ease: 'Sine.inOut',
            });
          } catch {}
        },
      });

      // Tappable → speaks random encouragement.
      this._mascot.setInteractive({ useHandCursor: true });
      this._mascot.on('pointerdown', () => {
        try {
          const phrases = ['You can do it!', 'Keep going!', 'I believe in you!', 'You got this!'];
          audioBus.speak(phrases[Math.floor(Math.random() * phrases.length)]);
          if (this._mascot) {
            const startX = this._mascot.x;
            this.tweens.add({
              targets: this._mascot,
              x: { from: startX - 6, to: startX + 6 },
              duration: 80, yoyo: true, repeat: 3, ease: 'Sine.inOut',
              onComplete: () => { if (this._mascot) this._mascot.x = this._mascotBaseX; },
            });
          }
        } catch {}
      });
    } catch (e) {
      console.error('[BaseEngine] _createAutoMascot error:', e);
    }
  }

  private _mascotCelebrate() {
    if (!this._mascot || this._mascotState === 'celebrate') return;
    try {
      this._mascotState = 'celebrate';
      try { this.tweens.killTweensOf(this._mascot); } catch {}
      this._mascot.setAngle(0);
      this._mascot.setScale(1);

      // CINEMATIC SPECTACLE — enhanced celebrate:
      //   • Jump higher (was -40, now -60)
      //   • Scale punch up to 1.5x (was 1.0 — just jumped)
      //   • 720° spin (was 360° — single flip)
      //   • 3 celebratory star particles (⭐🌟💫) launched from the mascot base
      //   • 'streak' chime (880→1320Hz triangle sweep)
      this.tweens.add({
        targets: this._mascot,
        y: this._mascotBaseY - 60,
        duration: 300, yoyo: true, repeat: 1, ease: 'Quad.out',
      });
      this.tweens.add({
        targets: this._mascot,
        angle: 720,
        scale: 1.5,
        duration: 600, ease: 'Cubic.out',
        onComplete: () => {
          if (this._mascot) this._mascot.setAngle(0);
          // Ease scale back to 1.0 with a slight overshoot for "bounce-back".
          if (this._mascot) {
            this.tweens.add({
              targets: this._mascot,
              scale: 1,
              duration: 280, ease: 'Back.out',
            });
          }
          this._mascotState = 'idle';
          if (this._mascot) {
            this._mascotBobTween = this.tweens.add({
              targets: this._mascot,
              y: this._mascotBaseY - 5,
              duration: 1000, yoyo: true, repeat: 999, ease: 'Sine.inOut',
            });
          }
        },
      });

      // CINEMATIC SPECTACLE — 3 star particles launched from the mascot base.
      // Each rises + fades over 700ms, spreading horizontally for a fan effect.
      const starEmojis = ['⭐', '🌟', '💫'];
      for (let i = 0; i < 3; i++) {
        try {
          const px = this._mascotBaseX + (i - 1) * 16;
          const py = this._mascotBaseY + 18;
          const particle = this.add.text(px, py, starEmojis[i], {
            fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
            fontSize: '22px',
          }).setOrigin(0.5).setDepth(360);
          this.tweens.add({
            targets: particle,
            y: py - 70,
            x: px + (i - 1) * 14,
            alpha: 0,
            scale: 0.4,
            duration: 700, ease: 'Cubic.out',
            onComplete: () => { try { particle.destroy(); } catch {} },
          });
        } catch {}
      }

      // CINEMATIC SPECTACLE — 'streak' chime plays alongside the spin.
      try { audioBus.play('streak'); } catch {}
    } catch (e) {
      console.error('[BaseEngine] _mascotCelebrate error:', e);
    }
  }

  // ===========================================================================
  // AAAA KIDS MODE — Persistent Sticker Book (localStorage)
  // ===========================================================================
  private _createStickerBadge() {
    try {
      const sbX = this.scale.width - 55;
      const sbY = 100;
      const sbW = 80, sbH = 50;

      const bookBg = this.add.rectangle(0, 0, sbW, sbH, 0x000000, 0.6)
        .setStrokeStyle(2, this.theme.warning, 0.8);
      const bookIcon = this.add.text(-15, 0, '📔', {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Inter, sans-serif',
        fontSize: '22px',
      }).setOrigin(0.5);

      const collection = this._loadStickerCollection();
      this._stickerBadgeText = this.add.text(15, 0, String(collection.count), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: this.hex(this.theme.warning), fontStyle: 'bold',
      }).setOrigin(0.5);

      this._stickerBadge = this.add.container(sbX, sbY, [bookBg, bookIcon, this._stickerBadgeText])
        .setDepth(340);

      this.tweens.add({
        targets: this._stickerBadge,
        y: sbY - 3,
        duration: 1200, yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });

      this._stickerBadge.setSize(sbW, sbH).setInteractive({ useHandCursor: true });
      this._stickerBadge.on('pointerdown', () => {
        try {
          const c = this._loadStickerCollection();
          if (c.count === 0) {
            audioBus.speak('No stickers yet — answer a question to earn one!');
          } else {
            audioBus.speak(`You have ${c.count} stickers! Great work!`);
          }
          this.tweens.add({
            targets: this._stickerBadge,
            scale: { from: 1, to: 1.15 },
            duration: 150, yoyo: true, ease: 'Quad.out',
          });
        } catch {}
      });
    } catch (e) {
      console.error('[BaseEngine] _createStickerBadge error:', e);
    }
  }

  private _awardSticker() {
    try {
      const collection = this._loadStickerCollection();
      const sticker = BaseEngine.STICKER_EMOJIS[Math.floor(Math.random() * BaseEngine.STICKER_EMOJIS.length)];
      collection.count++;
      collection.stickers.push(sticker);
      if (collection.stickers.length > 500) {
        collection.stickers = collection.stickers.slice(-500);
      }
      this._saveStickerCollection(collection);

      if (this._stickerBadgeText) {
        this._stickerBadgeText.setText(String(collection.count));
      }
      if (this._stickerBadge) {
        this.tweens.add({
          targets: this._stickerBadge,
          scale: { from: 1, to: 1.25 },
          duration: 200, yoyo: true, ease: 'Back.out',
        });
      }
      audioBus.play('pop');
    } catch (e) {
      console.error('[BaseEngine] _awardSticker error:', e);
    }
  }

  private _loadStickerCollection(): { count: number; stickers: string[] } {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { count: 0, stickers: [] };
      }
      const raw = window.localStorage.getItem(BaseEngine.STICKER_STORAGE_KEY);
      if (!raw) return { count: 0, stickers: [] };
      const parsed = JSON.parse(raw);
      return {
        count: typeof parsed.count === 'number' ? parsed.count : 0,
        stickers: Array.isArray(parsed.stickers) ? parsed.stickers : [],
      };
    } catch {
      return { count: 0, stickers: [] };
    }
  }

  private _saveStickerCollection(collection: { count: number; stickers: string[] }) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(BaseEngine.STICKER_STORAGE_KEY, JSON.stringify(collection));
    } catch (e) {
      console.error('[BaseEngine] _saveStickerCollection error:', e);
    }
  }

  // GC FIX: Cache urgency pulse to avoid Graphics redraw every frame
  private _urgencyPulsePhase = 0;

  protected onHudUpdate(state: { score: number; streak: number; remainingMs: number }) {
    if (state.remainingMs < 60000 && !this.urgencyActive && !this.isFinished) {
      this.urgencyActive = true;
      if (this.urgencyVignette) { this.urgencyVignette.setVisible(true); }
      audioBus.play('countdown');
    }
    // GC FIX: Only redraw urgency vignette every 3rd frame (20fps) instead of
    // every frame (60fps). Graphics.clear() + fillRect × 4 allocates command
    // buffers each call — at 60fps that's 240 fillRect commands per second.
    if (this.urgencyActive && this.urgencyVignette) {
      this._urgencyPulsePhase++;
      if (this._urgencyPulsePhase % 3 !== 0) return; // skip 2 of every 3 frames
      const w = this.scale.width, h = this.scale.height, bw = 20;
      const pulse = (Math.sin(this.time.now / 200) + 1) / 2;
      const alpha = 0.3 + pulse * 0.4;
      this.urgencyVignette.clear();
      this.urgencyVignette.fillStyle(this.theme.danger, alpha);
      this.urgencyVignette.fillRect(0, 0, w, bw);
      this.urgencyVignette.fillRect(0, h - bw, w, bw);
      this.urgencyVignette.fillRect(0, 0, bw, h);
      this.urgencyVignette.fillRect(w - bw, 0, bw, h);
    }
  }

  protected recordAnswer(opts: { term: string; response: string; success: boolean; coordinate?: { x: number; y: number; t: number } }) {
    if (!this.juice || !this.hud) return;
    // AAAA: Track EVERY attempt for real accuracy calculation.
    this.totalAttempts++;
    const actor = getActor();
    const ev = makeAnsweredEvent({ actor, gameMode: this.scene.key, unit: this.unit, term: opts.term, response: opts.response, success: opts.success, score: this.score, maxScore: this.maxScore, durationMs: Date.now() - this.startTime, coordinate: opts.coordinate, streak: this.streak, tenantId: this.tenantId });
    this.answeredEvents.push(ev); pushEvent(ev);

    // AAA ARCHITECTURE: Emit events through EventBus (decoupled)
    // VFX, Audio, HUD, Level systems each listen independently
    const burstX = opts.coordinate?.x ?? 400;
    const burstY = opts.coordinate?.y ?? 300;

    if (opts.success) {
      this.score++; this.streak++;

      // Emit events — systems react independently
      this.eventBus.emit(GAME_EVENTS.ANSWER_CORRECT, {
        term: opts.term,
        coordinate: opts.coordinate,
        streak: this.streak,
        score: this.score,
        maxScore: this.maxScore,
      });
      this.eventBus.emit(GAME_EVENTS.VFX_BURST, {
        x: burstX, y: burstY,
        kind: this.streak >= 3 ? 'streak' : 'correct',
      });
      this.eventBus.emit(GAME_EVENTS.VFX_POPUP, {
        x: burstX, y: burstY,
        text: this.streak >= 3 ? `STREAK x${this.streak}!` : '+1',
        color: this.streak >= 3 ? this.theme.warning : this.theme.success,
      });

      audioBus.speak(opts.term);
      const semitones = Math.min(this.streak, 6) / 12;
      const streakFreq = 660 * Math.pow(2, semitones);
      const now = Date.now();
      if (now - this._lastSfxTime > 300) { audioBus.play('correct', { freq: streakFreq }); this._lastSfxTime = now; }

      // AAAA KIDS MODE — Automatic celebration fanfare for ALL games.
      // Fires KidsJuice.celebrateCorrect (7-layer C-E-G-C cascade + confetti rain
      // + "You got it!" text). Scenes with custom celebrations opt out.
      if (!this._skipAutoCelebrate) {
        try {
          KidsJuice.celebrateCorrect(this as any, { x: burstX, y: burstY } as any);
        } catch (e) {
          console.error('[BaseEngine] KidsJuice.celebrateCorrect error:', e);
        }
      }

      this.checkLevelUp();
    } else {
      this.streak = 0;

      this.eventBus.emit(GAME_EVENTS.ANSWER_WRONG, {
        term: opts.term,
        response: opts.response,
        coordinate: opts.coordinate,
      });
      this.eventBus.emit(GAME_EVENTS.VFX_BURST, { x: burstX, y: burstY, kind: 'incorrect' });
      this.eventBus.emit(GAME_EVENTS.VFX_POPUP, {
        x: this.scale.width / 2, y: this.scale.height / 2,
        text: 'X', color: this.theme.danger,
      });
      this.eventBus.emit(GAME_EVENTS.VFX_SHAKE, { intensity: 'light' });

      audioBus.play('incorrect');
    }
    this.hud.tick(this.score, this.streak, this.maxScore);
  }

  protected finishGame(won: boolean) {
    if (this.isFinished) return;
    this.isFinished = true;
    // NOTE: Do NOT call tweens.killAll() here — it kills the fade-in tween
    // of the overlay buttons below, leaving them invisible (alpha 0) and
    // making the game appear to "hang" with no clickable buttons.
    // Only kill tweens on game objects, not on the overlay we're about to create.

    // AAA ARCHITECTURE: Emit game end event
    this.eventBus.emit(GAME_EVENTS.GAME_END, {
      won, score: this.score, maxScore: this.maxScore,
      durationMs: Date.now() - this.startTime,
    });

    // AAA ARCHITECTURE: Flush all pooled objects (bulk purge)
    this.poolManager.flushAll();
    if (this.urgencyVignette) { try { this.urgencyVignette.destroy(); } catch {} this.urgencyVignette = undefined; }
    this.urgencyActive = false;

    const durationMs = Date.now() - this.startTime;
    const actor = getActor();
    const completed = makeCompletedEvent({ actor, gameMode: this.scene.key, unit: this.unit, totalCorrect: this.score, totalQuestions: this.maxScore, durationMs, streak: this.streak, tenantId: this.tenantId });
    pushEvent(completed);
    const verify = verifyTelemetry({ events: [...this.answeredEvents, completed], totalQuestions: this.maxScore, durationMs });

    try { this.physics.world.pause(); } catch {}

    const isQuarantined = verify.status === 'quarantine';
    const isReview = verify.status === 'review';
    const statusColor = isQuarantined ? this.theme.danger : isReview ? this.theme.warning : won ? this.theme.success : this.theme.danger;

    // AAAA: Use depth 960+ (above pause overlay at 950) so buttons are always clickable.
    // FULLY OPAQUE backdrop (alpha 1.0) — completely hides the maze so fruits/quiz
    // elements can't bleed through and create visual clutter behind the score panel.
    const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, this.theme.bg, 1.0).setDepth(960).setInteractive({ useHandCursor: 'default' });

    // MODAL PANEL: a centered card with brand-tinted border. Holds title,
    // stats, and buttons — gives the end screen a clean, focused layout
    // instead of floating text over a half-visible maze.
    const panelW = Math.min(560, this.scale.width - 80);
    const panelH = Math.min(560, this.scale.height - 120);
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;
    const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, this.theme.card, 0.98)
      .setStrokeStyle(3, statusColor, 0.9).setDepth(961);
    // Decorative top accent bar on the panel
    const panelAccent = this.add.rectangle(
      panelX, panelY - panelH / 2 + 6, panelW - 24, 4, statusColor, 0.9
    ).setDepth(962);
    void panelBg; void panelAccent;

    if (isQuarantined) { audioBus.play('quarantine'); try { this.juice.shake('heavy'); } catch {} }
    else if (won) { try { this.hud.celebrate(); } catch {} try { this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win'); } catch {} }
    else { try { this.hud.sad(); } catch {} }

    const title = isQuarantined ? '⚠ SCORE QUARANTINED' : isReview ? '⎯ FLAGGED FOR REVIEW' : won ? (this.score === this.maxScore ? 'PERFECT! 3 STARS!' : this.score >= this.maxScore * 0.7 ? 'GREAT JOB! 2 STARS!' : 'GOOD! 1 STAR!') : '⏱ TIME UP';
    const subtitle = isQuarantined ? verify.anomalyReason ?? 'anomaly detected' : isReview ? verify.anomalyReason ?? 'review required' : `Score: ${this.score} / ${this.maxScore}`;

    // LAYOUT: All elements positioned relative to panel center with
    // generous vertical spacing so nothing overlaps. Top of panel = panelY - panelH/2.
    const panelTop = panelY - panelH / 2;

    const titleText = this.add.text(this.scale.width / 2, panelTop + 60, title, { fontFamily: 'Inter, sans-serif', fontSize: '38px', color: '#' + statusColor.toString(16).padStart(6, '0'), fontStyle: 'bold' }).setOrigin(0.5).setDepth(963);

    if (won) {
      const stars = this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1;
      const starY = panelTop + 110;
      for (let i = 0; i < 3; i++) {
        const filled = i < stars;
        this.add.text(this.scale.width / 2 + (i - 1) * 60, starY, filled ? '⭐' : '☆', { fontFamily: 'Inter, sans-serif', fontSize: '42px' }).setOrigin(0.5).setDepth(963);
      }
    }

    const subText = this.add.text(this.scale.width / 2, panelTop + 170, subtitle, { fontFamily: 'Inter, sans-serif', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(963);

    // AAAA: Real accuracy = correct answers / total attempts (not score / maxScore).
    // Old formula (score/maxScore) always showed ~100% in no-penalty games
    // because the child keeps trying until correct, so score always reaches maxScore.
    const realAccuracy = this.totalAttempts > 0 ? Math.round((this.score / this.totalAttempts) * 100) : 0;
    const timeSec = (durationMs / 1000).toFixed(1);
    const xpEarned = this.score * 10 + (this.score === this.maxScore ? 50 : 0);
    const tokensEarned = this.score * 5;
    const starsWon = won ? (this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1) : 0;
    const bestKey = `best-score-${this.scene.key}`;
    const prevBest = (this.registry.get(bestKey) as number) || 0;
    const isNewBest = this.score > prevBest;
    if (isNewBest) this.registry.set(bestKey, this.score);
    const bestText = isNewBest ? '🏆 NEW BEST!' : `Best: ${prevBest}/${this.maxScore}`;

    // STATS: Stack vertically inside the panel with clear spacing.
    const statsY = panelTop + 220;
    const statsText = this.add.text(this.scale.width / 2, statsY,
      `Accuracy: ${realAccuracy}%   ·   Streak: ${this.streak}   ·   Time: ${timeSec}s`, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff',
        fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(963).setAlpha(0.9);
    const stats2 = this.add.text(this.scale.width / 2, statsY + 28,
      `⭐ ${starsWon}/3   ·   +${xpEarned} XP   ·   +${tokensEarned} tokens`, {
        fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#ffffff',
        fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(963).setAlpha(0.9);
    const stats3 = this.add.text(this.scale.width / 2, statsY + 54,
      bestText, {
        fontFamily: 'Inter, sans-serif', fontSize: '15px',
        color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
        fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(963).setAlpha(0.9);

    // Achievement badges
    const badges: string[] = [];
    if (this.score === this.maxScore) badges.push('🏆 PERFECT GAME');
    if (this.streak >= 5) badges.push('🔥 ON FIRE');
    if (this.streak >= 10) badges.push('💎 UNSTOPPABLE');
    if (this.level >= 3) badges.push('⭐ LEVEL 3+');
    if (this.level >= 5) badges.push('👑 LEVEL 5 MASTER');
    if (durationMs < 30000 && this.score >= this.maxScore * 0.5) badges.push('⚡ SPEED DEMON');
    if (this.score === 0 && !won) badges.push('🌱 KEEP TRYING');
    if (badges.length > 0) {
      this.add.text(this.scale.width / 2, statsY + 88, badges.join('  ·  '), { fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#' + this.theme.warning.toString(16).padStart(6, '0'), fontStyle: 'bold', align: 'center', wordWrap: { width: panelW - 60 } }).setOrigin(0.5).setDepth(963);
    }

    // BUTTONS: Inside the panel, stacked vertically with clear gap.
    // No more overlap with the stats block above.
    const btnY = panelTop + panelH - 180;
    const btnW = Math.min(420, panelW - 80);
    const btnH = 60;
    const btnFontSize = '24px';
    const btnGap = 72;

    // Play Again button
    const btnBg = this.add.rectangle(this.scale.width / 2, btnY, btnW, btnH, statusColor, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5).setDepth(963).setInteractive({ useHandCursor: true });
    const btn = this.add.text(this.scale.width / 2, btnY, '🔄 Play Again', {
      fontFamily: 'Inter, sans-serif', fontSize: btnFontSize, color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(964).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => { audioBus.play('tap'); this.scene.restart({ config: this.registry.get('launchConfig') }); });
    btnBg.on('pointerdown', () => { audioBus.play('tap'); this.scene.restart({ config: this.registry.get('launchConfig') }); });

    // New Game button
    const btnBg2 = this.add.rectangle(this.scale.width / 2, btnY + btnGap, btnW, btnH, this.theme.card, 0.95)
      .setStrokeStyle(2, this.theme.accent, 0.8).setDepth(963).setInteractive({ useHandCursor: true });
    const btn2 = this.add.text(this.scale.width / 2, btnY + btnGap, '🎮 New Game', {
      fontFamily: 'Inter, sans-serif', fontSize: btnFontSize, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(964).setInteractive({ useHandCursor: true });
    btn2.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });
    btnBg2.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });

    // Game Complete button
    const btnBg3 = this.add.rectangle(this.scale.width / 2, btnY + btnGap * 2, btnW, btnH, this.theme.success, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5).setDepth(963).setInteractive({ useHandCursor: true });
    const btn3 = this.add.text(this.scale.width / 2, btnY + btnGap * 2, '✓ Complete', {
      fontFamily: 'Inter, sans-serif', fontSize: btnFontSize, color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(964).setInteractive({ useHandCursor: true });
    btn3.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });
    btnBg3.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });

    // Animate overlay in — buttons start at alpha 0 and fade to 1.
    // AAAA: Removed tweens.killAll() from finishGame start (was killing this
    // fade-in tween, leaving buttons invisible → game appeared to "hang").
    // Now the fade-in works correctly. If the tween somehow fails, buttons
    // are still at alpha 0 — so we add a safety delayedCall to force alpha 1
    // after 500ms in case the tween doesn't complete.
    overlay.setAlpha(0); titleText.setAlpha(0); subText.setAlpha(0); statsText.setAlpha(0); stats2.setAlpha(0); stats3.setAlpha(0); btnBg.setAlpha(0); btn.setAlpha(0); btnBg2.setAlpha(0); btn2.setAlpha(0); btnBg3.setAlpha(0); btn3.setAlpha(0);
    this.tweens.add({ targets: [overlay, titleText, subText, statsText, stats2, stats3, btnBg, btn, btnBg2, btn2, btnBg3, btn3], alpha: { from: 0, to: 1 }, duration: 400, ease: 'Cubic.out' });

    // AAAA: Safety fallback — if the fade-in tween is killed for any reason,
    // force all overlay elements to alpha 1 after 500ms so buttons are visible + clickable.
    this.time.delayedCall(500, () => {
      try {
        [overlay, titleText, subText, statsText, stats2, stats3, btnBg, btn, btnBg2, btn2, btnBg3, btn3].forEach(o => {
          if (o && o.active) o.setAlpha(1);
        });
      } catch {}
    });
  }

  protected checkWin() { if (this.score >= this.maxScore && !this.isFinished) { this.time.delayedCall(400, () => this.finishGame(true)); } }

  protected pickTerms(n: number): TermItem[] { const copy = [...this.terms]; Phaser.Utils.Array.Shuffle(copy); return copy.slice(0, Math.min(n, copy.length)); }

  protected hex(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }

  protected hitTest(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle, px: number, py: number): boolean {
    const x = obj.x, y = obj.y; let w = 100, h = 50;
    if ('width' in obj && obj.width) w = obj.width as number;
    if ('height' in obj && obj.height) h = obj.height as number;
    return px >= x - w / 2 && px <= x + w / 2 && py >= y - h / 2 && py <= y + h / 2;
  }

  protected setupGlobalPointer(handler: (x: number, y: number) => void) {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this._isPaused || this.isFinished) return;
      handler(p.x, p.y);
    });
  }

  // IRONCLAD-POLISH — Rigid input debounce for game-action handlers.
  // Returns false if called within _INPUT_DEBOUNCE_MS of the last call,
  // true otherwise. Updates _lastInputTime on every accepted call.
  // NOTE: Call this at the TOP of game-action handlers (lane tap, build tower,
  // select tower type, etc.) — NOT at the top of setupGlobalPointer. The pause
  // button + spin button + other UI controls must NOT be debounced.
  protected _debounceInput(): boolean {
    const now = this.time.now;
    if (now - this._lastInputTime < this._INPUT_DEBOUNCE_MS) return false;
    this._lastInputTime = now;
    return true;
  }

  protected checkLevelUp() {
    const newLevel = Math.floor(this.score / this.termsPerLevel) + 1;
    if (newLevel > this.level) { this.level = newLevel; this.showLevelUp(); }
  }

  protected getDifficultyMultiplier(): number { return 1.0 + (this.level - 1) * 0.2; }

  protected getSpeedBonus(roundStartTime: number): number {
    const rt = Date.now() - roundStartTime;
    if (rt < 2000) return 5; if (rt < 4000) return 3; if (rt < 6000) return 1; return 0;
  }

  protected showLevelUp() {
    if (!this.levelBadge || !this.juice) return;
    try {
      this.levelBadge.setText(`LEVEL ${this.level}`);
      const levelColors = [0x3b82f6, 0x22c55e, 0xfbbf24, 0xf97316, 0xef4444];
      const badgeColor = levelColors[Math.min(this.level - 1, 4)];
      this.levelBadge.setColor('#' + badgeColor.toString(16).padStart(6, '0'));
      if (this.levelBg) this.levelBg.setStrokeStyle(2, badgeColor, 0.8);
      audioBus.speak(`Level ${this.level}!`);
      this.juice.scorePopup(this.scale.width / 2, this.scale.height / 2 - 50, `LEVEL ${this.level}!`, badgeColor);
      this.tweens.add({ targets: [this.levelBadge, this.levelBg], scale: { from: 1, to: 1.3 }, duration: 200, yoyo: true, repeat: 2, ease: 'Back.out' });
      if (this.level >= 3) audioBus.play('countdown');
    } catch (e) { console.error('[MiniStar] showLevelUp error:', e); }
  }

  protected speakPrompt(term: string, definition?: string) { audioBus.speakTerm(term, definition); }

  protected makeSpeakable(text: Phaser.GameObjects.Text, speechText?: string) {
    const speak = speechText ?? text.text;
    text.setData('speakText', speak);
    text.setInteractive({ useHandCursor: true });
    // Read from data at tap time (not capture time) so the speakable text
    // updates when the text content changes (e.g., prompt text changes per round).
    text.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      if (event) event.stopPropagation();
      const current = (text.getData('speakText') as string) ?? speak ?? text.text;
      audioBus.speak(current);
    });
  }

  // AAAA KIDS MODE — Hover-speakable variant: speaks on hover (desktop) AND tap,
  // using karaoke highlight via speakPromptWithHighlight. Skips while paused/finished.
  protected makeHoverSpeakable(text: Phaser.GameObjects.Text, speechText?: string) {
    if (speechText) text.setData('speakText', speechText);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerover', () => {
      if (this._isPaused || this.isFinished) return;
      const current = (text.getData('speakText') as string) ?? speechText ?? text.text;
      if (current) this.speakPromptWithHighlight(text, current);
    });
    text.on('pointerdown', (_p, _lx, _ly, event) => {
      if (this._isPaused || this.isFinished) return;
      if (event) event.stopPropagation();
      const current = (text.getData('speakText') as string) ?? speechText ?? text.text;
      if (current) this.speakPromptWithHighlight(text, current);
    });
  }

  // AAA ENTRANCE: Title card with game name, fades in from black,
  // holds for 1.2s, then fades out. Does NOT block input (no setInteractive).
  private _showEntranceCard() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Camera fade in from black (600ms)
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // Title card overlay — NOT interactive (doesn't block game input)
    const cardBg = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.85)
      .setDepth(600);

    // Game title
    const gameNames: Record<string, string> = {
      'MazeChaseScene': '🌽 Maze Chase',
      'QuizScene': '❓ Quiz',
      'AirplaneScene': '🚀 Rocket Catch',
      'GameshowScene': '🎮 Gameshow',
      'MemoryMatchScene': '🃏 Memory Match',
      'MatchUpScene': '🔗 Match Up',
      'BalloonPopScene': '🎈 Balloon Pop',
      'WhackAMoleScene': '🔨 Whack-a-Mole',
      'AnagramScene': '🔤 Anagram',
      'WordsearchScene': '🔍 Word Search',
      'BridgeBuilderScene': '🌉 Bridge Builder',
      'CrosswordScene': '📝 Crossword',
      'FlashCardsScene': '📇 Flash Cards',
      'SpinWheelScene': '🎡 Spin the Wheel',
      'GroupSortScene': '📊 Group Sort',
      'TypeAnswerScene': '⌨️ Type Answer',
      'SpotItScene': '👁️ Spot It!',
      'LabelItScene': '🏷️ Label It',
      'SpeakItScene': '🗣️ Speak It',
      'EndlessRunnerScene': '🏃 Endless Runner',
      'PhysicsPuzzlerScene': '🎯 Physics Puzzler',
      'SnakingScene': '🐍 Word Snake',
      'TrainingAcademyScene': '🎓 Training Academy',
      'RescueQuestScene': '🦸 Rescue Quest',
      'StarFarmScene': '🌾 Star Farm',
      'TreasureHuntScene': '🗺️ Treasure Hunt',
      'MonsterFighterScene': '⚔️ Monster Fighter',
      'TowerDefenseScene': '🏰 Tower Defense',
      'RhythmTapScene': '🎵 Rhythm Tap',
      'SpaceExplorerScene': '🚀 Space Explorer',
      'StoryAdventureScene': '📖 Story Adventure',
    };
    const titleText = gameNames[this.scene.key] ?? 'MiniStar Games';
    const title = this.add.text(cx, cy - 30, titleText, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      color: '#' + this.theme.warning.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(601).setAlpha(0);

    // Subtitle
    const subtitle = this.add.text(cx, cy + 25, 'Get Ready!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(601).setAlpha(0);

    // Animate: title scales in, subtitle fades
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 300,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 300,
      delay: 150,
      ease: 'Cubic.out',
    });

    // Fade out after 1.2s — use setTimeout (bulletproof, can't be killed)
    setTimeout(() => {
      try {
        this.tweens.add({
          targets: [cardBg, title, subtitle],
          alpha: 0,
          duration: 300,
          ease: 'Cubic.in',
          onComplete: () => {
            try { cardBg.destroy(); title.destroy(); subtitle.destroy(); } catch {}
          },
        });
      } catch {}
    }, 1200);
  }

  // AAAA KIDS MODE — Centralized pause/resume: sets _isPaused flag, shows/hides
  // overlay, sets timeScale (0 on pause / 1 on resume), and pauses/resumes the
  // physics world. All callers (pause button, keyboard 'P', overlay Resume btn)
  // route through here so pause state stays consistent across systems.
  protected _togglePause() {
    if (this.isFinished) return;
    if (this._isPaused) {
      // Resume
      this._isPaused = false;
      if (this.pauseOverlay) this.pauseOverlay.setVisible(false);
      this.time.timeScale = 1;
      try { this.physics.world.resume(); } catch {}
    } else {
      // Pause
      this._isPaused = true;
      this._showPauseOverlay();
      this.time.timeScale = 0;
      try { this.physics.world.pause(); } catch {}
    }
  }

  private _createPauseButton() {
    // BIGGER pause button — was 22px, now 32px with background
    const btnBg = this.add.rectangle(50, 110, 60, 40, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.7).setDepth(299);
    const btn = this.add.text(50, 110, '⏸', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px',
    }).setOrigin(0.5).setDepth(300).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      if (this.isFinished) return;
      this._togglePause();
    });
    // Make the bg clickable too
    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerdown', () => {
      if (this.isFinished) return;
      this._togglePause();
    });
  }

  private _showPauseOverlay() {
    if (this.pauseOverlay) { this.pauseOverlay.setVisible(true); return; }
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // Overlay MUST be interactive so input does NOT pass through to the game
    // underneath while paused. Depth 950 places it above gameplay (<=450) and
    // HUD/level badge (~250-300) but below the finish overlay (500+ here used
    // for a higher visual stacking on pause).
    const overlay = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.8)
      .setInteractive({ useHandCursor: 'default' })
      .setDepth(950);
    const title = this.add.text(cx, cy - 80, '⏸ Paused', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(951);

    // BIGGER buttons with backgrounds — not overlapping, easily readable.
    // Resume routes through _togglePause so physics world + timeScale are restored.
    const resumeBg = this.add.rectangle(cx, cy + 10, 240, 56, 0x22c55e, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5).setDepth(951).setInteractive({ useHandCursor: true });
    const resumeBtn = this.add.text(cx, cy + 10, '▶ Resume', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(952).setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => { this._togglePause(); });
    resumeBg.on('pointerdown', () => { this._togglePause(); });

    const quitBg = this.add.rectangle(cx, cy + 80, 240, 56, 0xef4444, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5).setDepth(951).setInteractive({ useHandCursor: true });
    const quitBtn = this.add.text(cx, cy + 80, '✗ Quit to Library', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(952).setInteractive({ useHandCursor: true });
    quitBtn.on('pointerdown', () => { try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });
    quitBg.on('pointerdown', () => { try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });

    this.pauseOverlay = this.add.container(0, 0, [overlay, title, resumeBg, resumeBtn, quitBg, quitBtn]).setDepth(950);
  }
}
