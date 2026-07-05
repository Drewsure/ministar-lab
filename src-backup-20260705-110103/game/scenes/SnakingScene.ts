import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// WORD SNAKE — Eat correct words, avoid wrong words + walls. Speed ramps per level.

interface SnakeSeg { x: number; y: number; text: Phaser.GameObjects.Text; }
interface FoodItem { term: TermItem; isCorrect: boolean; text: Phaser.GameObjects.Text; x: number; y: number; }

export default class SnakingScene extends BaseEngine {
  private snake: SnakeSeg[] = [];
  private foods: FoodItem[] = [];
  private direction = { x: 1, y: 0 };
  private nextDirection = { x: 1, y: 0 };
  private gridStep = 30;
  private moveTimer = 0;
  private moveInterval = 250;
  private currentPrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private lengthText!: Phaser.GameObjects.Text;
  private isMoving = false;
  private startHint?: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 105, 'Word Snake', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.promptBg = this.add.rectangle(this.scale.width / 2, 150, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 150, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);
    this.lengthText = this.add.text(20, 190, 'Length: 3', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);

    this.startHint = this.add.text(this.scale.width / 2, this.scale.height / 2 + 80, 'Tap arrow keys or swipe to start!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning),
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: this.startHint, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

    const startX = 120;
    const startY = Math.floor(this.scale.height / 2 / this.gridStep) * this.gridStep;
    for (let i = 0; i < 3; i++) {
      this.snake.push({ x: startX - i * this.gridStep, y: startY,
        text: this.add.text(startX - i * this.gridStep, startY, i === 0 ? '🐶' : '🟪', { fontSize: '24px' }).setOrigin(0.5).setDepth(100) });
    }
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
    this.spawnFood();
    this.isMoving = false;
  }

  protected onTick(_remainingMs: number) {
    if (!this.isMoving || this.isFinished) return;
    this.moveTimer += 16;
    if (this.moveTimer >= this.moveInterval) { this.moveTimer = 0; this.moveSnake(); }
  }

  private changeDirection(x: number, y: number) {
    if (this.direction.x === -x && this.direction.y === -y && this.isMoving) return;
    this.nextDirection = { x, y };
    if (!this.isMoving) { this.isMoving = true; if (this.startHint) { this.startHint.destroy(); this.startHint = undefined; } }
    audioBus.play('tap');
  }

  private moveSnake() {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const newX = head.x + this.direction.x * this.gridStep;
    const newY = head.y + this.direction.y * this.gridStep;
    if (newX < 20 || newX > this.scale.width - 20 || newY < 220 || newY > this.scale.height - 20) { this.finishGame(false); return; }
    for (let i = 1; i < this.snake.length; i++) { if (this.snake[i].x === newX && this.snake[i].y === newY) { this.finishGame(false); return; } }

    let ateFood: FoodItem | null = null;
    for (const food of this.foods) { if (Phaser.Math.Distance.Between(newX, newY, food.x, food.y) < 25) { ateFood = food; break; } }

    const newHead: SnakeSeg = { x: newX, y: newY, text: this.add.text(newX, newY, '🐶', { fontSize: '24px' }).setOrigin(0.5).setDepth(100) };
    this.snake.unshift(newHead);
    if (this.snake[1]) this.snake[1].text.setText('🟪');
    if (ateFood) this.handleEat(ateFood);
    else { const tail = this.snake.pop(); if (tail) tail.text.destroy(); }
    this.lengthText.setText(`Length: ${this.snake.length}`);
  }

  private spawnFood() {
    if (this.score >= this.maxScore) { this.finishGame(true); return; }
    this.foods.forEach(f => f.text.destroy()); this.foods = [];
    const pool = [...this.terms]; Phaser.Utils.Array.Shuffle(pool);
    this.currentPrompt = pool[0];
    const def = this.currentPrompt.definition ?? this.currentPrompt.emoji ?? this.currentPrompt.term;
    this.promptText.setText(`Eat the word for: "${def}"`);
    this.promptText.setData('speakText', `Eat the word for: ${def}`);
    this.promptBg.setData('speakText', `Eat the word for: ${def}`);
    pool.slice(0, 4).forEach(term => {
      const gx = Math.floor((80 + Math.random() * (this.scale.width - 160)) / this.gridStep) * this.gridStep;
      const gy = Math.floor((250 + Math.random() * (this.scale.height - 350)) / this.gridStep) * this.gridStep;
      const txt = this.add.text(gx, gy, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'), padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setDepth(50);
      txt.setData('speakText', term.term);
      this.foods.push({ term, isCorrect: term.id === this.currentPrompt!.id, text: txt, x: gx, y: gy });
    });
  }

  private handleEat(food: FoodItem) {
    food.text.destroy(); this.foods = this.foods.filter(f => f !== food);
    this.recordAnswer({ term: this.currentPrompt!.term, response: food.term.term, success: food.isCorrect,
      coordinate: { x: food.x, y: food.y, t: this.time.now } });
    if (food.isCorrect) {
      audioBus.play('correct'); this.juice.burst(food.x, food.y, 'correct');
      this.moveInterval = Math.max(100, this.moveInterval - 5);
      this.time.delayedCall(300, () => { if (!this.isFinished) this.spawnFood(); });
    } else {
      audioBus.play('incorrect'); this.juice.shake('medium');
      for (let i = 0; i < 2 && this.snake.length > 3; i++) { const tail = this.snake.pop(); if (tail) tail.text.destroy(); }
    }
  }
}
