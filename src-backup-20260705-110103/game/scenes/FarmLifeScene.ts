import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// FARM LIFE — Phaser farming game (Stardew Valley inspired)
// Plant, water, sun, harvest crops on a 4x4 grid. Each action teaches vocabulary.
// Crops grow in real-time. Sell at market for coins. 3-minute reward game.

interface FarmCell {
  container: Phaser.GameObjects.Container;
  state: 'empty' | 'seeded' | 'watered' | 'sunny' | 'growing' | 'ready';
  cropIdx: number;
  growth: number;
  emoji: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
}

const CROPS = [
  { name: 'Carrot', emoji: '🥕', growTime: 5, price: 10, vocab: 'harvest' },
  { name: 'Tomato', emoji: '🍅', growTime: 7, price: 15, vocab: 'fruit' },
  { name: 'Sunflower', emoji: '🌻', growTime: 9, price: 20, vocab: 'flower' },
  { name: 'Corn', emoji: '🌽', growTime: 6, price: 12, vocab: 'grow' },
  { name: 'Pumpkin', emoji: '🎃', growTime: 10, price: 25, vocab: 'season' },
];

const TOOLS = ['🌱', '💧', '☀️', '🧺', '🏪'];

export default class FarmLifeScene extends BaseEngine {
  private grid: FarmCell[][] = [];
  private gridSize = 4;
  private selectedTool = 0;
  private toolButtons: Phaser.GameObjects.Container[] = [];
  private coins = 0;
  private coinsText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private timeLeft = 180;
  private timerText!: Phaser.GameObjects.Text;
  private growthTimer?: Phaser.Time.TimerEvent;
  private countdownTimer?: Phaser.Time.TimerEvent;
  private vocabLearned = new Set<string>();
  private harvested = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 55, '🌾 Farm Life', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 90, 600, 40, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 90, 'Select a tool, then tap a plot!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Coins + timer
    this.coinsText = this.add.text(20, 115, '💰 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.timerText = this.add.text(this.scale.width - 20, 115, '⏱ 3:00', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    this._buildGrid();
    this._buildTools();

    // Growth timer — advance crop growth every 2 seconds
    this.growthTimer = this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => this._advanceGrowth(),
    });

    // Countdown timer
    this.countdownTimer = this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (this.isFinished) return;
        this.timeLeft--;
        const m = Math.floor(this.timeLeft / 60);
        const s = (this.timeLeft % 60).toString().padStart(2, '0');
        this.timerText.setText(`⏱ ${m}:${s}`);
        if (this.timeLeft <= 30) this.timerText.setColor(this.hex(this.theme.danger));
        if (this.timeLeft <= 0) this._finishFarm();
      },
    });

    this.setupGlobalPointer((x, y) => {
      // Check tool buttons
      for (let i = 0; i < this.toolButtons.length; i++) {
        const btn = this.toolButtons[i];
        if (Math.abs(x - btn.x) < 60 && Math.abs(y - btn.y) < 30) {
          this._selectTool(i);
          return;
        }
      }
      // Check grid cells
      for (let row = 0; row < this.gridSize; row++) {
        for (let col = 0; col < this.gridSize; col++) {
          const cell = this.grid[row][col];
          if (Math.abs(x - cell.container.x) < 40 && Math.abs(y - cell.container.y) < 40) {
            this._tapCell(row, col);
            return;
          }
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildGrid() {
    const cellSize = 70;
    const gap = 8;
    const totalW = this.gridSize * cellSize + (this.gridSize - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cellSize / 2;
    const startY = 200;

    for (let row = 0; row < this.gridSize; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.gridSize; col++) {
        const x = startX + col * (cellSize + gap);
        const y = startY + row * (cellSize + gap);
        const bg = this.add.rectangle(0, 0, cellSize, cellSize, this.theme.cardAlt, 0.6)
          .setStrokeStyle(2, this.theme.accent, 0.3);
        const emoji = this.add.text(0, 0, '🟫', { fontSize: '32px' }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, emoji]).setSize(cellSize, cellSize).setDepth(20);
        this.grid[row][col] = { container, state: 'empty', cropIdx: 0, growth: 0, emoji, bg };
      }
    }
  }

  private _buildTools() {
    const startY = 530;
    const spacing = 130;
    const totalW = TOOLS.length * spacing;
    const startX = (this.scale.width - totalW) / 2 + spacing / 2;

    TOOLS.forEach((emoji, i) => {
      const x = startX + i * spacing;
      const bg = this.add.rectangle(0, 0, 100, 50, i === this.selectedTool ? this.theme.accent : this.theme.card, 0.9)
        .setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, 0, emoji, { fontSize: '24px' }).setOrigin(0.5);
      const container = this.add.container(x, startY, [bg, txt]).setSize(100, 50).setDepth(40);
      this.toolButtons.push(container);
    });
  }

  private _selectTool(idx: number) {
    this.selectedTool = idx;
    audioBus.play('tap');
    const toolNames = ['Seed', 'Water', 'Sun', 'Harvest', 'Market'];
    const toolVocab = ['seed', 'water', 'sun', 'harvest', 'market'];
    this.promptText.setText(`Tool: ${TOOLS[idx]} ${toolNames[idx]} — tap a plot!`);
    this.makeSpeakable(this.promptText, toolNames[idx]);
    audioBus.speak(toolNames[idx]);
    this.vocabLearned.add(toolVocab[idx]);
    // Update button visuals
    this.toolButtons.forEach((btn, i) => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(i === idx ? this.theme.accent : this.theme.card, 0.9);
    });
  }

  private _tapCell(row: number, col: number) {
    const cell = this.grid[row][col];
    const tool = this.selectedTool;

    if (tool === 0) { // Plant seed
      if (cell.state === 'empty') {
        cell.state = 'seeded';
        cell.cropIdx = Math.floor(Math.random() * CROPS.length);
        cell.growth = 0;
        cell.emoji.setText('🌱');
        audioBus.play('flip');
        this.vocabLearned.add('seed');
      }
    } else if (tool === 1) { // Water
      if (cell.state === 'seeded') {
        cell.state = 'watered';
        cell.emoji.setText('🌿');
        cell.bg.setFillStyle(0x3b82f6, 0.3);
        audioBus.play('pop');
        this.vocabLearned.add('water');
      }
    } else if (tool === 2) { // Sun
      if (cell.state === 'watered') {
        cell.state = 'growing';
        cell.emoji.setText('🌾');
        cell.bg.setFillStyle(0xfbbf24, 0.2);
        audioBus.play('correct');
        this.vocabLearned.add('sun');
      }
    } else if (tool === 3) { // Harvest
      if (cell.state === 'ready') {
        const crop = CROPS[cell.cropIdx];
        this.coins += crop.price;
        this.harvested++;
        this.coinsText.setText(`💰 ${this.coins}`);
        this.vocabLearned.add(crop.vocab);
        audioBus.play('correct');
        audioBus.speak(crop.name);
        this.juice.burst(cell.container.x, cell.container.y, 'correct');
        this._recordHarvest(crop.name, crop.vocab);
        cell.state = 'empty';
        cell.emoji.setText('🟫');
        cell.bg.setFillStyle(this.theme.cardAlt, 0.6);
        cell.growth = 0;
      }
    } else if (tool === 4) { // Market (sell all ready crops)
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const c2 = this.grid[r][c];
          if (c2.state === 'ready') {
            const crop = CROPS[c2.cropIdx];
            this.coins += crop.price;
            this.harvested++;
            this.vocabLearned.add('market');
            c2.state = 'empty';
            c2.emoji.setText('🟫');
            c2.bg.setFillStyle(this.theme.cardAlt, 0.6);
            c2.growth = 0;
          }
        }
      }
      this.coinsText.setText(`💰 ${this.coins}`);
      audioBus.play('correct');
      this.vocabLearned.add('market');
      audioBus.speak('Sold at market!');
    }
  }

  private _advanceGrowth() {
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const cell = this.grid[row][col];
        if (cell.state === 'growing') {
          cell.growth++;
          const crop = CROPS[cell.cropIdx];
          if (cell.growth >= crop.growTime) {
            cell.state = 'ready';
            cell.emoji.setText(crop.emoji);
            cell.bg.setFillStyle(this.theme.success, 0.3);
            this.juice.scorePopup(cell.container.x, cell.container.y - 30, 'Ready!', this.theme.success);
            audioBus.play('correct');
          } else if (cell.growth === Math.floor(crop.growTime / 2)) {
            cell.emoji.setText('🌿');
          }
        }
      }
    }
  }

  private _recordHarvest(cropName: string, vocab: string) {
    this.recordAnswer({
      term: cropName,
      response: 'harvested',
      success: true,
      coordinate: { x: this.scale.width / 2, y: this.scale.height / 2, t: this.time.now },
    });
    this.checkWin();
  }

  private _finishFarm() {
    if (this.isFinished) return;
    if (this.growthTimer) this.growthTimer.remove();
    if (this.countdownTimer) this.countdownTimer.remove();
    this.finishGame(this.harvested >= 5);
  }
}
