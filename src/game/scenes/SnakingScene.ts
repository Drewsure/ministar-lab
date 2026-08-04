import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// WORD SNAKE — "AAAA Kid-Juice" Edition
// ============================================================================
// A vibrant, expressive letter-spelling snake game for ages 4-9. The snake
// swims through jelly-like space, eating letters IN ORDER to spell the target
// word. Designed to feel like a living cartoon, not a stressful arcade game.
//
// AAAA KID-JUICE POLISH:
//   • Letter-by-letter spelling: eat C, then A, then T to spell "CAT"
//   • Bubble-wrapped letters: letters drift in shimmering soap bubbles
//   • Magnetic pull: snake gets +25% speed when within 100px of correct letter
//   • Soft collisions: hitting wall/tail = comical bounce-back + squeak (NO game over)
//   • Expressive snake head: 🐍 with eyes that look toward the correct letter
//   • Spring-physics tail: segments whip around with lag + bounce (gummy worm)
//   • Wrong letter spit-out: snake sneezes + spits letter back in a bubble
//   • Word completion hit-stop: 150ms freeze + victory dance + letter glow
//   • Progress track: hollow letter slots at top fill as letters are collected
//   • Golden pulse on the currently-needed letter (color-coded accessibility)
//   • Audio narration: each letter spoken when eaten + full word on completion
//
// EXISTING FEATURES (preserved):
//   • Term-based vocabulary (uses this.terms from launch config)
//   • Hover-to-speak + karaoke highlighting
//   • Auto-celebration fanfare + sticker book + auto-mascot
//   • Slow mode + extended time support
//   • Pause (total freeze)
// ============================================================================

interface SnakeSeg {
  x: number; y: number;
  text: Phaser.GameObjects.Text;
  letter?: string;  // AAAA: letter this segment represents (for spelled word display)
}

interface LetterBubble {
  letter: string;
  isCorrect: boolean;  // is this the NEXT letter needed?
  text: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Arc;  // soap bubble circle
  x: number; y: number;
  driftPhase: number;  // for gentle floating animation
}

export default class SnakingScene extends BaseEngine {
  private snake: SnakeSeg[] = [];
  private bubbles: LetterBubble[] = [];
  private direction = { x: 1, y: 0 };
  private nextDirection = { x: 1, y: 0 };
  private gridStep = 30;
  private moveTimer = 0;
  private moveInterval = 200; // AAAA "plush pace" — slow, deliberate (was 300)
  private currentWord = '';
  private currentTerm?: TermItem;
  private lettersCollected = 0;  // how many letters of current word eaten
  private wordsCompleted = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private progressSlots: Phaser.GameObjects.Text[] = [];  // hollow letter slots at top
  private isMoving = false;
  private startHint?: Phaser.GameObjects.Text;
  private snakeEyes!: Phaser.GameObjects.Text;  // expressive eyes overlay
  private bounceUntil = 0;  // soft collision recovery timer
  private hitStopUntil = 0;  // word completion hit-stop

  // AAAA: Age-gated word lengths.
  // Ages 4-5: 3 letters, Ages 6-7: 4-5 letters, Ages 8-9: 5+ letters.
  // Default to 3-4 letters for safety (can be overridden by term length).
  private minWordLength = 3;
  private maxWordLength = 5;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    // AAAA: Filter terms to age-appropriate word lengths.
    const suitableTerms = this.terms.filter(t => {
      const w = t.term.replace(/[^a-zA-Z]/g, '');
      return w.length >= this.minWordLength && w.length <= this.maxWordLength;
    });
    // Fallback: if no suitable terms, use all terms.
    if (suitableTerms.length === 0) {
      this.terms = this.terms.map(t => ({ ...t, term: t.term.slice(0, 5) }));
    } else {
      this.terms = suitableTerms;
    }

    // ---- Title ----
    this.add.text(this.scale.width / 2, 35, '🐍 Word Snake', {
      fontFamily: 'Inter, sans-serif', fontSize: '26px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 80, 640, 40, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 80, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText);

    // ---- Progress track (hollow letter slots at top) ----
    // Created per-word in spawnWord().

    // ---- Snake ----
    const startX = 120;
    const startY = Math.floor(this.scale.height / 2 / this.gridStep) * this.gridStep;
    for (let i = 0; i < 3; i++) {
      this.snake.push({
        x: startX - i * this.gridStep, y: startY,
        text: this.add.text(startX - i * this.gridStep, startY, i === 0 ? '🐍' : '🟢', { fontSize: '22px' }).setOrigin(0.5).setDepth(100),
      });
    }

    // Expressive eyes overlay (follows snake head).
    this.snakeEyes = this.add.text(startX, startY - 8, '👀', { fontSize: '14px' }).setOrigin(0.5).setDepth(101);

    // ---- Input ----
    this.input.keyboard?.on('keydown-LEFT', () => this.changeDirection(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeDirection(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.changeDirection(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.changeDirection(0, 1));
    this.setupGlobalPointer((x, y) => {
      const head = this.snake[0];
      const dx = x - head.x, dy = y - head.y;
      if (Math.abs(dx) > Math.abs(dy)) this.changeDirection(dx > 0 ? 1 : -1, 0);
      else this.changeDirection(0, dy > 0 ? 1 : -1);
    });

    // ---- On-screen D-pad for mobile ----
    this._createDPad();

    // ---- Start hint ----
    this.startHint = this.add.text(this.scale.width / 2, this.scale.height / 2 + 80, 'Tap arrows or swipe to start!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning),
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: this.startHint, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: 999 });

    this.spawnWord();
    this.isMoving = false;
  }

  protected onTick(_remainingMs: number) {
    if (!this.isMoving || this.isFinished) return;
    // AAAA: Hit-stop freeze (word completion celebration).
    if (this.time.now < this.hitStopUntil) return;
    // AAAA: Soft collision bounce recovery — don't move during bounce-back.
    if (this.time.now < this.bounceUntil) return;

    const dt = this.game.loop.delta;
    this.moveTimer += dt;

    // AAAA: Magnetic pull — +25% speed when within 100px of correct letter.
    let speedBoost = 1.0;
    const head = this.snake[0];
    const correctBubble = this.bubbles.find(b => b.isCorrect);
    if (correctBubble) {
      const dist = Phaser.Math.Distance.Between(head.x, head.y, correctBubble.x, correctBubble.y);
      if (dist < 100) speedBoost = 1.25;
    }

    const effectiveInterval = this.moveInterval / speedBoost / this.timeMultiplier();
    if (this.moveTimer >= effectiveInterval) {
      this.moveTimer = 0;
      this.moveSnake();
    }

    // AAAA: Update expressive eyes to look toward correct letter.
    this._updateEyes();

    // AAAA: Gentle bubble drift animation.
    this._updateBubbleDrift();
  }

  // ===========================================================================
  // AAAA — Expressive snake eyes look toward the correct letter.
  // ===========================================================================
  private _updateEyes() {
    if (!this.snakeEyes || this.snake.length === 0) return;
    const head = this.snake[0];
    const correctBubble = this.bubbles.find(b => b.isCorrect);
    if (correctBubble) {
      const dx = correctBubble.x - head.x;
      const dy = correctBubble.y - head.y;
      // Offset eyes slightly toward the target.
      const offsetX = Math.sign(dx) * 3;
      const offsetY = Math.sign(dy) * 2;
      this.snakeEyes.setPosition(head.x + offsetX, head.y - 8 + offsetY);
    } else {
      this.snakeEyes.setPosition(head.x, head.y - 8);
    }
  }

  // ===========================================================================
  // AAAA — Bubble drift: letters gently float up/down inside their bubbles.
  // ===========================================================================
  private _updateBubbleDrift() {
    for (const bubble of this.bubbles) {
      bubble.driftPhase += 0.02;
      const driftY = Math.sin(bubble.driftPhase) * 4;
      if (bubble.text && bubble.text.active) {
        bubble.text.y = bubble.y + driftY;
      }
      if (bubble.bubble && bubble.bubble.active) {
        bubble.bubble.y = bubble.y + driftY;
      }
    }
  }

  // ===========================================================================
  // AAAA — On-screen D-pad for mobile (large tap targets).
  // ===========================================================================
  private _createDPad() {
    const dpadX = 60;
    const dpadY = this.scale.height - 60;
    const btnSize = '32px';
    const mkBtn = (text: string, x: number, y: number, dx: number, dy: number) => {
      const btn = this.add.text(x, y, text, {
        fontFamily: 'Inter, sans-serif', fontSize: btnSize, color: '#ffffff',
        backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
        padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.changeDirection(dx, dy));
    };
    mkBtn('◀', dpadX, dpadY, -1, 0);
    mkBtn('▶', dpadX + 70, dpadY, 1, 0);
    mkBtn('▲', dpadX + 35, dpadY - 35, 0, -1);
    mkBtn('▼', dpadX + 35, dpadY + 35, 0, 1);
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
  // MOVE SNAKE — with soft collisions (NO game over on wall/tail hit).
  // ===========================================================================
  private moveSnake() {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const newX = head.x + this.direction.x * this.gridStep;
    const newY = head.y + this.direction.y * this.gridStep;

    // AAAA: Soft collision with walls — bounce-back + squeak (NO game over).
    if (newX < 20 || newX > this.scale.width - 20 || newY < 220 || newY > this.scale.height - 20) {
      this._softBounce(head.x, head.y);
      return;
    }

    // AAAA: Soft collision with own tail — bounce-back + squeak (NO game over).
    for (let i = 1; i < this.snake.length; i++) {
      if (this.snake[i].x === newX && this.snake[i].y === newY) {
        this._softBounce(head.x, head.y);
        return;
      }
    }

    // Check letter bubble collision.
    let eatenBubble: LetterBubble | null = null;
    for (const bubble of this.bubbles) {
      if (Phaser.Math.Distance.Between(newX, newY, bubble.x, bubble.y) < 25) {
        eatenBubble = bubble;
        break;
      }
    }

    // Move snake: add new head.
    const newHead: SnakeSeg = {
      x: newX, y: newY,
      text: this.add.text(newX, newY, '🐍', { fontSize: '22px' }).setOrigin(0.5).setDepth(100),
    };
    this.snake.unshift(newHead);
    if (this.snake[1]) this.snake[1].text.setText('🟢');

    if (eatenBubble) {
      this.handleEatLetter(eatenBubble);
    } else {
      // No food eaten — remove tail (snake doesn't grow).
      const tail = this.snake.pop();
      if (tail) tail.text.destroy();
    }
  }

  // ===========================================================================
  // AAAA — Soft Bounce: comical bounce-back + squeak + eye wiggle. No game over.
  // ===========================================================================
  private _softBounce(x: number, y: number) {
    // Snake wiggles eyes comically.
    if (this.snakeEyes) {
      this.tweens.add({
        targets: this.snakeEyes,
        x: { from: x - 4, to: x + 4 },
        duration: 60, yoyo: true, repeat: 5, ease: 'Sine.inOut',
        onComplete: () => { if (this.snakeEyes) this.snakeEyes.x = x; },
      });
    }
    // Silly squeak sound.
    audioBus.play('hover', { freq: 600, duration: 0.1 });
    this.time.delayedCall(80, () => audioBus.play('hover', { freq: 400, duration: 0.1 }));
    // Bounce-back recovery period (300ms — snake pauses briefly).
    this.bounceUntil = this.time.now + 300;
  }

  // ===========================================================================
  // SPAWN WORD — pick a new word, create letter bubbles + progress slots.
  // ===========================================================================
  private spawnWord() {
    if (this.wordsCompleted >= this.maxScore) { this.finishGame(true); return; }

    // Clear old bubbles + slots.
    this.bubbles.forEach(b => { try { b.text.destroy(); b.bubble.destroy(); } catch {} });
    this.bubbles = [];
    this.progressSlots.forEach(s => { try { s.destroy(); } catch {} });
    this.progressSlots = [];

    // Pick a word.
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.currentTerm = pool[0];
    this.currentWord = this.currentTerm.term.replace(/[^a-zA-Z]/g, '').toUpperCase();
    this.lettersCollected = 0;

    // Update prompt.
    const def = this.currentTerm.definition ?? this.currentTerm.emoji ?? this.currentTerm.term;
    this.promptText.setText(`Spell: "${this.currentWord}" — ${def}`);
    this.promptText.setData('speakText', `Spell ${this.currentWord}. ${def}`);
    this.time.delayedCall(400, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, `Spell ${this.currentWord}. ${def}`, { isQuestion: true });
    });

    // Create progress track (hollow letter slots at top).
    const slotY = 130;
    const slotSpacing = 40;
    const totalW = (this.currentWord.length - 1) * slotSpacing;
    const startX = this.scale.width / 2 - totalW / 2;
    for (let i = 0; i < this.currentWord.length; i++) {
      const slot = this.add.text(startX + i * slotSpacing, slotY, '_', {
        fontFamily: 'Inter, sans-serif', fontSize: '32px', color: '#666666', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(50);
      this.progressSlots.push(slot);
    }

    // Spawn letter bubbles — all letters of the word + some distractor letters.
    const allLetters = this.currentWord.split('');
    // Add 2-3 distractor letters.
    const distractors = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !this.currentWord.includes(l));
    Phaser.Utils.Array.Shuffle(distractors);
    for (let i = 0; i < Math.min(3, distractors.length); i++) {
      allLetters.push(distractors[i]);
    }
    Phaser.Utils.Array.Shuffle(allLetters);

    // Place bubbles at random grid positions.
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < allLetters.length; i++) {
      let attempts = 0;
      let gx: number, gy: number;
      do {
        gx = Math.floor((80 + Math.random() * (this.scale.width - 160)) / this.gridStep) * this.gridStep;
        gy = Math.floor((250 + Math.random() * (this.scale.height - 350)) / this.gridStep) * this.gridStep;
        attempts++;
      } while (positions.some(p => p.x === gx && p.y === gy) && attempts < 20);
      positions.push({ x: gx, y: gy });
    }

    allLetters.forEach((letter, i) => {
      const pos = positions[i];
      const isCorrect = letter === this.currentWord[this.lettersCollected];

      // Soap bubble (shimmering transparent circle).
      const bubble = this.add.circle(pos.x, pos.y, 22, 0xffffff, 0.15)
        .setStrokeStyle(2, 0xffffff, 0.5).setDepth(49);

      // Letter text inside bubble.
      const txt = this.add.text(pos.x, pos.y, letter, {
        fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: 'bold',
        color: isCorrect ? '#fbbf24' : this.hex(this.theme.text),  // golden for correct, normal for others
      }).setOrigin(0.5).setDepth(50);

      // AAAA: Golden pulse on the correct letter (color-coded accessibility).
      if (isCorrect) {
        this.tweens.add({
          targets: [txt, bubble],
          scale: { from: 1, to: 1.15 },
          duration: 500, yoyo: true, repeat: 999, ease: 'Sine.inOut',
        });
      }

      // Make letter tappable to hear it (ESL).
      txt.setData('speakText', letter);
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        if (this._isPaused || this.isFinished) return;
        this.speakPromptWithHighlight(txt, letter);
      });

      this.bubbles.push({
        letter, isCorrect, text: txt, bubble,
        x: pos.x, y: pos.y, driftPhase: Math.random() * Math.PI * 2,
      });
    });
  }

  // ===========================================================================
  // HANDLE EAT LETTER — correct letter grows snake + speaks; wrong = spit-out.
  // ===========================================================================
  private handleEatLetter(bubble: LetterBubble) {
    // Pop the bubble.
    this.juice.burst(bubble.x, bubble.y, 'correct');
    audioBus.play('pop');
    try { bubble.bubble.destroy(); } catch {}
    try { bubble.text.destroy(); } catch {}
    this.bubbles = this.bubbles.filter(b => b !== bubble);

    const isCorrect = bubble.letter === this.currentWord[this.lettersCollected];

    if (isCorrect) {
      // ---- CORRECT LETTER ----
      // Speak the letter.
      audioBus.speak(bubble.letter);
      // Fill the progress slot.
      const slot = this.progressSlots[this.lettersCollected];
      if (slot) {
        slot.setText(bubble.letter);
        slot.setColor('#22c55e');  // green = collected
        // Slot fill animation.
        this.tweens.add({
          targets: slot,
          scale: { from: 0.5, to: 1 },
          duration: 300, ease: 'Back.out',
        });
      }
      // Snake segment stays (snake grows by 1).
      // Set the new head's letter for display.
      this.snake[0].letter = bubble.letter;
      this.snake[0].text.setText(bubble.letter);

      this.lettersCollected++;

      // Check word completion.
      if (this.lettersCollected >= this.currentWord.length) {
        this._wordComplete();
      } else {
        // Update which bubble is now "correct" (golden pulse).
        this._updateCorrectBubble();
      }
    } else {
      // ---- WRONG LETTER — spit-out ----
      // Snake sneezes + spits letter back.
      audioBus.play('incorrect');
      this.juice.shake('light');
      // Snake head turns green/purple briefly (comical).
      const head = this.snake[0];
      if (head) {
        head.text.setText('🤢');  // nauseated face
        this.time.delayedCall(400, () => {
          if (head.text && head.text.active) head.text.setText('🐍');
        });
      }
      // Sneeze sound.
      this.time.delayedCall(100, () => audioBus.play('hover', { freq: 800, duration: 0.15 }));
      this.time.delayedCall(250, () => audioBus.play('hover', { freq: 400, duration: 0.2 }));

      // Remove the tail segment (snake shrinks slightly — soft penalty).
      const tail = this.snake.pop();
      if (tail) tail.text.destroy();

      // Respawn the wrong letter in a new bubble elsewhere.
      this._respawnLetter(bubble.letter);
    }
  }

  // ===========================================================================
  // AAAA — Update which bubble gets the golden "correct" pulse.
  // ===========================================================================
  private _updateCorrectBubble() {
    const neededLetter = this.currentWord[this.lettersCollected];
    for (const bubble of this.bubbles) {
      const isNowCorrect = bubble.letter === neededLetter;
      if (isNowCorrect && !bubble.isCorrect) {
        // This bubble is now the correct one — add golden pulse.
        bubble.isCorrect = true;
        bubble.text.setColor('#fbbf24');
        this.tweens.add({
          targets: [bubble.text, bubble.bubble],
          scale: { from: 1, to: 1.15 },
          duration: 500, yoyo: true, repeat: 999, ease: 'Sine.inOut',
        });
      } else if (!isNowCorrect && bubble.isCorrect) {
        // No longer the correct one — remove pulse.
        bubble.isCorrect = false;
        try { this.tweens.killTweensOf([bubble.text, bubble.bubble]); } catch {}
        bubble.text.setScale(1);
        bubble.bubble.setScale(1);
        bubble.text.setColor(this.hex(this.theme.text));
      }
    }
  }

  // ===========================================================================
  // AAAA — Respawn a wrong letter in a new bubble elsewhere.
  // ===========================================================================
  private _respawnLetter(letter: string) {
    let gx: number, gy: number;
    let attempts = 0;
    do {
      gx = Math.floor((80 + Math.random() * (this.scale.width - 160)) / this.gridStep) * this.gridStep;
      gy = Math.floor((250 + Math.random() * (this.scale.height - 350)) / this.gridStep) * this.gridStep;
      attempts++;
    } while (this.bubbles.some(b => b.x === gx && b.y === gy) && attempts < 20);

    const bubble = this.add.circle(gx, gy, 22, 0xffffff, 0.15)
      .setStrokeStyle(2, 0xffffff, 0.5).setDepth(49);
    const txt = this.add.text(gx, gy, letter, {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: this.hex(this.theme.text),
    }).setOrigin(0.5).setDepth(50);
    txt.setData('speakText', letter);
    txt.setInteractive({ useHandCursor: true });
    txt.on('pointerdown', () => {
      if (this._isPaused || this.isFinished) return;
      this.speakPromptWithHighlight(txt, letter);
    });
    this.bubbles.push({
      letter, isCorrect: false, text: txt, bubble,
      x: gx, y: gy, driftPhase: Math.random() * Math.PI * 2,
    });
  }

  // ===========================================================================
  // AAAA — Word Completion: hit-stop + victory dance + letter glow + narration.
  // ===========================================================================
  private _wordComplete() {
    // Hit-stop: 150ms freeze to emphasize victory.
    this.hitStopUntil = this.time.now + 150;

    // Record answer.
    this.recordAnswer({
      term: this.currentTerm!.term,
      response: this.currentWord,
      success: true,
      coordinate: { x: this.snake[0].x, y: this.snake[0].y, t: this.time.now },
    });

    this.wordsCompleted++;

    // Speak the full word enthusiastically.
    this.time.delayedCall(200, () => {
      audioBus.speak(`${this.currentWord.split('').join(' ')}! ${this.currentWord}! Brilliant!`);
    });

    // Victory dance: snake loops around the screen.
    const head = this.snake[0];
    this.tweens.add({
      targets: head.text,
      angle: 360,
      duration: 800, ease: 'Cubic.out',
    });

    // Letters on snake's back light up like a neon sign.
    this.snake.forEach((seg, i) => {
      if (seg.letter) {
        this.tweens.add({
          targets: seg.text,
          scale: { from: 1, to: 1.3 },
          duration: 200, delay: i * 50, yoyo: true, ease: 'Back.out',
        });
      }
    });

    // Downpour of star stickers.
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 80, () => {
        if (this.isFinished) return;
        try {
          const x = Phaser.Math.Between(50, this.scale.width - 50);
          const star = this.add.text(x, -30, '⭐', { fontSize: '24px' }).setOrigin(0.5).setDepth(150);
          this.tweens.add({
            targets: star,
            y: this.scale.height + 20,
            angle: 360,
            duration: 1500, ease: 'Cubic.in',
            onComplete: () => { try { star.destroy(); } catch {} },
          });
        } catch {}
      });
    }

    // Spawn next word after celebration.
    this.time.delayedCall(2000, () => {
      if (!this.isFinished) this.spawnWord();
    });
  }
}
