import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// SNAKING GAME — Eat correct words to grow, avoid wrong words
// ============================================================================
// A definition appears at top. Word "food" items scatter on screen.
// Player controls a snake (arrow keys / swipe). Eating the correct word
// = grow + score. Eating wrong word = shrink. Hit wall = game over.
// ============================================================================

interface SnakeSegment {
  x: number;
  y: number;
  text: Phaser.GameObjects.Text;
}

interface FoodItem {
  term: TermItem;
  isCorrect: boolean;
  text: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

export default class SnakingScene extends BaseEngine {
  private snake: SnakeSegment[] = [];
  private foods: FoodItem[] = [];
  private direction = { x: 1, y: 0 };
  private nextDirection = { x: 1, y: 0 };
  private gridStep = 30;
  private moveTimer = 0;
  private moveInterval = 200; // ms between moves
  private currentPrompt?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private lengthText!: Phaser.GameObjects.Text;
  private isMoving = false;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // Title
    this.add.text(this.scale.width / 2, 105, 'Word Snake', {
      fontFamily: 'Inter, sans-serif', fontSize: '30px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt banner
    this.promptBg = this.add.rectangle(this.scale.width / 2, 150, 640, 50, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 150, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText, 'Tap to hear the definition');

    // Length display
    this.lengthText = this.add.text(20, 190, 'Length: 3', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);

    // Initialize snake (3 segments starting center)
    const startX = Math.floor(this.scale.width / 2 / this.gridStep) * this.gridStep;
    const startY = Math.floor(this.scale.height / 2 / this.gridStep) * this.gridStep;
    for (let i = 0; i < 3; i++) {
      const seg: SnakeSegment = {
        x: startX - i * this.gridStep,
        y: startY,
        text: this.add.text(startX - i * this.gridStep, startY, i === 0 ? '🐶' : '🟪', {
          fontSize: '24px',
        }).setOrigin(0.5).setDepth(100),
      };
      this.snake.push(seg);
    }

    // Keyboard controls
    this.input.keyboard?.on('keydown-LEFT', () => this.changeDirection(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeDirection(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.changeDirection(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.changeDirection(0, 1));

    // Touch controls — swipe
    let touchStart: { x: number; y: number } | null = null;
    this.setupGlobalPointer((x, y) => {
      if (!touchStart) {
        touchStart = { x, y };
      } else {
        const dx = x - touchStart.x;
        const dy = y - touchStart.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.changeDirection(dx > 0 ? 1 : -1, 0);
        } else {
          this.changeDirection(0, dy > 0 ? 1 : -1);
        }
        touchStart = null;
      }
    });

    this.spawnFood();
    this.isMoving = true;
  }

  protected onTick(_remainingMs: number) {
    if (!this.isMoving || this.isFinished) return;

    this.moveTimer += 16;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.moveSnake();
    }
  }

  private changeDirection(x: number, y: number) {
    // Prevent reversing into itself
    if (this.direction.x === -x && this.direction.y === -y) return;
    this.nextDirection = { x, y };
    audioBus.play('tap');
  }

  private moveSnake() {
    this.direction = this.nextDirection;

    // Calculate new head position
    const head = this.snake[0];
    const newX = head.x + this.direction.x * this.gridStep;
    const newY = head.y + this.direction.y * this.gridStep;

    // Check wall collision
    if (newX < 20 || newX > this.scale.width - 20 || newY < 220 || newY > this.scale.height - 20) {
      this.finishGame(false);
      return;
    }

    // Check self collision
    for (let i = 1; i < this.snake.length; i++) {
      if (this.snake[i].x === newX && this.snake[i].y === newY) {
        this.finishGame(false);
        return;
      }
    }

    // Check food collision
    let ateFood: FoodItem | null = null;
    for (const food of this.foods) {
      if (Phaser.Math.Distance.Between(newX, newY, food.x, food.y) < 25) {
        ateFood = food;
        break;
      }
    }

    // Move snake: add new head, optionally remove tail
    const newHead: SnakeSegment = {
      x: newX, y: newY,
      text: this.add.text(newX, newY, '🐶', { fontSize: '24px' }).setOrigin(0.5).setDepth(100),
    };
    this.snake.unshift(newHead);
    // Update old head to body segment
    if (this.snake[1]) this.snake[1].text.setText('🟪');

    if (ateFood) {
      // Ate food — don't remove tail (snake grows)
      this.handleEat(ateFood);
    } else {
      // Remove tail
      const tail = this.snake.pop();
      if (tail) tail.text.destroy();
    }

    this.lengthText.setText(`Length: ${this.snake.length}`);
  }

  private spawnFood() {
    if (this.score >= this.maxScore) {
      this.finishGame(true);
      return;
    }

    // Clear old food
    this.foods.forEach(f => f.text.destroy());
    this.foods = [];

    // Pick a prompt
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.currentPrompt = pool[0];
    const def = this.currentPrompt.definition ?? this.currentPrompt.emoji ?? this.currentPrompt.term;
    this.promptText.setText(`Eat the word for: "${def}"`);
    this.promptText.setData('speakText', `Eat the word for: ${def}`);
    this.promptBg.setData('speakText', `Eat the word for: ${def}`);

    // Spawn 4 food items (1 correct + 3 wrong)
    const foodTerms = pool.slice(0, 4);
    foodTerms.forEach(term => {
      const x = 80 + Math.random() * (this.scale.width - 160);
      const y = 250 + Math.random() * (this.scale.height - 350);
      // Snap to grid
      const gridX = Math.floor(x / this.gridStep) * this.gridStep;
      const gridY = Math.floor(y / this.gridStep) * this.gridStep;

      const txt = this.add.text(gridX, gridY, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
        padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setDepth(50);
      txt.setData('speakText', term.term);

      this.foods.push({
        term,
        isCorrect: term.id === this.currentPrompt!.id,
        text: txt,
        x: gridX,
        y: gridY,
      });
    });
  }

  private handleEat(food: FoodItem) {
    food.text.destroy();
    this.foods = this.foods.filter(f => f !== food);

    this.recordAnswer({
      term: this.currentPrompt!.term,
      response: food.term.term,
      success: food.isCorrect,
      coordinate: { x: food.x, y: food.y, t: this.time.now },
    });

    if (food.isCorrect) {
      audioBus.play('correct');
      this.juice.burst(food.x, food.y, 'correct');
      // Speed up slightly
      this.moveInterval = Math.max(100, this.moveInterval - 5);
      // Spawn next food
      setTimeout(() => this.spawnFood(), 300);
    } else {
      audioBus.play('incorrect');
      this.juice.shake('medium');
      // Shrink snake by 2 segments
      for (let i = 0; i < 2 && this.snake.length > 3; i++) {
        const tail = this.snake.pop();
        if (tail) tail.text.destroy();
      }
    }
  }
}
