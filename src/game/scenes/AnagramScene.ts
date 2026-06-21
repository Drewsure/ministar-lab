import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// ANAGRAM — Text/Spelling Engine
// Unscramble letters to spell each vocabulary word.
// Letter-tile drag-or-tap mechanic with auto-validation.
// ============================================================================

interface Tile {
  letter: string;
  originalIndex: number;
  sprite: Phaser.GameObjects.Container;
}

export default class AnagramScene extends BaseEngine {
  private round = 0;
  private rounds: TermItem[] = [];
  private pool: Tile[] = [];
  private answer: Tile[] = [];
  private poolText!: Phaser.GameObjects.Text;
  private answerText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private canInteract = true;
  private activeTiles: Phaser.GameObjects.Container[] = [];
  private solvedRounds = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    this.promptText = this.add.text(
      this.scale.width / 2, 60,
      'Unscramble the word',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.rounds = this.pickTerms(this.maxScore);

    this.poolText = this.add.text(20, 540, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setDepth(50);

    this.answerText = this.add.text(20, 565, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setDepth(50);

    this.renderRound();
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
      // Skip
      this.round++;
      this.renderRound();
      return;
    }

    // ---- Destroy all tiles from the previous round (fix: tile leak) ----
    this.activeTiles.forEach(t => t.destroy());
    this.activeTiles = [];
    this.pool = [];
    this.answer = [];

    // ---- Build pool with shuffled letters (fix: cap shuffle attempts to prevent infinite loop) ----
    const letters = word.split('');
    const shuffled = [...letters];
    let attempts = 0;
    const maxAttempts = 20;
    do {
      Phaser.Utils.Array.Shuffle(shuffled);
      attempts++;
    } while (shuffled.join('') === word && word.length > 1 && attempts < maxAttempts);

    const tileSize = 56;
    const gap = 8;
    const totalW = word.length * tileSize + (word.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + tileSize / 2;
    const poolY = 360;

    shuffled.forEach((letter, i) => {
      const x = startX + i * (tileSize + gap);
      const tile = this.makeTile(letter, i, x, poolY);
      this.pool.push(tile);
      this.activeTiles.push(tile.sprite);
    });

    // Definition hint
    if (term.definition || term.emoji) {
      this.promptText.setText(`Hint: ${term.emoji ?? ''} ${term.definition ?? ''}`.trim());
    } else {
      this.promptText.setText('Unscramble the word');
    }
    this.updateAnswerDisplay();
  }

  private makeTile(letter: string, originalIndex: number, x: number, y: number): Tile {
    const size = 56;
    const bg = this.add.rectangle(0, 0, size, size, this.theme.card, 0.95)
      .setStrokeStyle(2, this.theme.accent, 0.7);
    const txt = this.add.text(0, 0, letter, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '32px',
      color: this.hex(this.theme.text),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]).setSize(size, size).setInteractive({ useHandCursor: true });
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container, scale: 1, alpha: 1,
      duration: 250, delay: originalIndex * 50, ease: 'Back.out',
    });

    container.on('pointerover', () => {
      bg.setFillStyle(this.theme.cardAlt, 1);
      audioBus.play('hover');
    });
    container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.95));
    container.on('pointerdown', () => this.tapTile(letter, originalIndex));

    return { letter, originalIndex, sprite: container };
  }

  private tapTile(letter: string, _originalIndex: number) {
    if (!this.canInteract) return;
    audioBus.play('tap');

    // Find first tile in pool that matches
    const idx = this.pool.findIndex(t => t.letter === letter && !this.answer.includes(t));
    if (idx < 0) return;
    const tile = this.pool[idx];
    this.answer.push(tile);

    // Move tile up to answer row
    const tileSize = 56, gap = 8;
    const answerY = 220;
    const totalW = this.answer.length * tileSize + (this.answer.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + tileSize / 2;
    this.answer.forEach((t, i) => {
      this.tweens.add({
        targets: t.sprite,
        x: startX + i * (tileSize + gap),
        y: answerY,
        duration: 200, ease: 'Back.out',
      });
    });
    this.updateAnswerDisplay();

    // Check answer when length matches target
    const target = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
    if (this.answer.length === target.length) {
      this.canInteract = false;
      this.time.delayedCall(300, this.checkAnswer, [], this);
    }
  }

  private updateAnswerDisplay() {
    const target = this.rounds[this.round]?.term.toUpperCase().replace(/[^A-Z]/g, '') ?? '';
    this.answerText.setText(`Answer: ${this.answer.map(t => t.letter).join('')}  /  ${target}`);
  }

  private checkAnswer() {
    const target = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
    const guess = this.answer.map(t => t.letter).join('');
    const isCorrect = guess === target;

    this.recordAnswer({
      term: this.rounds[this.round].term,
      response: guess,
      success: isCorrect,
      coordinate: { x: this.scale.width / 2, y: 220, t: this.time.now },
    });

    if (isCorrect) {
      this.solvedRounds++;
      // ESL: speak the correctly-spelled word
      this.speakPrompt(this.rounds[this.round].term, this.rounds[this.round].definition);
      // Celebrate tiles
      this.answer.forEach((t, i) => {
        this.tweens.add({
          targets: t.sprite,
          scale: 1.3, angle: 360,
          duration: 400, delay: i * 50, ease: 'Back.out',
        });
      });
      this.time.delayedCall(700, () => {
        this.round++;
        this.renderRound();
        this.canInteract = true;
      });
      this.checkWin();
    } else {
      // Shake and reset
      this.tweens.add({
        targets: this.answer.map(t => t.sprite),
        x: '+=8', duration: 60, yoyo: true, repeat: 3,
        onComplete: () => {
          // Return tiles to pool
          const tileSize = 56, gap = 8;
          const target2 = this.rounds[this.round].term.toUpperCase().replace(/[^A-Z]/g, '');
          const totalW = target2.length * tileSize + (target2.length - 1) * gap;
          const startX = (this.scale.width - totalW) / 2 + tileSize / 2;
          const poolY = 360;
          this.pool.forEach((t, i) => {
            this.tweens.add({
              targets: t.sprite,
              x: startX + i * (tileSize + gap),
              y: poolY,
              duration: 200, ease: 'Back.out',
            });
          });
          this.answer = [];
          this.updateAnswerDisplay();
          this.canInteract = true;
        },
      });
    }
  }
}
