import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// ANAGRAM — Text/Spelling Engine  (AAA 2029 edition)
// ============================================================================
// Premium letter unscramble with:
//   • Glossy 3D-looking letter tiles with shine + shadow
//   • Tiles glow when placed in answer row
//   • Smooth slide animation between pool and answer
//   • Hint button (reveals first letter in place)
//   • Word definition shown as clue (with TTS)
//   • Correct: tiles spin + celebrate + speak the word
//   • Wrong: red flash + shake + tiles return to pool
//   • Letter count display (e.g. "5 letters")
//   • Streak fire effect
// ============================================================================

interface Tile {
  letter: string;
  originalIndex: number;
  sprite: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
  placed: boolean;
}

export default class AnagramScene extends BaseEngine {
  private round = 0;
  private rounds: TermItem[] = [];
  private pool: Tile[] = [];
  private answer: Tile[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private canInteract = true;
  private activeTiles: Phaser.GameObjects.Container[] = [];
  private solvedRounds = 0;
  private hintUsed = false;
  private hintBtn!: Phaser.GameObjects.Container;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    // ---- Prompt banner ----
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 90, 600, 60, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 90, 'Unscramble the word',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 560 },
      }
    ).setOrigin(0.5).setDepth(49);

    // ---- Answer slots indicator (dashed line) ----
    this.add.text(
      this.scale.width / 2, 180, 'Your Answer',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(40);

    // ---- Hint button ----
    const hintBg = this.add.rectangle(0, 0, 120, 36, this.theme.warning, 0.6)
      .setStrokeStyle(2, this.theme.warning, 0.8);
    const hintTxt = this.add.text(0, 0, '💡 Hint', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hintBtn = this.add.container(this.scale.width - 80, 540, [hintBg, hintTxt])
      .setSize(120, 36).setInteractive({ useHandCursor: true }).setDepth(50);
    this.hintBtn.on('pointerover', () => hintBg.setFillStyle(this.theme.warning, 0.9));
    this.hintBtn.on('pointerout', () => hintBg.setFillStyle(this.theme.warning, 0.6));
    this.hintBtn.on('pointerdown', () => this.useHint());

    this.rounds = this.pickTerms(this.maxScore);
    this.renderRound();

    // Global pointer handler for reliable tile clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canInteract) return;
      // Hit-test hint button
      if (this.hintBtn && !this.hintUsed) {
        if (Math.abs(x - this.hintBtn.x) < 50 && Math.abs(y - this.hintBtn.y) < 18) {
          this.useHint();
          return;
        }
      }
      // Hit-test pool tiles
      for (const tile of this.pool) {
        if (this.answer.includes(tile)) continue;
        if (Math.abs(x - tile.sprite.x) < 27 && Math.abs(y - tile.sprite.y) < 27) {
          // ESL: speak the letter when tapped
          audioBus.speak(tile.letter);
          this.tapTile(tile.letter, tile.originalIndex);
          break;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.solvedRounds >= this.maxScore * 0.6);
      return;
    }
    const term = this.rounds[this.round];
    const word = term.term.toUpperCase().replace(/[^A-Z]/g, '');
    if (word.length === 0) {
      this.round++;
      this.renderRound();
      return;
    }

    // Destroy previous tiles
    this.activeTiles.forEach(t => t.destroy());
    this.activeTiles = [];
    this.pool = [];
    this.answer = [];
    this.hintUsed = false;
    this.hintBtn.setAlpha(1).setInteractive({ useHandCursor: true });

    // Shuffle letters
    const letters = word.split('');
    const shuffled = [...letters];
    let attempts = 0;
    do {
      Phaser.Utils.Array.Shuffle(shuffled);
      attempts++;
    } while (shuffled.join('') === word && word.length > 1 && attempts < 20);

    const tileSize = 54;
    const gap = 8;
    const totalW = word.length * tileSize + (word.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + tileSize / 2;
    const poolY = 380;

    shuffled.forEach((letter, i) => {
      const x = startX + i * (tileSize + gap);
      const tile = this.makeTile(letter, i, x, poolY);
      this.pool.push(tile);
      this.activeTiles.push(tile.sprite);
    });

    // Definition hint
    const hint = term.definition ? `${term.emoji ?? ''} ${term.definition}`.trim() : `${term.emoji ?? 'Unscramble the word'}`;
    this.promptText.setText(`${hint}  (${word.length} letters)`);


  }

  private makeTile(letter: string, originalIndex: number, x: number, y: number): Tile {
    const size = 54;
    // Glow ring behind tile (visible when placed)
    const glow = this.add.circle(0, 0, size * 0.7, this.theme.success, 0).setDepth(13);

    // Tile shadow
    const shadow = this.add.rectangle(3, 3, size, size, 0x000000, 0.3).setDepth(14);

    // Tile background (glossy)
    const bg = this.add.rectangle(0, 0, size, size, this.theme.card, 0.95)
      .setStrokeStyle(2, this.theme.accent, 0.7).setDepth(15);
    // Shine highlight (top-left)
    const shine = this.add.rectangle(-size / 4, -size / 4, size / 2, size / 3, 0xffffff, 0.15).setDepth(16);

    // Letter text
    const txt = this.add.text(0, 0, letter, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '30px',
      color: this.hex(this.theme.text),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(17);

    const container = this.add.container(x, y, [glow, shadow, bg, shine, txt])
      .setSize(size, size).setInteractive({ useHandCursor: true }).setDepth(15);
    container.setScale(0).setAlpha(0);

    // Entrance animation
    this.tweens.add({
      targets: container, scale: 1, alpha: 1,
      duration: 300, delay: originalIndex * 60, ease: 'Back.out',
    });

    // Hover effect
    container.on('pointerover', () => {
      if (!this.canInteract) return;
      bg.setFillStyle(this.theme.cardAlt, 1);
      this.tweens.add({ targets: container, scale: 1.1, duration: 100, ease: 'Quad.out' });
      audioBus.play('hover');
    });
    container.on('pointerout', () => {
      bg.setFillStyle(this.theme.card, 0.95);
      this.tweens.add({ targets: container, scale: 1, duration: 100, ease: 'Quad.out' });
    });
    // NOTE: Do NOT add per-container pointerdown listener.
    // The global pointer handler in setupGlobalPointer handles all taps.
    // Adding per-container listeners causes DOUBLE FIRING (global + container)
    // which places the same letter twice → "appll" instead of "apple".
    //   // REMOVED

    return { letter, originalIndex, sprite: container, bg, glow, placed: false };
  }

  private tapTile(letter: string, _originalIndex: number) {
    if (!this.canInteract) return;
    audioBus.play('tap');

    const idx = this.pool.findIndex(t => t.letter === letter && !this.answer.includes(t));
    if (idx < 0) return;
    const tile = this.pool[idx];
    tile.placed = true;
    this.answer.push(tile);

    // Move tile to answer row with glow
    const tileSize = 54, gap = 8;
    const answerY = 240;
    const totalW = this.answer.length * tileSize + (this.answer.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + tileSize / 2;

    this.answer.forEach((t, i) => {
      this.tweens.add({
        targets: t.sprite,
        x: startX + i * (tileSize + gap),
        y: answerY,
        duration: 250, ease: 'Back.out',
      });
      // Glow when placed
      this.tweens.add({
        targets: t.glow,
        alpha: 0.4,
        duration: 200, ease: 'Cubic.out',
      });
    });

    // Check answer when complete
    const target = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
    if (this.answer.length === target.length) {
      this.canInteract = false;
      this.time.delayedCall(400, this.checkAnswer, [], this);
    }
  }

  private useHint() {
    if (this.hintUsed || !this.canInteract) return;
    this.hintUsed = true;
    this.hintBtn.setAlpha(0.3).disableInteractive();
    this.streak = 0;

    const target = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
    const firstLetter = target[0];
    audioBus.speak(`Starts with ${firstLetter}`);

    // Auto-place the first correct letter
    const tile = this.pool.find(t => t.letter === firstLetter && !this.answer.includes(t));
    if (tile) {
      this.tapTile(firstLetter, tile.originalIndex);
    }
  }

  private checkAnswer() {
    const target = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
    const guess = this.answer.map(t => t.letter).join('');
    const isCorrect = guess === target;

    this.recordAnswer({
      term: this.rounds[this.round].term,
      response: guess,
      success: isCorrect,
      coordinate: { x: this.scale.width / 2, y: 240, t: this.time.now },
    });

    if (isCorrect) {
      this.solvedRounds++;
  

      // Celebrate: tiles spin + glow + particles
      this.answer.forEach((t, i) => {
        this.tweens.add({
          targets: t.sprite,
          scale: 1.4, angle: 360,
          duration: 500, delay: i * 60, ease: 'Back.out',
        });
        this.tweens.add({
          targets: t.glow,
          alpha: 0.8,
          duration: 300, delay: i * 60,
        });
      });
      this.juice.burst(this.scale.width / 2, 240, 'correct');
      this.juice.confettiRain(1000);

      this.time.delayedCall(800, () => {
        this.round++;
        this.renderRound();
        this.canInteract = true;
      });
      this.checkWin();
    } else {
      // Wrong: red flash + shake + return tiles
      this.juice.flash(this.theme.danger, 0.2, 150);
      this.tweens.add({
        targets: this.answer.map(t => t.sprite),
        x: '+=10', duration: 60, yoyo: true, repeat: 3,
        onComplete: () => {
          // Return tiles to pool positions
          const tileSize = 54, gap = 8;
          const totalW = target.length * tileSize + (target.length - 1) * gap;
          const startX = (this.scale.width - totalW) / 2 + tileSize / 2;
          const poolY = 380;
          this.pool.forEach((t, i) => {
            t.placed = false;
            this.tweens.add({
              targets: t.sprite,
              x: startX + i * (tileSize + gap),
              y: poolY,
              duration: 250, ease: 'Back.out',
            });
            this.tweens.add({
              targets: t.glow,
              alpha: 0,
              duration: 200,
            });
          });
          this.answer = [];
          this.canInteract = true;
        },
      });
    }
  }
}
