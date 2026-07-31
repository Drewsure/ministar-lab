import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';
import { GAME_EVENTS } from '../EventBus';

// ============================================================================
// QUIZ — Selection Engine  (AAA 2029 + Kids Mode enhancement)
// ============================================================================
// Combines competitive mechanics (timer, lifelines, streaks) with child-
// friendly design notes for ages 4-9:
//
// EXISTING FEATURES (preserved — DO NOT SUBTRACT):
//   • Per-question timer (10s) with visual countdown ring
//   • 50/50 lifeline (removes 2 wrong answers, 1 use per game)
//   • Skip lifeline (1 use per game)
//   • Letter-labeled buttons (A, B, C, D) with hover glow
//   • Streak multiplier (x2 at 3 streak, x3 at 5)
//   • Smooth question transitions (slide out + slide in)
//   • ESL TTS on every prompt + tap-to-hear on options
//   • Correct/wrong reveal with particle bursts
//   • Spaced repetition (wrong answers resurface later)
//
// KIDS MODE ADDITIONS (from child-game design notes — additive only):
//   • No-Penalty Loop: wrong answers giggle + wiggle + fade out, child keeps
//     trying until they get the right answer. Always win in the end.
//   • Companion Mascot: animated puppy host — curious thinking pose during
//     question, jumps for joy on correct answer, high-fives on streaks.
//   • Sticker Book Reward: every correct answer drops a glowing sticker into
//     a virtual sticker book (top-right). Visual reward system, not numeric.
//   • Audio Praise Variation: random enthusiastic phrases ("Wow!", "Super
//     smart!", "Fantastic!") replace robotic repetitive feedback.
//   • Musical Fanfare: soft curious pentatonic loop during question, bright
//     major chord arpeggio (C-E-G-C) on correct answer.
//   • Event-Driven Progression: ANSWER_CORRECT event triggers Score, Audio,
//     Mascot, Sticker Book independently through EventBus.
//   • Squash-and-Stretch: classic Disney 12-principle animation on every tap.
//   • Rapid-Fire: 5 questions max per session (per child-engagement research).
//   • Build-error fallback: try-catch wrap + friendly retry message.
// ============================================================================

interface QuizRound {
  prompt: TermItem;
  options: TermItem[];
  correctIndex: number;
}

// Static praise phrase pool — randomized on each correct answer so feedback
// never feels robotic or repetitive.
const PRAISE_PHRASES = [
  'Wow!', "You're super smart!", 'Fantastic!', 'Amazing!',
  'Brilliant!', 'You got it!', 'Wonderful!', 'Incredible!',
  'Great job!', 'Way to go!', 'Awesome!', 'Stellar!',
];

// Sticker emojis dropped into the sticker book per correct answer.
const STICKER_EMOJIS = ['⭐', '🌟', '💫', '✨', '🎯', '🌈', '🏆', '🎀', '🎈', '🦄'];

// Mascot emoji + position constants (800x600 canvas).
const MASCOT_EMOJI = '🐶';
const MASCOT_FONT_SIZE = 56;

// Karaoke highlight color cycle (rainbow pastels) for audio-text sync.
const HIGHLIGHT_COLORS = ['#ff6b9d', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffaaa5', '#c7ceea'];

// Random celebratory phrases spoken on correct answer (in addition to existing
// PRAISE_PHRASES — these are longer, more emphatic "You got it!" style phrases).
const CELEBRATION_PHRASES = [
  'You got it!',
  'Yes! Superstar!',
  'Brilliant!',
  'Amazing work!',
  'Fantastic!',
  'You are so smart!',
  'Wonderful!',
  'Perfect match!',
];

export default class QuizScene extends BaseEngine {
  private round = 0;
  private rounds: QuizRound[] = [];
  private wrongQueue: QuizRound[] = []; // Spaced repetition: wrong answers resurface
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;
  private timeBar!: Phaser.GameObjects.Rectangle;
  private lifelinesUsed = { fiftyFifty: false, skip: false };
  private questionTimer = 10;
  private questionTimerEvent?: Phaser.Time.TimerEvent;
  private timerRing!: Phaser.GameObjects.Arc;
  private timerText!: Phaser.GameObjects.Text;
  private streakMultText!: Phaser.GameObjects.Text;
  private fiftyFiftyBtn!: Phaser.GameObjects.Container;
  private skipBtn!: Phaser.GameObjects.Container;

  // KIDS MODE — Mascot, Sticker Book, No-Penalty state, Music
  private mascot!: Phaser.GameObjects.Text;
  private mascotState: 'idle' | 'thinking' | 'celebrate' | 'highfive' = 'idle';
  private mascotAnimEvent?: Phaser.Time.TimerEvent;
  private mascotBaseX = 730;
  private mascotBaseY = 378;
  private stickerBook!: Phaser.GameObjects.Container;
  private stickerCount = 0;
  private stickerBadge!: Phaser.GameObjects.Text;
  private removedOptions = new Set<number>(); // Wrong-answer'd options (no-penalty loop)
  private curiousMusicTimer?: ReturnType<typeof setInterval>;
  private _curiousNoteIdx = 0;

  // AUDIO-TEXT SYNC — karaoke highlight state (mirrors SpinWheel pattern)
  private _highlightTimers: Phaser.Time.TimerEvent[] = [];
  private _highlightTargets: Phaser.GameObjects.Text[] = [];

  // Rapid-fire: cap at 5 questions per session (per child-engagement notes).
  protected maxQuestions() { return Math.min(this.terms.length, 5); }

  // ===========================================================================
  // BUILD WORLD — orchestrates all construction subroutines.
  // ETERNAL_VIGILANCE rule 13: try-catch + _showBuildError prevents black screen.
  // ===========================================================================
  protected buildWorld() {
    try {
      // AAAA KIDS MODE: Opt out of BaseEngine's auto-celebrate — Quiz has its
      // own _celebrateCorrect with mascot/sticker-book integration.
      this._skipAutoCelebrate = true;
      // AAAA KIDS MODE: Opt out of auto-mascot — Quiz has its own 🐶 mascot
      // with richer states (idle/thinking/celebrate/highfive).
      this._skipAutoMascot = true;
      this._buildRounds();
      this._buildTitle();
      this._buildProgressBar();
      this._buildTimerRing();
      this._buildStreakDisplay();
      this._buildPromptBanner();
      this._buildLifelineButtons();
      this._buildTimeBar();
      this._buildMascot();
      this._buildStickerBook();
      this._wireEventBus();
      this._startCuriousMusic();

      this.renderRound();

      // Global pointer handler for reliable button clicks (mobile + desktop).
      this.setupGlobalPointer((x, y) => this._handlePointer(x, y));

      // Cleanup on scene shutdown — kill timers/intervals to prevent leaks.
      this.events.once('shutdown', () => {
        this._stopCuriousMusic();
        if (this.mascotAnimEvent) this.mascotAnimEvent.remove();
        this._clearHighlights();
      });
    } catch (e) {
      console.error('[QuizScene] buildWorld error:', e);
      this._showBuildError(e);
    }
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  // ===========================================================================
  // BUILD SUBROUTINES — kept small and single-purpose for clarity.
  // ===========================================================================
  private _buildRounds() {
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    const count = this.maxScore;
    for (let i = 0; i < count; i++) {
      const prompt = pool[i % pool.length];
      const distractors = pool.filter(t => t.id !== prompt.id);
      Phaser.Utils.Array.Shuffle(distractors);
      const options = [prompt, ...distractors.slice(0, 3)];
      Phaser.Utils.Array.Shuffle(options);
      this.rounds.push({
        prompt,
        options,
        correctIndex: options.findIndex(o => o.id === prompt.id),
      });
    }
  }

  private _buildTitle() {
    this.add.text(
      this.scale.width / 2, 105,
      'Quiz Time',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);
  }

  private _buildProgressBar() {
    const barY = 140;
    const barW = 500;
    const barX = (this.scale.width - barW) / 2;
    this.add.rectangle(this.scale.width / 2, barY, barW + 8, 12, 0x000000, 0.4).setDepth(40);
    this.progressBar = this.add.rectangle(barX, barY, 0, 8, this.theme.accent).setOrigin(0, 0.5).setDepth(41);
  }

  private _buildTimerRing() {
    this.timerRing = this.add.arc(
      this.scale.width - 60, 200, 28, 0, 360, false,
      this.theme.warning, 0.2
    ).setStrokeStyle(4, this.theme.warning, 0.8).setDepth(45);
    this.timerText = this.add.text(
      this.scale.width - 60, 200, '10',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(46);
  }

  private _buildStreakDisplay() {
    this.streakMultText = this.add.text(
      60, 200, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(45);
  }

  private _buildPromptBanner() {
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 215, 640, 70, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 215, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 580 },
      }
    ).setOrigin(0.5).setDepth(49);
  }

  private _buildLifelineButtons() {
    // 50/50 button
    const fiftyBg = this.add.rectangle(0, 0, 100, 36, this.theme.warning, 0.6)
      .setStrokeStyle(2, this.theme.warning, 0.8);
    const fiftyTxt = this.add.text(0, 0, '50:50', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.fiftyFiftyBtn = this.add.container(this.scale.width / 2 - 60, 560, [fiftyBg, fiftyTxt])
      .setSize(100, 36).setInteractive({ useHandCursor: true }).setDepth(50);
    this.fiftyFiftyBtn.on('pointerover', () => fiftyBg.setFillStyle(this.theme.warning, 0.9));
    this.fiftyFiftyBtn.on('pointerout', () => fiftyBg.setFillStyle(this.theme.warning, 0.6));

    // Skip button
    const skipBg = this.add.rectangle(0, 0, 100, 36, this.theme.cardAlt, 0.6)
      .setStrokeStyle(2, this.theme.accent, 0.8);
    const skipTxt = this.add.text(0, 0, 'Skip', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.skipBtn = this.add.container(this.scale.width / 2 + 60, 560, [skipBg, skipTxt])
      .setSize(100, 36).setInteractive({ useHandCursor: true }).setDepth(50);
    this.skipBtn.on('pointerover', () => skipBg.setFillStyle(this.theme.cardAlt, 0.9));
    this.skipBtn.on('pointerout', () => skipBg.setFillStyle(this.theme.cardAlt, 0.6));
  }

  private _buildTimeBar() {
    // DRAMA: Timer pressure bar — shrinks + turns red when time is low.
    this.timeBar = this.add.rectangle(this.scale.width / 2, 240, this.scale.width - 60, 6, this.theme.success, 1).setDepth(48);
  }

  // ===========================================================================
  // KIDS MODE — COMPANION MASCOT
  // Animated puppy host that reacts to gameplay. States:
  //   idle      → gentle bob + occasional chin tap (curious host)
  //   thinking  → head tilt + slow pulse (during question)
  //   celebrate → jump + 360 spin (on correct answer)
  //   highfive  → rapid clap (on streak ≥ 3)
  // ===========================================================================
  private _buildMascot() {
    this.mascotBaseX = this.scale.width - 70;
    this.mascotBaseY = 378;

    this.mascot = this.add.text(this.mascotBaseX, this.mascotBaseY, MASCOT_EMOJI, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${MASCOT_FONT_SIZE}px`,
    }).setOrigin(0.5).setDepth(60);

    this._setMascotState('idle');

    // Mascot is tappable — speaking its name as a small reward.
    this.mascot.setInteractive({ useHandCursor: true });
    this.mascot.on('pointerdown', () => {
      audioBus.speak("Woof woof! You can do it!");
      this._mascotWiggle();
    });
  }

  private _setMascotState(state: 'idle' | 'thinking' | 'celebrate' | 'highfive') {
    if (!this.mascot) return;
    this.mascotState = state;
    try { this.tweens.killTweensOf(this.mascot); } catch {}
    this.mascot.setAngle(0).setScale(1).setPosition(this.mascotBaseX, this.mascotBaseY);

    switch (state) {
      case 'idle': {
        // Gentle bob up/down — perpetual host presence.
        this.tweens.add({
          targets: this.mascot,
          y: this.mascotBaseY - 6,
          duration: 900,
          yoyo: true,
          repeat: 999, // ETERNAL_VIGILANCE: no repeat: -1
          ease: 'Sine.inOut',
        });
        // Occasional chin-tap (rotation wobble) — curious host mannerism.
        this.mascotAnimEvent = this.time.addEvent({
          delay: 3500,
          repeat: 999,
          callback: () => {
            if (this.mascotState !== 'idle') return;
            this.tweens.add({
              targets: this.mascot,
              angle: { from: 0, to: -8 },
              duration: 200, yoyo: true, repeat: 1, ease: 'Sine.inOut',
            });
          },
        });
        break;
      }
      case 'thinking': {
        // Head tilt + slow pulse — engaged-with-question pose.
        this.tweens.add({
          targets: this.mascot,
          angle: -10,
          duration: 400,
          ease: 'Sine.out',
        });
        this.tweens.add({
          targets: this.mascot,
          scale: { from: 1, to: 1.06 },
          duration: 700,
          yoyo: true,
          repeat: 999,
          ease: 'Sine.inOut',
        });
        break;
      }
      case 'celebrate': {
        // Jump + 360 spin — pure joy on correct answer.
        this.tweens.add({
          targets: this.mascot,
          y: this.mascotBaseY - 60,
          duration: 250,
          yoyo: true,
          repeat: 1,
          ease: 'Quad.out',
        });
        this.tweens.add({
          targets: this.mascot,
          angle: 360,
          duration: 600,
          ease: 'Cubic.out',
          onComplete: () => {
            this.mascot.setAngle(0);
            this.time.delayedCall(400, () => {
              if (this.mascotState === 'celebrate') this._setMascotState('idle');
            });
          },
        });
        break;
      }
      case 'highfive': {
        // Quick triple-clap (scale pulse x3) — for streaks.
        this.tweens.add({
          targets: this.mascot,
          scale: { from: 1, to: 1.25 },
          duration: 150, yoyo: true, repeat: 3, ease: 'Quad.out',
          onComplete: () => {
            this.mascot.setScale(1);
            this.time.delayedCall(300, () => {
              if (this.mascotState === 'highfive') this._setMascotState('idle');
            });
          },
        });
        break;
      }
    }
  }

  private _mascotWiggle() {
    try { this.tweens.killTweensOf(this.mascot); } catch {}
    const startX = this.mascot.x;
    this.tweens.add({
      targets: this.mascot,
      x: { from: startX - 8, to: startX + 8 },
      duration: 80, yoyo: true, repeat: 3, ease: 'Sine.inOut',
      onComplete: () => {
        this.mascot.x = this.mascotBaseX;
        this._setMascotState(this.mascotState);
      },
    });
  }

  // ===========================================================================
  // KIDS MODE — STICKER BOOK REWARD
  // Top-right corner virtual sticker book. Every correct answer drops a
  // glowing sticker into it via drag-and-drop animation sequence.
  // Visual reward system children understand — replaces abstract high-score.
  // ===========================================================================
  private _buildStickerBook() {
    const sbX = this.scale.width - 55;
    const sbY = 55;
    const sbW = 80, sbH = 70;

    const bookBg = this.add.rectangle(0, 0, sbW, sbH, this.theme.card, 0.92)
      .setStrokeStyle(3, this.theme.warning, 0.9);
    const bookIcon = this.add.text(0, -10, '📔', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '28px',
    }).setOrigin(0.5);
    this.stickerBadge = this.add.text(0, 22, '0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: this.hex(this.theme.warning),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.stickerBook = this.add.container(sbX, sbY, [bookBg, bookIcon, this.stickerBadge])
      .setDepth(70);

    // Gentle hover bob — makes the book feel alive.
    this.tweens.add({
      targets: this.stickerBook,
      y: sbY - 4,
      duration: 1200, yoyo: true, repeat: 999,
      ease: 'Sine.inOut',
    });

    // Tap sticker book to hear sticker count — reinforces reward.
    this.stickerBook.setSize(sbW, sbH).setInteractive({ useHandCursor: true });
    this.stickerBook.on('pointerdown', () => {
      if (this.stickerCount === 0) {
        audioBus.speak("No stickers yet — answer a question to earn one!");
      } else {
        audioBus.speak(`You have ${this.stickerCount} stickers! Great work!`);
        this._stickerBookShake();
      }
    });
  }

  private _stickerBookShake() {
    this.tweens.add({
      targets: this.stickerBook,
      x: { from: this.stickerBook.x - 4, to: this.stickerBook.x + 4 },
      duration: 60, yoyo: true, repeat: 5, ease: 'Sine.inOut',
    });
  }

  // Drop a glowing sticker from (x, y) into the sticker book — drag-and-drop
  // animation sequence: pop in → arc into book → book catches + pulses.
  private _dropStickerIntoBook(fromX: number, fromY: number) {
    try {
      this.stickerCount++;
      this.stickerBadge.setText(String(this.stickerCount));

      const stickerEmoji = STICKER_EMOJIS[Math.floor(Math.random() * STICKER_EMOJIS.length)];
      const sticker = this.add.text(fromX, fromY, stickerEmoji, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '40px',
      }).setOrigin(0.5).setDepth(200);

      // Glow ring behind sticker — visual reward amplification.
      const glow = this.add.circle(fromX, fromY, 30, this.theme.warning, 0.4)
        .setStrokeStyle(3, this.theme.warning, 0.9).setDepth(199);

      // Phase 1: pop in (Back.out overshoot)
      sticker.setScale(0.3);
      glow.setScale(0.3);
      this.tweens.add({
        targets: [sticker, glow],
        scale: { from: 0.3, to: 1.2 },
        duration: 200, ease: 'Back.out',
        onComplete: () => {
          // Phase 2: arc into sticker book (Cubic.in acceleration)
          const targetX = this.stickerBook.x;
          const targetY = this.stickerBook.y;
          this.tweens.add({
            targets: [sticker, glow],
            x: targetX,
            y: targetY,
            scale: { from: 1.2, to: 0.5 },
            alpha: { from: 1, to: 0.85 },
            duration: 700,
            ease: 'Cubic.in',
            onComplete: () => {
              // Phase 3: book catches + pulses
              this.tweens.add({
                targets: this.stickerBook,
                scale: { from: 1, to: 1.2 },
                duration: 150, yoyo: true, ease: 'Quad.out',
              });
              audioBus.play('pop');
              try { sticker.destroy(); glow.destroy(); } catch {}
            },
          });
        },
      });
    } catch (e) {
      console.error('[QuizScene] _dropStickerIntoBook error:', e);
    }
  }

  // ===========================================================================
  // KIDS MODE — EVENT BUS WIRING
  // Independent systems listen for ANSWER_CORRECT / ANSWER_WRONG:
  //   • Mascot celebrates on correct, sympathizes on wrong
  //   • Sticker drops on correct
  //   • Musical fanfare plays on correct
  //   • Random praise phrase spoken on correct (with delay so term speaks first)
  // ===========================================================================
  private _wireEventBus() {
    this.eventBus.on(GAME_EVENTS.ANSWER_CORRECT, (p: { term: string; coordinate?: { x: number; y: number; t: number }; streak: number; score: number; maxScore: number }) => {
      try {
        // Mascot: high-five for streaks ≥3, regular celebrate otherwise.
        if (p.streak >= 3) {
          this._setMascotState('highfive');
        } else {
          this._setMascotState('celebrate');
        }
        // Drop sticker from answer button location.
        if (p.coordinate) {
          this._dropStickerIntoBook(p.coordinate.x, p.coordinate.y);
        }
        // Musical fanfare — C-E-G-C arpeggio (bright major chord cascade).
        this._playMajorFanfare();
        // Random praise phrase — delayed so the term (spoken by recordAnswer)
        // finishes first, then praise overlays (~600ms after term starts).
        const phrase = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
        this.time.delayedCall(600, () => {
          try { audioBus.speak(phrase, { pitch: 1.2, rate: 1.0 }); } catch {}
        });
      } catch (e) {
        console.error('[QuizScene] ANSWER_CORRECT handler error:', e);
      }
    });

    this.eventBus.on(GAME_EVENTS.ANSWER_WRONG, (_p: { term: string; response: string; coordinate?: { x: number; y: number; t: number } }) => {
      try {
        // Mascot shows sympathy (curious thinking pose) on wrong answer.
        if (this.mascotState !== 'thinking') this._setMascotState('thinking');
      } catch {}
    });
  }

  // ===========================================================================
  // AUDIO-TEXT SYNC HIGHLIGHTING — karaoke-style animated highlight
  // ===========================================================================
  // When speaking, the target Text gets:
  //   • pulsing scale (1.0 ↔ 1.1) at 350ms cycle
  //   • rainbow color cycling through bright pastels at 200ms cycle
  //   • thick yellow stroke + drop shadow (glow effect)
  // Highlight clears the moment speech ends (via onEnd callback) — with
  // an estimated-duration fallback in case TTS fails silently.
  // ===========================================================================
  private _speakWithHighlight(
    textObj: Phaser.GameObjects.Text,
    text: string,
    opts: { rate?: number; pitch?: number; isQuestion?: boolean } = {}
  ) {
    // Cancel any existing highlight first.
    this._clearHighlights();
    this._highlightTargets.push(textObj);

    // Snapshot original style so we can restore it cleanly.
    const origColor = textObj.style.color;
    const origStroke = (textObj.style as any).stroke ?? '#000000';
    const origStrokeThickness = (textObj.style as any).strokeThickness ?? 0;
    const origScale = textObj.scaleX ?? 1;

    // Estimated speech duration (fallback if TTS unavailable / onEnd doesn't fire).
    const estMs = Math.max(1200, text.length * 65);

    const startHighlight = () => {
      try {
        // Apply glow stroke + shadow.
        textObj.setStyle({
          stroke: '#ffff00',
          strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 0, color: '#ffff00', blur: 12, fill: true, stroke: true },
        });

        // Pulsing scale tween — gentle "breathing" effect.
        try { this.tweens.killTweensOf(textObj); } catch {}
        this.tweens.add({
          targets: textObj,
          scale: { from: origScale, to: origScale * 1.1 },
          duration: 350,
          yoyo: true,
          repeat: 999, // ETERNAL_VIGILANCE: no repeat: -1
          ease: 'Sine.inOut',
        });

        // Rainbow color cycle timer.
        let colorIdx = 0;
        const colorTimer = this.time.addEvent({
          delay: 200,
          repeat: 999,
          callback: () => {
            try {
              colorIdx = (colorIdx + 1) % HIGHLIGHT_COLORS.length;
              textObj.setColor(HIGHLIGHT_COLORS[colorIdx]);
            } catch {}
          },
        });
        this._highlightTimers.push(colorTimer);
      } catch (e) {
        console.error('[QuizScene] startHighlight error:', e);
      }
    };

    const endHighlight = () => {
      try {
        // Restore original style.
        textObj.setStyle({
          stroke: origStroke,
          strokeThickness: origStrokeThickness,
          shadow: { offsetX: 0, offsetY: 0, color: '#000000', blur: 0, fill: false, stroke: false },
        });
        textObj.setColor(origColor);
        try { this.tweens.killTweensOf(textObj); } catch {}
        textObj.setScale(origScale);
      } catch (e) {
        console.error('[QuizScene] endHighlight error:', e);
      }
      this._clearHighlights();
    };

    // Fallback timer — ensures highlight ends even if TTS onEnd doesn't fire.
    const fallbackTimer = this.time.delayedCall(estMs + 500, () => {
      if (this._highlightTargets.includes(textObj)) {
        endHighlight();
      }
    });
    this._highlightTimers.push(fallbackTimer);

    // Kick off speech with onStart/onEnd callbacks.
    audioBus.speak(text, {
      ...opts,
      onStart: startHighlight,
      onEnd: endHighlight,
    });
  }

  private _clearHighlights() {
    this._highlightTimers.forEach(t => { try { t.remove(); } catch {} });
    this._highlightTimers = [];
    this._highlightTargets = [];
  }

  // ===========================================================================
  // CELEBRATE CORRECT — massive layered fanfare + confetti rain + "You got it!"
  // ===========================================================================
  // Audio cascade (layered, staggered for richness):
  //   t=0ms    → 'win' (523→1046 sweep, low→high triumphant)
  //   t=120ms  → 'correct' @ 523Hz (C4)
  //   t=240ms  → 'correct' @ 659Hz (E4)
  //   t=360ms  → 'correct' @ 784Hz (G4)
  //   t=480ms  → 'correct' @ 1046Hz (C5)
  //   t=600ms  → 'streak' (880→1320 high sparkle sweep)
  //   t=750ms  → 'pop' (final bright sparkle)
  //   t=300ms  → spoken celebratory phrase ("You got it!" / "Yes! Superstar!")
  //
  // Visual cascade:
  //   • Green flash overlay
  //   • "🎉 YOU GOT IT! 🎉" bouncing popup
  //   • VFX explosion at correct button
  //   • Confetti rain across entire screen (top → falling)
  //   • Multiple glow rings on correct button
  // ===========================================================================
  private _celebrateCorrect(btn: Phaser.GameObjects.Container) {
    try {
      // Visual: green flash + popup + explosion.
      this.juice.flash(this.theme.success, 0.4, 300);
      this.juice.scorePopup(this.scale.width / 2, 200, '🎉 YOU GOT IT! 🎉', this.theme.warning);
      this.juice.burst(btn.x, btn.y, 'win');

      // Layered musical fanfare — C-E-G-C arpeggio + win sweep + streak sparkle + pop.
      audioBus.play('win');
      this.time.delayedCall(120, () => { try { audioBus.play('correct', { freq: 523, duration: 0.25 }); } catch {} }); // C4
      this.time.delayedCall(240, () => { try { audioBus.play('correct', { freq: 659, duration: 0.25 }); } catch {} }); // E4
      this.time.delayedCall(360, () => { try { audioBus.play('correct', { freq: 784, duration: 0.25 }); } catch {} }); // G4
      this.time.delayedCall(480, () => { try { audioBus.play('correct', { freq: 1046, duration: 0.3 }); } catch {} }); // C5
      this.time.delayedCall(600, () => { try { audioBus.play('streak'); } catch {} }); // 880→1320 sparkle
      this.time.delayedCall(750, () => { try { audioBus.play('pop'); } catch {} }); // final pop

      // Spoken celebratory phrase — random pick, delayed so fanfare starts first.
      // (NOTE: EventBus ANSWER_CORRECT listener already speaks a PRAISE_PHRASE at
      // t+600ms. This CELEBRATION_PHRASE at t+300ms layers on top for richness —
      // different phrase pools so they don't repeat.)
      const phrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
      this.time.delayedCall(300, () => {
        try { audioBus.speak(phrase, { pitch: 1.25, rate: 1.0 }); } catch {}
      });

      // VFX explosion on correct answer.
      this._vfxExplosion(btn.x, btn.y);

      // CONFETTI RAIN — drop confetti from the top across the entire screen.
      this._confettiRain();

      // Multiple glow rings on the correct button (3 staggered, growing size).
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 150, () => {
          if (this.isFinished) return;
          try {
            this.juice.glowRing(btn.x, btn.y, HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length].startsWith('#')
              ? parseInt(HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length].slice(1), 16)
              : 0xffff00, 60 + i * 30);
          } catch {}
        });
      }

      // Bouncing "🎉 YOU GOT IT! 🎉" text — extra emphasis.
      const celebrateText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, '🎉 YOU GOT IT! 🎉', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '48px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }).setOrigin(0.5).setDepth(200).setScale(0);

      this.tweens.add({
        targets: celebrateText,
        scale: { from: 0, to: 1.2 },
        duration: 400, ease: 'Back.out',
        onComplete: () => {
          this.tweens.add({
            targets: celebrateText,
            scale: { from: 1.2, to: 1 },
            y: this.scale.height / 2 - 80,
            duration: 300, ease: 'Quad.out',
            onComplete: () => {
              // Hold for 1s, then fade out.
              this.time.delayedCall(1000, () => {
                this.tweens.add({
                  targets: celebrateText,
                  alpha: 0, y: celebrateText.y - 30,
                  duration: 400, ease: 'Cubic.in',
                  onComplete: () => { try { celebrateText.destroy(); } catch {} },
                });
              });
            },
          });
        },
      });
    } catch (e) {
      console.error('[QuizScene] _celebrateCorrect error:', e);
    }
  }

  // ===========================================================================
  // VFX EXPLOSION — 50+ pooled confetti + expanding rings (mirrors SpinWheel)
  // ===========================================================================
  private _vfxExplosion(x: number, y: number) {
    try {
      // 50 confetti particles using Juice burst (multiple calls for density)
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 50, () => {
          if (this.isFinished) return;
          try {
            this.juice.burst(x, y, 'win');
            this.juice.burst(x + Phaser.Math.Between(-80, 80), y + Phaser.Math.Between(-80, 80), 'correct');
          } catch {}
        });
      }

      // Expanding particle rings (3 rings, staggered)
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 150, () => {
          if (this.isFinished) return;
          try {
            this.juice.glowRing(x, y, 0xffff00, 120 + i * 40);
          } catch {}
        });
      }

      // Floating stars (5 stars rising from button)
      for (let i = 0; i < 5; i++) {
        const star = this.add.text(
          x + Phaser.Math.Between(-100, 100),
          y + Phaser.Math.Between(-50, 50),
          '⭐', { fontSize: '28px' }
        ).setOrigin(0.5).setDepth(60).setAlpha(0);
        this.tweens.add({
          targets: star,
          y: star.y - 120,
          alpha: 0,
          scale: { from: 0.5, to: 1.5 },
          duration: 1500,
          delay: i * 100,
          ease: 'Back.out',
          onComplete: () => { try { star.destroy(); } catch {} },
        });
      }
    } catch (e) {
      console.error('[QuizScene] _vfxExplosion error:', e);
    }
  }

  // ===========================================================================
  // CONFETTI RAIN — drop 15 confetti emojis from the top across the screen.
  // Each falls with random horizontal drift + rotation. Lightweight + pooled.
  // ===========================================================================
  private _confettiRain() {
    try {
      const emojis = ['🎉', '🎊', '⭐', '🌟', '💫', '✨', '🎈', '🏆'];
      const count = 15;
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * 80, () => {
          if (this.isFinished) return;
          try {
            const x = Phaser.Math.Between(20, this.scale.width - 20);
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const piece = this.add.text(x, -30, emoji, {
              fontFamily: 'Inter, sans-serif',
              fontSize: `${Phaser.Math.Between(24, 40)}px`,
            }).setOrigin(0.5).setDepth(150);

            const fallDuration = Phaser.Math.Between(1800, 2800);
            const drift = Phaser.Math.Between(-60, 60);
            const rotations = Phaser.Math.Between(2, 5);

            this.tweens.add({
              targets: piece,
              y: this.scale.height + 40,
              x: x + drift,
              angle: 360 * rotations,
              alpha: { from: 1, to: 0.8 },
              duration: fallDuration,
              ease: 'Cubic.in',
              onComplete: () => { try { piece.destroy(); } catch {} },
            });
          } catch {}
        });
      }
    } catch (e) {
      console.error('[QuizScene] _confettiRain error:', e);
    }
  }

  // ===========================================================================
  // KIDS MODE — MUSICAL FANFARE + CURIOUS BACKGROUND MUSIC
  // Curious music: slow pentatonic during question (soft, doesn't distract).
  // Fanfare: bright C-E-G-C major arpeggio on correct (celebratory).
  // ===========================================================================
  private _startCuriousMusic() {
    // Curious pentatonic notes (C, D, E, G, A — never dissonant).
    const notes = [523, 587, 659, 784, 880];
    this._curiousNoteIdx = 0;
    this.curiousMusicTimer = setInterval(() => {
      try {
        if (this.isFinished || this._isPaused) return;
        const freq = notes[this._curiousNoteIdx % notes.length];
        this._curiousNoteIdx++;
        // Soft sine, low gain — background layer using 'hover' preset.
        audioBus.play('hover', { freq, duration: 0.3 });
      } catch {}
    }, 1500);
  }

  private _stopCuriousMusic() {
    if (this.curiousMusicTimer) {
      clearInterval(this.curiousMusicTimer);
      this.curiousMusicTimer = undefined;
    }
  }

  private _playMajorFanfare() {
    // C-E-G-C ascending major arpeggio — bright celebratory chord cascade.
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      this.time.delayedCall(i * 100, () => {
        try { audioBus.play('correct', { freq, duration: 0.25 }); } catch {}
      });
    });
  }

  // ===========================================================================
  // POINTER HANDLING — global handler routes to options + lifelines.
  // Skips removedOptions (no-penalty loop) so faded buttons don't re-fire.
  // ===========================================================================
  private _handlePointer(x: number, y: number) {
    if (!this.canAnswer) return;
    const r = this.rounds[this.round];
    if (!r) return;

    // Hit-test option buttons (skip already-removed ones — no-penalty loop).
    this.optionButtons.forEach((btn, i) => {
      if (this.removedOptions.has(i)) return;
      const btnW = 300, btnH = 80;
      if (Math.abs(x - btn.x) < btnW / 2 && Math.abs(y - btn.y) < btnH / 2) {
        // ESL: speak the option text with karaoke highlight on the option's
        // text element. Retrieve via getData('txt') for safety (children order
        // could change; data tag is stable).
        const optTxt = btn.getData('txt') as Phaser.GameObjects.Text;
        const optionTerm = r.options[i].term;
        if (optTxt) this._speakWithHighlight(optTxt, optionTerm, { pitch: 1.1 });
        // handleAnswer fires immediately — option speech + answer logic overlap.
        // The highlight on optTxt visually anchors the child's attention while
        // the answer reveal animation plays.
        this.handleAnswer(btn, i, r.correctIndex, r.options[i]);
      }
    });

    // Hit-test 50/50 button.
    if (this.fiftyFiftyBtn && !this.lifelinesUsed.fiftyFifty) {
      if (Math.abs(x - this.fiftyFiftyBtn.x) < 50 && Math.abs(y - this.fiftyFiftyBtn.y) < 18) {
        this.useFiftyFifty();
      }
    }
    // Hit-test Skip button.
    if (this.skipBtn && !this.lifelinesUsed.skip) {
      if (Math.abs(x - this.skipBtn.x) < 50 && Math.abs(y - this.skipBtn.y) < 18) {
        this.useSkip();
      }
    }
  }

  // ===========================================================================
  // RENDER ROUND — Question Card pattern with squash-stretch entrance.
  // Old cards slide out, new pooled cards slide in from below with
  // squash-and-stretch (Disney 12-principle) on entrance.
  // ===========================================================================
  private renderRound() {
    if (this.round >= this.rounds.length) {
      // Spaced repetition: if there are wrong answers queued, re-ask them.
      if (this.wrongQueue.length > 0) {
        this.rounds.push(...this.wrongQueue);
        this.wrongQueue = [];
      } else {
        this._stopCuriousMusic();
        this.finishGame(this.score >= this.maxScore * 0.6);
        return;
      }
    }
    this.canAnswer = true;
    this.removedOptions.clear();

    const r = this.rounds[this.round];
    this.promptText.setText(`Which word matches: "${r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term}"?`);

    // AUDIO-TEXT SYNC: Speak the prompt aloud with karaoke highlight so child
    // sees exactly which text is being read. (Commented-out stub in original
    // is now a real call.) Delayed 400ms so entrance animations settle first.
    const promptSpeech = r.prompt.definition ?? r.prompt.term;
    this.time.delayedCall(400, () => {
      if (!this.isFinished && this.rounds[this.round] === r) {
        this._speakWithHighlight(this.promptText, promptSpeech, { isQuestion: true });
      }
    });

    // Mascot enters thinking pose for the new question.
    this._setMascotState('thinking');

    // Update progress bar.
    const pct = this.round / this.rounds.length;
    this.tweens.add({
      targets: this.progressBar,
      width: 500 * pct,
      duration: 300, ease: 'Cubic.out',
    });

    // Start question timer.
    this.startQuestionTimer();

    // Update streak multiplier display.
    const mult = this.streak >= 5 ? 3 : this.streak >= 3 ? 2 : 1;
    this.streakMultText.setText(mult > 1 ? `x${mult} MULT!` : '');

    // Render 4 option buttons with letter labels.
    this.optionButtons.forEach(b => b.destroy());
    this.optionButtons = [];

    const cols = 2, rows = 2;
    const btnW = 300, btnH = 80;
    const gapX = 16, gapY = 16;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;
    const startY = 330;
    const letters = ['A', 'B', 'C', 'D'];

    r.options.forEach((opt, i) => {
      const cx = startX + (i % cols) * (btnW + gapX);
      const cy = startY + Math.floor(i / cols) * (btnH + gapY);

      // Button background.
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.5);
      // Letter badge (left side).
      const letterBg = this.add.circle(-btnW / 2 + 25, 0, 20, this.theme.accent, 0.8);
      const letterTxt = this.add.text(-btnW / 2 + 25, 0, letters[i], {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      // Option text.
      const txt = this.add.text(20, 0, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(cx, cy, [bg, letterBg, letterTxt, txt])
        .setSize(btnW, btnH).setInteractive({ useHandCursor: true });
      container.setData('option', opt);
      container.setData('index', i);
      container.setData('bg', bg);
      container.setData('txt', txt); // for karaoke highlight access in _handlePointer

      container.on('pointerover', () => {
        if (this.canAnswer && !this.removedOptions.has(i)) {
          bg.setFillStyle(this.theme.cardAlt, 1);
          bg.setStrokeStyle(3, this.theme.accent, 1);
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        bg.setFillStyle(this.theme.card, 0.92);
        bg.setStrokeStyle(2, this.theme.accent, 0.5);
      });

      // KIDS MODE — Squash-and-stretch entrance (Disney 12 principle).
      // Card enters squashed (scaleX 0.85, scaleY 1.15) then stretches back
      // to (1, 1) — feels like soft jelly settling into place.
      container.setAlpha(0).setY(cy + 30).setScale(0.85, 1.15);
      this.tweens.add({
        targets: container,
        alpha: 1, y: cy,
        scaleX: 1, scaleY: 1,
        duration: 350, delay: i * 80, ease: 'Back.out',
      });

      this.optionButtons.push(container);
    });
  }

  // ===========================================================================
  // QUESTION TIMER (preserved) + LIFELINES (preserved)
  // ===========================================================================
  private startQuestionTimer() {
    this.questionTimer = 10;
    this.timerText.setText('10');
    this.timerText.setColor(this.hex(this.theme.text));
    this.timerRing.setFillStyle(this.theme.warning, 0.2);

    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    this.questionTimerEvent = this.time.addEvent({
      delay: 1000, repeat: 9,
      callback: () => {
        this.questionTimer--;
        this.timerText.setText(String(this.questionTimer));
        // DRAMA: Update timer pressure bar.
        if (this.timeBar) {
          const pct = this.questionTimer / 10;
          this.timeBar.width = (this.scale.width - 60) * pct;
          if (pct < 0.3) this.timeBar.setFillStyle(this.theme.danger, 1);
          else if (pct < 0.6) this.timeBar.setFillStyle(this.theme.warning, 1);
          else this.timeBar.setFillStyle(this.theme.success, 1);
        }
        // Color shift as time runs out.
        if (this.questionTimer <= 3) {
          this.timerText.setColor(this.hex(this.theme.danger));
          this.timerRing.setFillStyle(this.theme.danger, 0.3);
          audioBus.play('countdown');
        }
        if (this.questionTimer <= 0) {
          this.timeUp();
        }
      },
    });
  }

  private timeUp() {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    // Reveal correct answer.
    const r = this.rounds[this.round];
    const correctBtn = this.optionButtons[r.correctIndex];
    const cBg = correctBtn.getData('bg') as Phaser.GameObjects.Rectangle;
    cBg.setFillStyle(this.theme.success, 0.6);
    this.recordAnswer({
      term: r.prompt.term,
      response: 'timeout',
      success: false,
      coordinate: { x: this.scale.width / 2, y: 300, t: this.time.now },
    });
    this.juice.shake('medium');
    // Mascot sympathy on timeout.
    this._setMascotState('thinking');
    this.time.delayedCall(1200, () => {
      this.round++;
      this.renderRound();
    });
  }

  private useFiftyFifty() {
    if (this.lifelinesUsed.fiftyFifty || !this.canAnswer) return;
    this.lifelinesUsed.fiftyFifty = true;
    this.fiftyFiftyBtn.disableInteractive();
    this.fiftyFiftyBtn.setAlpha(0.3);
    audioBus.play('tap');

    const r = this.rounds[this.round];
    // Remove 2 wrong answers — uses no-penalty loop's removedOptions set.
    const wrongIndices = r.options
      .map((_, i) => i)
      .filter(i => i !== r.correctIndex && !this.removedOptions.has(i));
    Phaser.Utils.Array.Shuffle(wrongIndices);
    const toRemove = wrongIndices.slice(0, 2);

    toRemove.forEach(i => {
      this.removedOptions.add(i);
      const btn = this.optionButtons[i];
      btn.disableInteractive();
      // KIDS MODE — gentle wiggle + fade (not harsh removal).
      this.tweens.add({
        targets: btn,
        alpha: 0.2, scale: 0.9,
        duration: 300, ease: 'Cubic.out',
      });
    });
  }

  private useSkip() {
    if (this.lifelinesUsed.skip || !this.canAnswer) return;
    this.lifelinesUsed.skip = true;
    this.skipBtn.disableInteractive();
    this.skipBtn.setAlpha(0.3);
    audioBus.play('tap');
    if (this.questionTimerEvent) this.questionTimerEvent.remove();
    this.canAnswer = false;
    this.time.delayedCall(400, () => {
      this.round++;
      this.renderRound();
    });
  }

  // ===========================================================================
  // HANDLE ANSWER — KIDS MODE NO-PENALTY LOOP
  // WRONG: button giggles + wiggles + fades out. Child keeps trying.
  // CORRECT: fanfare + sticker drop + mascot celebrate + advance.
  // ===========================================================================
  private handleAnswer(
    btn: Phaser.GameObjects.Container,
    index: number,
    correctIndex: number,
    option: TermItem
  ) {
    if (!this.canAnswer) return;
    if (this.removedOptions.has(index)) return; // Already eliminated.

    const isCorrect = index === correctIndex;
    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;

    if (isCorrect) {
      // ---- CORRECT ANSWER PATH ----
      if (this.questionTimerEvent) this.questionTimerEvent.remove();
      this.canAnswer = false;
      // Clear any in-progress option highlight before launching celebration.
      this._clearHighlights();

      // Record via base class — fires ANSWER_CORRECT through EventBus,
      // which my _wireEventBus listener catches to trigger mascot/sticker/
      // fanfare/praise independently.
      this.recordAnswer({
        term: this.rounds[this.round].prompt.term,
        response: option.term,
        success: true,
        coordinate: { x: btn.x, y: btn.y, t: this.time.now },
      });

      // Visual: green flash + squash-and-stretch on the correct button.
      bg.setFillStyle(this.theme.success, 1);
      bg.setStrokeStyle(4, this.theme.success, 1);
      this._squashAndStretch(btn);
      this.juice.burst(btn.x, btn.y, 'correct');
      // Streak bonus particles.
      if (this.streak >= 3) {
        this.juice.glowRing(btn.x, btn.y, this.theme.warning, 60);
      }

      // KIDS MODE — Massive celebration fanfare + confetti rain + "You got it!"
      // (layers on top of the EventBus-triggered mascot/sticker/fanfare/praise).
      this._celebrateCorrect(btn);

      // Slide out + advance after celebration sequence completes.
      // Extended delay (1100 → 1500ms) to let the bigger fanfare + confetti
      // rain + "You got it!" text play out before transitioning.
      this.time.delayedCall(1500, () => {
        this._clearHighlights();
        this.optionButtons.forEach((b, i) => {
          this.tweens.add({
            targets: b,
            alpha: 0, y: b.y - 30,
            duration: 200, delay: i * 30, ease: 'Cubic.in',
          });
        });
        this.time.delayedCall(300, () => {
          this.round++;
          this.renderRound();
        });
      });

    } else {
      // ---- WRONG ANSWER PATH (NO-PENALTY LOOP) ----
      // Record the wrong attempt in telemetry (still tracked for spaced
      // repetition + analytics), but do NOT advance the round. Child keeps
      // trying remaining options until they tap the correct one.
      this.recordAnswer({
        term: this.rounds[this.round].prompt.term,
        response: option.term,
        success: false,
        coordinate: { x: btn.x, y: btn.y, t: this.time.now },
      });

      // Spaced repetition: queue this round to resurface later (dedupe —
      // only queue once per round, even if child taps multiple wrong answers).
      const currentRound = this.rounds[this.round];
      if (!this.wrongQueue.includes(currentRound)) {
        this.wrongQueue.push(currentRound);
      }

      // KIDS MODE: GIGGLE + WIGGLE + FADE OUT (playful, not harsh).
      // Mark as removed IMMEDIATELY to prevent double-tap re-firing.
      this.removedOptions.add(index);
      btn.disableInteractive();

      // Soft incorrect tone (preserved) + layered giggle (descending sines).
      audioBus.play('incorrect');
      this.time.delayedCall(80, () => {
        try { audioBus.play('hover', { freq: 400, duration: 0.15 }); } catch {}
      });
      this.time.delayedCall(180, () => {
        try { audioBus.play('hover', { freq: 320, duration: 0.15 }); } catch {}
      });

      // Wiggle: rapid x oscillation (giggle motion).
      const originalX = btn.x;
      this.tweens.add({
        targets: btn,
        x: { from: originalX - 8, to: originalX + 8 },
        duration: 80, yoyo: true, repeat: 5, ease: 'Sine.inOut',
        onComplete: () => {
          btn.x = originalX;
          // Then fade out + slide down + dim — button is "voted off".
          bg.setFillStyle(this.theme.cardAlt, 0.5);
          this.tweens.add({
            targets: btn,
            alpha: 0.2, y: btn.y + 20, scale: 0.92,
            duration: 350, ease: 'Cubic.out',
          });
        },
      });

      // Mascot reaction: gentle sympathy wiggle.
      this._mascotWiggle();

      // Speak encouragement with karaoke highlight on the prompt — delayed so
      // the tapped option's term speech finishes first.
      this.time.delayedCall(500, () => {
        try {
          this.promptText.setText('Try again!');
          this._speakWithHighlight(this.promptText, 'Try again!', { rate: 1.0, pitch: 1.1 });
        } catch {}
      });

      // Child keeps trying — canAnswer stays TRUE.
      // (No advancement until correct answer is tapped.)
    }
  }

  // ===========================================================================
  // KIDS MODE — SQUASH AND STRETCH (Disney 12 principle of animation)
  // Phase 1: squash (scaleX 1.3, scaleY 0.7) — anticipation/impact
  // Phase 2: stretch (scaleX 0.85, scaleY 1.15) — overshoot rebound
  // Phase 3: settle (scaleX 1, scaleY 1) — Back.out ease for snap
  // ===========================================================================
  private _squashAndStretch(target: Phaser.GameObjects.GameObject) {
    if (!this.juice) return;
    try {
      // Phase 1: squash
      this.tweens.add({
        targets: target,
        scaleX: 1.3, scaleY: 0.7,
        duration: 90, ease: 'Quad.out',
        onComplete: () => {
          // Phase 2: stretch overshoot
          this.tweens.add({
            targets: target,
            scaleX: 0.85, scaleY: 1.15,
            duration: 90, ease: 'Quad.out',
            onComplete: () => {
              // Phase 3: settle
              this.tweens.add({
                targets: target,
                scaleX: 1, scaleY: 1,
                duration: 120, ease: 'Back.out',
              });
            },
          });
        },
      });
    } catch {}
  }

  // ===========================================================================
  // BUILD ERROR FALLBACK — ETERNAL_VIGILANCE rule 13: never show black screen.
  // ===========================================================================
  private _showBuildError(e: any) {
    try {
      this.add.text(
        this.scale.width / 2, this.scale.height / 2,
        'Quiz had a hiccup — tap to retry.',
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold',
          align: 'center',
        }
      ).setOrigin(0.5).setDepth(999);
      this.add.text(
        this.scale.width / 2, this.scale.height / 2 + 40,
        String(e?.message ?? e),
        { fontFamily: 'monospace', fontSize: '12px', color: '#ff8888' }
      ).setOrigin(0.5).setDepth(999);
    } catch {}
  }
}
