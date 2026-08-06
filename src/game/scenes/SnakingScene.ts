import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// LETTER SNAKE — AAAA Letter-Spelling Snake  (AAAA 2029 edition)
// ============================================================================
// Spelling-by-letter snake. Each round a target WORD is shown and the snake
// must eat letters in the correct order (e.g. C → A → T for "CAT").
// Premium features:
//   • LetterBubble interface with bubble circles + golden pulse on the
//     currently-needed letter (so kids always know which letter to find next)
//   • Magnetic pull — snake moves +25% faster when within 100px of the
//     correct letter (gives the snake a "homing" feel as it nears the goal)
//   • Soft collisions — walls + tail do NOT end the game. The snake bounces
//     back + squeaks instead. The game never terminates on a wall/tail hit.
//   • Expressive eyes — 👀 overlay on the snake head rotates to look toward
//     the currently-needed letter bubble
//   • Hit-stop — 150ms freeze on word completion for that satisfying "snap"
//   • Progress slots — hollow `_` letter slots at the top; fill green as the
//     player collects each correct letter
//   • Word complete celebration — snake wiggle + 20-star downpour + "win" SFX
//   • D-pad for mobile (4 arrow buttons in the bottom-right corner)
//   • ESL TTS via makeHoverSpeakable on prompt + per-bubble tap-to-hear-letter
// ============================================================================

// AAAA KIDS MODE — Letter bubble (a circle with a letter inside)
interface LetterBubble {
  letter: string;          // uppercase A-Z
  isCorrect: boolean;      // is this the currently needed letter?
  circle: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Arc;   // golden pulse ring (only on correct bubble)
  x: number;
  y: number;
  alive: boolean;
}

interface SnakeSeg { x: number; y: number; text: Phaser.GameObjects.Text; }

export default class SnakingScene extends BaseEngine {
  private snake: SnakeSeg[] = [];
  private letterBubbles: LetterBubble[] = [];
  private direction = { x: 1, y: 0 };
  private nextDirection = { x: 1, y: 0 };
  private gridStep = 30;
  private moveTimer = 0;
  private moveInterval = 320; // AAAA KIDS MODE: Gentler start
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private lengthText!: Phaser.GameObjects.Text;
  private isMoving = false;
  private startHint?: Phaser.GameObjects.Text;

  // AAAA KIDS MODE — Letter-spelling state
  private currentWord = '';
  private currentWordTerm?: TermItem;
  private lettersCollected = 0;
  private wordQueue: TermItem[] = [];
  private wordsCompleted = 0;

  // AAAA KIDS MODE — Expressive eyes overlay (👀 looking toward correct letter)
  private snakeEyes?: Phaser.GameObjects.Text;

  // AAAA KIDS MODE — Hit-stop timestamp (snake freezes briefly on word complete)
  private hitStopUntil = 0;

  // AAAA KIDS MODE — Progress slots (hollow _ letter slots at top, fill green)
  private progressSlots: Phaser.GameObjects.Text[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 30, '🐍 Letter Snake', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '24px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 100, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 100, '', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    // AAAA KIDS MODE — Hover-speakable prompt (replaces makeSpeakable).
    this.makeHoverSpeakable(this.promptText);

    this.lengthText = this.add.text(20, 140, 'Length: 3', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);

    this.startHint = this.add.text(this.scale.width / 2, this.scale.height / 2 + 80,
      'Tap arrow keys, swipe, or use the D-pad to start!', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px',
        color: this.hex(this.theme.warning),
      }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.tweens.add({
      targets: this.startHint, alpha: { from: 0.4, to: 1 },
      duration: 800, yoyo: true, repeat: 999,
    });

    // ---- Snake (initial 3 segments) ----
    const startX = 120;
    const startY = Math.floor(this.scale.height / 2 / this.gridStep) * this.gridStep;
    for (let i = 0; i < 3; i++) {
      this.snake.push({
        x: startX - i * this.gridStep, y: startY,
        text: this.add.text(startX - i * this.gridStep, startY,
          i === 0 ? '🐍' : '🟢', { fontSize: '24px' }).setOrigin(0.5).setDepth(100),
      });
    }

    // ---- Expressive eyes overlay (sits on top of snake head) ----
    this.snakeEyes = this.add.text(startX, startY - 18, '👀', { fontSize: '14px' })
      .setOrigin(0.5).setDepth(101);

    // ---- Keyboard input ----
    this.input.keyboard?.on('keydown-LEFT', () => this.changeDirection(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeDirection(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.changeDirection(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.changeDirection(0, 1));

    // ---- D-pad for mobile (4 arrow buttons in bottom-right corner) ----
    this._createDPad();

    // ---- Swipe / tap-to-steer (global pointer) ----
    this.setupGlobalPointer((x, y) => {
      const head = this.snake[0];
      const dx = x - head.x, dy = y - head.y;
      if (Math.abs(dx) > Math.abs(dy)) this.changeDirection(dx > 0 ? 1 : -1, 0);
      else this.changeDirection(0, dy > 0 ? 1 : -1);
    });

    this.isMoving = false;

    // ---- First word ----
    this._nextWord();
  }

  protected onTick(_remainingMs: number) {
    if (!this.isMoving || this.isFinished) return;
    // AAAA — Hit-stop: freeze snake movement during word-complete celebration.
    if (this.time.now < this.hitStopUntil) return;

    // AAAA — Magnetic pull: speed up by 25% (1.25×) when within 100px of the
    // currently-needed letter bubble.
    const interval = this._currentMoveInterval();

    // PHYSICS FIX: Frame-rate independent using actual delta time.
    const dt = this.game.loop.delta;
    this.moveTimer += dt;
    if (this.moveTimer >= interval) {
      this.moveTimer = 0;
      this.moveSnake();
    }

    // AAAA — Update expressive eyes each frame (look toward correct letter).
    this._updateEyes();
  }

  // ===========================================================================
  // AAAA — Magnetic pull helper
  // Returns the current move interval, reduced (faster) when the snake head
  // is within 100px of the currently-needed correct letter bubble.
  // ===========================================================================
  private _currentMoveInterval(): number {
    const head = this.snake[0];
    if (!head) return this.moveInterval;
    let nearestDist = Infinity;
    for (const b of this.letterBubbles) {
      if (!b.alive || !b.isCorrect) continue;
      const d = Phaser.Math.Distance.Between(head.x, head.y, b.x, b.y);
      if (d < nearestDist) nearestDist = d;
    }
    if (nearestDist < 100) {
      // 25% faster (1.25× speed = interval / 1.25)
      return this.moveInterval / 1.25;
    }
    return this.moveInterval;
  }

  private changeDirection(x: number, y: number) {
    if (this.direction.x === -x && this.direction.y === -y && this.isMoving) return;
    this.nextDirection = { x, y };
    if (!this.isMoving) {
      this.isMoving = true;
      if (this.startHint) { this.startHint.destroy(); this.startHint = undefined; }
    }
    audioBus.play('tap');
  }

  // ===========================================================================
  // AAAA — Soft bounce (game does NOT terminate on wall/tail hit)
  // Reverses direction + squeak sound + head wobble.
  // ===========================================================================
  private _softBounce() {
    // Squeak sound (closest available: whack + brief "Oops!").
    try { audioBus.play('whack'); } catch {}
    try { audioBus.speak('Oops!'); } catch {}

    // Reverse direction so the snake bounces back.
    this.direction = { x: -this.direction.x, y: -this.direction.y };
    this.nextDirection = { ...this.direction };

    // Head wobble for visual feedback.
    const head = this.snake[0];
    if (head) {
      try {
        this.tweens.add({
          targets: head.text,
          angle: { from: -10, to: 10 },
          duration: 80, yoyo: true, repeat: 1, ease: 'Sine.inOut',
          onComplete: () => { try { head.text.setAngle(0); } catch {} },
        });
      } catch {}
    }
  }

  // ===========================================================================
  // AAAA — Expressive eyes (👀 overlay on snake head, looking toward correct letter)
  // ===========================================================================
  private _updateEyes() {
    if (!this.snakeEyes || this.snake.length === 0) return;
    const head = this.snake[0];
    this.snakeEyes.x = head.x;
    this.snakeEyes.y = head.y - 18;

    // Find the currently-needed correct letter bubble.
    let nearest: LetterBubble | null = null;
    let nearestDist = Infinity;
    for (const b of this.letterBubbles) {
      if (!b.alive || !b.isCorrect) continue;
      const d = Phaser.Math.Distance.Between(head.x, head.y, b.x, b.y);
      if (d < nearestDist) { nearestDist = d; nearest = b; }
    }
    if (nearest) {
      // Look toward it: rotate eyes toward the bubble.
      const dx = nearest.x - head.x;
      const dy = nearest.y - head.y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      this.snakeEyes.setAngle(angle);
    } else {
      this.snakeEyes.setAngle(0);
    }
  }

  // ===========================================================================
  // AAAA — D-pad for mobile (4 arrow buttons)
  // ===========================================================================
  private _createDPad() {
    const cx = this.scale.width - 80;
    const cy = this.scale.height - 80;
    const pad = 16;
    const accentHex = '#' + this.theme.accent.toString(16).padStart(6, '0');

    const make = (label: string, x: number, y: number, dx: number, dy: number) => {
      const btn = this.add.text(x, y, label, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '24px', color: '#ffffff',
        backgroundColor: accentHex,
        padding: { x: pad, y: pad - 4 },
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.changeDirection(dx, dy));
    };

    make('◀', cx - 50, cy, -1, 0);
    make('▶', cx + 50, cy, 1, 0);
    make('▲', cx, cy - 50, 0, -1);
    make('▼', cx, cy + 50, 0, 1);
  }

  // ===========================================================================
  // AAAA — Progress slots (hollow _ at top, fill green as collected)
  // ===========================================================================
  private _rebuildProgressSlots() {
    // Destroy old slots.
    this.progressSlots.forEach(s => { try { s.destroy(); } catch {} });
    this.progressSlots = [];

    const slotSize = 28;
    const gap = 4;
    const n = this.currentWord.length;
    const totalW = n * slotSize + (n - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + slotSize / 2;
    const y = 175;
    for (let i = 0; i < n; i++) {
      const slot = this.add.text(startX + i * (slotSize + gap), y, '_', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '28px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(50);
      this.progressSlots.push(slot);
    }
  }

  // ===========================================================================
  // AAAA — Next word (pick term, rebuild progress slots, spawn letter bubbles)
  // ===========================================================================
  private _nextWord() {
    if (this.score >= this.maxScore) { this.finishGame(true); return; }

    // Build queue if empty.
    if (this.wordQueue.length === 0) {
      this.wordQueue = [...this.terms];
      Phaser.Utils.Array.Shuffle(this.wordQueue);
    }

    // Pick next term with a usable (alphabetic, 2-8 char) word.
    let term: TermItem | undefined;
    let word = '';
    while (this.wordQueue.length > 0) {
      const candidate = this.wordQueue.shift()!;
      const w = candidate.term.toUpperCase().replace(/[^A-Z]/g, '');
      if (w.length >= 2 && w.length <= 8) {
        term = candidate;
        word = w;
        break;
      }
    }
    if (!term || !word) {
      // No suitable word — finish the game (won = score >= 60%).
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }

    this.currentWordTerm = term;
    this.currentWord = word;
    this.lettersCollected = 0;

    // Update prompt + speak text.
    const def = term.definition ?? term.emoji ?? term.term;
    const promptStr = `Spell: "${def}" — eat the letters in order!`;
    this.promptText.setText(promptStr);
    this.promptText.setData('speakText', `Spell the word ${word}. ${def}`);

    // Rebuild progress slots for the new word.
    this._rebuildProgressSlots();

    // Spawn letter bubbles.
    this._spawnLetterBubbles();

    // Speak the prompt with karaoke highlight.
    this.time.delayedCall(400, () => {
      if (!this.isFinished) {
        this.speakPromptWithHighlight(this.promptText,
          `Spell the word ${word}. ${def}`, { isQuestion: true });
      }
    });
  }

  // ===========================================================================
  // AAAA — Spawn letter bubbles for the current word
  // Includes the word's letters + a few decoy letters. The currently-needed
  // letter (lettersCollected index) gets a golden pulse.
  // ===========================================================================
  private _spawnLetterBubbles() {
    // Destroy old bubbles.
    this.letterBubbles.forEach(b => {
      try { b.circle.destroy(); } catch {}
      try { b.text.destroy(); } catch {}
      try { b.glow.destroy(); } catch {}
    });
    this.letterBubbles = [];

    const letters = this.currentWord.split('');
    // Decoys: random letters not in the word, to fill the field.
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const decoys: string[] = [];
    const numDecoys = Math.max(3, Math.min(8, 12 - letters.length));
    while (decoys.length < numDecoys) {
      const c = Phaser.Utils.Array.GetRandom(allLetters);
      if (!letters.includes(c) && !decoys.includes(c)) decoys.push(c);
    }
    const all = [...letters, ...decoys];
    Phaser.Utils.Array.Shuffle(all);

    const nextNeeded = letters[0];

    // Avoid spawning a bubble on top of the snake.
    const occupied = new Set(this.snake.map(s => `${s.x},${s.y}`));

    for (const letter of all) {
      let gx = 0, gy = 0;
      let attempts = 0;
      do {
        gx = Math.floor((60 + Math.random() * (this.scale.width - 120)) / this.gridStep) * this.gridStep;
        gy = Math.floor((250 + Math.random() * (this.scale.height - 350)) / this.gridStep) * this.gridStep;
        attempts++;
      } while (occupied.has(`${gx},${gy}`) && attempts < 20);
      occupied.add(`${gx},${gy}`);

      const isCorrect = letter === nextNeeded;

      const circle = this.add.circle(gx, gy, 18,
        isCorrect ? 0xfde68a : 0x93c5fd, 0.9)
        .setStrokeStyle(3, isCorrect ? 0xf59e0b : 0x3b82f6, 1)
        .setDepth(50);
      const text = this.add.text(gx, gy, letter, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px',
        color: '#1f2937', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(51);
      const glow = this.add.circle(gx, gy, 24, 0xfbbf24, 0).setDepth(49);

      // Golden pulse on the correct (currently-needed) letter.
      if (isCorrect) {
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.3, to: 0.9 },
          scale: { from: 1, to: 1.3 },
          duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
        });
      }

      // ESL: tap-to-hear-letter (local handler — does NOT stopPropagation so
      // the global pointer handler still changes snake direction).
      text.setData('speakText', letter);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        try { audioBus.speak(letter); } catch {}
      });

      this.letterBubbles.push({
        letter, isCorrect, circle, text, glow,
        x: gx, y: gy, alive: true,
      });
    }
  }

  // ===========================================================================
  // AAAA — Move snake one grid step
  // Handles wall/tail soft-bounce + letter-bubble eat detection.
  // ===========================================================================
  private moveSnake() {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const newX = head.x + this.direction.x * this.gridStep;
    const newY = head.y + this.direction.y * this.gridStep;

    // AAAA — Soft collision with walls (game does NOT terminate).
    if (newX < 20 || newX > this.scale.width - 20 ||
        newY < 220 || newY > this.scale.height - 20) {
      this._softBounce();
      return;
    }
    // AAAA — Soft collision with tail (game does NOT terminate).
    for (let i = 1; i < this.snake.length; i++) {
      if (this.snake[i].x === newX && this.snake[i].y === newY) {
        this._softBounce();
        return;
      }
    }

    // Check letter bubble at the new position.
    let eaten: LetterBubble | null = null;
    for (const b of this.letterBubbles) {
      if (b.alive && Phaser.Math.Distance.Between(newX, newY, b.x, b.y) < 25) {
        eaten = b;
        break;
      }
    }

    // If eating a wrong letter, soft bounce (don't move forward).
    if (eaten) {
      const nextNeeded = this.currentWord[this.lettersCollected];
      if (eaten.letter !== nextNeeded) {
        this._softBounce();
        return;
      }
    }

    // Move snake forward: unshift new head, demote old head to body.
    const newHead: SnakeSeg = {
      x: newX, y: newY,
      text: this.add.text(newX, newY, '🐍', { fontSize: '24px' }).setOrigin(0.5).setDepth(100),
    };
    this.snake.unshift(newHead);
    if (this.snake[1]) this.snake[1].text.setText('🟢');

    if (eaten) {
      this._handleEat(eaten);
    }
    // Always pop tail (snake stays fixed length — only score matters).
    const tail = this.snake.pop();
    if (tail) tail.text.destroy();

    this.lengthText.setText(`Length: ${this.snake.length}`);
  }

  // ===========================================================================
  // AAAA — Handle eating a correct letter bubble
  // Marks the bubble as eaten, fills the progress slot green, re-pulses the
  // next correct bubble, and fires _wordComplete() when the word is done.
  // ===========================================================================
  private _handleEat(bubble: LetterBubble) {
    bubble.alive = false;
    try { bubble.circle.destroy(); } catch {}
    try { bubble.text.destroy(); } catch {}
    try { bubble.glow.destroy(); } catch {}
    this.letterBubbles = this.letterBubbles.filter(b => b !== bubble);

    this.lettersCollected++;
    // Fill progress slot green with the eaten letter.
    const slot = this.progressSlots[this.lettersCollected - 1];
    if (slot) {
      slot.setText(bubble.letter);
      slot.setColor('#22c55e');
    }

    audioBus.play('correct');
    audioBus.speak(bubble.letter);
    this.juice.burst(bubble.x, bubble.y, 'correct');

    // Mark the next correct bubble (golden pulse).
    const nextLetter = this.currentWord[this.lettersCollected];
    if (nextLetter) {
      this.letterBubbles.forEach(b => {
        b.isCorrect = b.letter === nextLetter;
        if (b.isCorrect) {
          b.circle.setFillStyle(0xfde68a, 0.9).setStrokeStyle(3, 0xf59e0b, 1);
          this.tweens.add({
            targets: b.glow,
            alpha: { from: 0.3, to: 0.9 },
            scale: { from: 1, to: 1.3 },
            duration: 600, yoyo: true, repeat: 999, ease: 'Sine.inOut',
          });
        } else {
          b.circle.setFillStyle(0x93c5fd, 0.9).setStrokeStyle(3, 0x3b82f6, 1);
        }
      });
    }

    // Word complete?
    if (this.lettersCollected >= this.currentWord.length) {
      // Record one answer per word (1 score point per word).
      this.recordAnswer({
        term: this.currentWordTerm!.term,
        response: this.currentWord,
        success: true,
        coordinate: { x: bubble.x, y: bubble.y, t: this.time.now },
      });
      this._wordComplete();
    }
  }

  // ===========================================================================
  // AAAA — Word complete celebration
  // 150ms hit-stop (freeze) + snake wiggle victory dance + 20-star downpour.
  // ===========================================================================
  private _wordComplete() {
    // AAAA — Hit-stop: 150ms freeze.
    this.hitStopUntil = this.time.now + 150;

    // Victory dance: snake wiggles.
    this.snake.forEach((seg, i) => {
      this.tweens.add({
        targets: seg.text,
        angle: { from: -15, to: 15 },
        duration: 200, delay: i * 30, yoyo: true, repeat: 2, ease: 'Sine.inOut',
        onComplete: () => { try { seg.text.setAngle(0); } catch {} },
      });
    });

    // Star downpour — 20 stars fall from the sky.
    for (let i = 0; i < 20; i++) {
      const star = this.add.text(
        Math.random() * this.scale.width, -20 - i * 15, '🌟',
        { fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Arial Black, sans-serif',
          fontSize: (20 + Math.random() * 16) + 'px' }
      ).setOrigin(0.5).setDepth(80);
      this.tweens.add({
        targets: star,
        y: this.scale.height + 30,
        duration: 1200 + Math.random() * 400, delay: i * 60,
        ease: 'Cubic.in',
        angle: 360,
        onComplete: () => { try { star.destroy(); } catch {} },
      });
    }

    try { audioBus.play('win'); } catch {}
    try { audioBus.speak(`Great! You spelled ${this.currentWord}!`); } catch {}

    this.wordsCompleted++;

    // Clear remaining bubbles (any decoys still on screen).
    this.letterBubbles.forEach(b => {
      try { b.circle.destroy(); } catch {}
      try { b.text.destroy(); } catch {}
      try { b.glow.destroy(); } catch {}
    });
    this.letterBubbles = [];

    // Advance to next word after the celebration.
    this.time.delayedCall(1500, () => {
      if (!this.isFinished) this._nextWord();
    });
  }
}
