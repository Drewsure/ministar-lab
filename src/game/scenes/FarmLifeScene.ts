import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// FARM LIFE — Stardew-Valley-inspired farming sim (AAA 2029 edition)
// ============================================================================
// Premium farm sim:
//   • 4x4 grid with tilled-soil plots
//   • Day / night cycle (60s = 1 day) — sun rises & sets, sky color shifts
//   • Weather system: sunny / rainy / stormy — rain auto-waters, storm damages
//   • 5 crop types with growth stages + sell prices
//   • 5 tools: Seed / Water / Sun / Harvest / Market
//   • Animal care: feed the chicken & cow for bonus coins (animated)
//   • Day-end summary modal: coins earned, crops harvested, vocab learned
//   • Vocab tracking: each tool/crop/weather state teaches a word
//   • Mobile-friendly 70px tap targets, audio cue on every action
// ============================================================================

interface FarmCell {
  container: Phaser.GameObjects.Container;
  state: 'empty' | 'seeded' | 'watered' | 'growing' | 'ready';
  cropIdx: number;
  growth: number;
  emoji: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
}

type Weather = 'sunny' | 'rainy' | 'stormy';

const CROPS = [
  { name: 'Carrot',    emoji: '🥕', growTime: 4, price: 10, vocab: 'carrot' },
  { name: 'Tomato',    emoji: '🍅', growTime: 5, price: 15, vocab: 'tomato' },
  { name: 'Sunflower', emoji: '🌻', growTime: 6, price: 20, vocab: 'flower' },
  { name: 'Corn',      emoji: '🌽', growTime: 5, price: 12, vocab: 'corn' },
  { name: 'Pumpkin',   emoji: '🎃', growTime: 7, price: 25, vocab: 'pumpkin' },
];

const TOOLS = ['🌱', '💧', '☀️', '🧺', '🏪'];
const TOOL_NAMES  = ['Seed', 'Water', 'Sun', 'Harvest', 'Market'];
const TOOL_VOCAB  = ['seed', 'water', 'sun', 'harvest', 'market'];

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
  private dayText!: Phaser.GameObjects.Text;
  private dayCount = 1;
  private dayProgress = 0; // 0..1
  private weather: Weather = 'sunny';
  private weatherText!: Phaser.GameObjects.Text;
  private skyRect!: Phaser.GameObjects.Rectangle;
  private rainParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private vocabLearned = new Set<string>();
  private harvested = 0;
  private growthTimer?: Phaser.Time.TimerEvent;
  private countdownTimer?: Phaser.Time.TimerEvent;
  private dayTimer?: Phaser.Time.TimerEvent;
  private weatherTimer?: Phaser.Time.TimerEvent;

  // Animals
  private chickenText!: Phaser.GameObjects.Text;
  private cowText!: Phaser.GameObjects.Text;
  private chickenFed = false;
  private cowFed = false;
  private animalCoinBonus = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    // Sky background (dynamic — color shifts with day/night cycle)
    this.skyRect = this.add.rectangle(this.scale.width / 2, 100, this.scale.width, 200, 0x87ceeb, 1)
      .setDepth(-20);

    // Sun/moon indicator (top-right)
    this.dayText = this.add.text(this.scale.width / 2, 30, '🌞 Day 1', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(this.scale.width / 2, 55, '🌾 Farm Life', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 85, 600, 32, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 85, 'Select a tool, then tap a plot!', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Coins + timer + weather
    this.coinsText = this.add.text(20, 110, '💰 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.timerText = this.add.text(this.scale.width - 20, 110, '⏱ 3:00', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);
    this.weatherText = this.add.text(this.scale.width / 2, 110, '☀️ Sunny', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this._buildGrid();
    this._buildAnimals();
    this._buildTools();

    // Growth tick — every 2s, advance growing crops
    this.growthTimer = this.time.addEvent({
      delay: 2000, loop: true, callback: () => this._advanceGrowth(),
    });

    // Day cycle — every 1.5s, advance dayProgress (60s = 1 full day)
    this.dayTimer = this.time.addEvent({
      delay: 1500, loop: true, callback: () => this._tickDay(),
    });

    // Weather cycle — every 25-40s, change weather
    this.weatherTimer = this.time.addEvent({
      delay: Phaser.Math.Between(25000, 40000), loop: false,
      callback: () => this._changeWeather(),
    });

    // Countdown
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
        if (Math.abs(x - btn.x) < 60 && Math.abs(y - btn.y) < 28) {
          this._selectTool(i);
          return;
        }
      }
      // Check animals
      if (this.chickenText && Math.abs(x - this.chickenText.x) < 32 && Math.abs(y - this.chickenText.y) < 32) {
        this._feedChicken(); return;
      }
      if (this.cowText && Math.abs(x - this.cowText.x) < 32 && Math.abs(y - this.cowText.y) < 32) {
        this._feedCow(); return;
      }
      // Check grid cells
      for (let row = 0; row < this.gridSize; row++) {
        for (let col = 0; col < this.gridSize; col++) {
          const cell = this.grid[row][col];
          if (Math.abs(x - cell.container.x) < 36 && Math.abs(y - cell.container.y) < 36) {
            this._tapCell(row, col);
            return;
          }
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildGrid() {
    const cellSize = 64;
    const gap = 6;
    const totalW = this.gridSize * cellSize + (this.gridSize - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + cellSize / 2;
    const startY = 175;

    for (let row = 0; row < this.gridSize; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.gridSize; col++) {
        const x = startX + col * (cellSize + gap);
        const y = startY + row * (cellSize + gap);
        const bg = this.add.rectangle(0, 0, cellSize, cellSize, 0x8b5a2b, 0.55)
          .setStrokeStyle(2, this.theme.accent, 0.25);
        const emoji = this.add.text(0, 0, '🟫', { fontSize: '30px' }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, emoji]).setSize(cellSize, cellSize).setDepth(20);
        this.grid[row][col] = { container, state: 'empty', cropIdx: 0, growth: 0, emoji, bg };
      }
    }
  }

  private _buildAnimals() {
    // Chicken (left of grid)
    this.chickenText = this.add.text(40, 250, '🐔', { fontSize: '36px' })
      .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });
    this.add.text(40, 285, 'Feed', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(30);

    // Cow (right of grid)
    this.cowText = this.add.text(this.scale.width - 40, 250, '🐄', { fontSize: '36px' })
      .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });
    this.add.text(this.scale.width - 40, 285, 'Feed', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(30);
  }

  private _buildTools() {
    const startY = 530;
    const spacing = 130;
    const totalW = TOOLS.length * spacing;
    const startX = (this.scale.width - totalW) / 2 + spacing / 2;

    TOOLS.forEach((emoji, i) => {
      const x = startX + i * spacing;
      const bg = this.add.rectangle(0, 0, 100, 44, i === this.selectedTool ? this.theme.accent : this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, 0, `${emoji} ${TOOL_NAMES[i]}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, startY, [bg, txt]).setSize(100, 44).setDepth(40);
      this.toolButtons.push(container);
    });
  }

  private _selectTool(idx: number) {
    this.selectedTool = idx;
    audioBus.play('tap');
    this.promptText.setText(`Tool: ${TOOLS[idx]} ${TOOL_NAMES[idx]} — tap a plot!`);
    this.makeSpeakable(this.promptText, TOOL_NAMES[idx]);
    // AAAA KIDS MODE — speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Tool: ${TOOL_NAMES[idx]}. Tap a plot!`);
    this.vocabLearned.add(TOOL_VOCAB[idx]);
    this.toolButtons.forEach((btn, i) => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(i === idx ? this.theme.accent : this.theme.card, 0.92);
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
        this._pulseCell(cell);
      }
    } else if (tool === 1) { // Water
      if (cell.state === 'seeded') {
        cell.state = 'watered';
        cell.emoji.setText('🌿');
        cell.bg.setFillStyle(0x3b82f6, 0.4);
        audioBus.play('pop');
        this.vocabLearned.add('water');
        this._pulseCell(cell);
      }
    } else if (tool === 2) { // Sun (only works during sunny weather)
      if (cell.state === 'watered') {
        if (this.weather === 'stormy') {
          this.promptText.setText('⛈️ Too stormy for sun!');
          audioBus.play('incorrect');
          return;
        }
        cell.state = 'growing';
        cell.emoji.setText('🌾');
        cell.bg.setFillStyle(0xfbbf24, 0.3);
        audioBus.play('correct');
        this.vocabLearned.add('sun');
        this._pulseCell(cell);
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
        this.juice.scorePopup(cell.container.x, cell.container.y - 30, `+${crop.price}💰`, this.theme.warning);
        this._recordHarvest(crop.name, crop.vocab);
        cell.state = 'empty';
        cell.emoji.setText('🟫');
        cell.bg.setFillStyle(0x8b5a2b, 0.55);
        cell.growth = 0;
      }
    } else if (tool === 4) { // Market — sell all ready crops
      let soldCount = 0;
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const c2 = this.grid[r][c];
          if (c2.state === 'ready') {
            const crop = CROPS[c2.cropIdx];
            this.coins += crop.price;
            this.harvested++;
            soldCount++;
            this.vocabLearned.add('market');
            c2.state = 'empty';
            c2.emoji.setText('🟫');
            c2.bg.setFillStyle(0x8b5a2b, 0.55);
            c2.growth = 0;
          }
        }
      }
      if (soldCount > 0) {
        this.coinsText.setText(`💰 ${this.coins}`);
        audioBus.play('correct');
        this.vocabLearned.add('market');
        audioBus.speak(`Sold ${soldCount} crops at market!`);
        this.juice.flash(this.theme.warning, 0.3, 200);
      } else {
        this.promptText.setText('No ripe crops to sell!');
        audioBus.play('incorrect');
      }
    }
  }

  private _pulseCell(cell: FarmCell) {
    this.tweens.add({
      targets: cell.container,
      scale: 1.15, duration: 100, yoyo: true, ease: 'Quad.out',
    });
  }

  private _feedChicken() {
    if (this.chickenFed) {
      this.promptText.setText('🐔 Chicken already fed today!');
      audioBus.play('incorrect');
      return;
    }
    this.chickenFed = true;
    this.coins += 5;
    this.animalCoinBonus += 5;
    this.coinsText.setText(`💰 ${this.coins}`);
    this.vocabLearned.add('chicken');
    audioBus.play('correct');
    audioBus.speak('Chicken fed! Egg collected!');
    this.juice.burst(this.chickenText.x, this.chickenText.y, 'correct');
    this.juice.scorePopup(this.chickenText.x, this.chickenText.y - 30, '+5💰 🥚', this.theme.warning);
    this.tweens.add({
      targets: this.chickenText, scale: 1.3, duration: 200, yoyo: true, ease: 'Back.out',
    });
    this._recordHarvest('Egg', 'chicken');
  }

  private _feedCow() {
    if (this.cowFed) {
      this.promptText.setText('🐄 Cow already fed today!');
      audioBus.play('incorrect');
      return;
    }
    this.cowFed = true;
    this.coins += 8;
    this.animalCoinBonus += 8;
    this.coinsText.setText(`💰 ${this.coins}`);
    this.vocabLearned.add('cow');
    audioBus.play('correct');
    audioBus.speak('Cow fed! Milk collected!');
    this.juice.burst(this.cowText.x, this.cowText.y, 'correct');
    this.juice.scorePopup(this.cowText.x, this.cowText.y - 30, '+8💰 🥛', this.theme.warning);
    this.tweens.add({
      targets: this.cowText, scale: 1.3, duration: 200, yoyo: true, ease: 'Back.out',
    });
    this._recordHarvest('Milk', 'cow');
  }

  private _advanceGrowth() {
    if (this.isFinished) return;
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const cell = this.grid[row][col];
        if (cell.state === 'growing') {
          cell.growth++;
          const crop = CROPS[cell.cropIdx];
          // Rain boosts growth
          if (this.weather === 'rainy') cell.growth += 0.5;
          if (cell.growth >= crop.growTime) {
            cell.state = 'ready';
            cell.emoji.setText(crop.emoji);
            cell.bg.setFillStyle(this.theme.success, 0.4);
            this.juice.scorePopup(cell.container.x, cell.container.y - 28, 'Ready!', this.theme.success);
            audioBus.play('correct');
          } else if (cell.growth === Math.floor(crop.growTime / 2)) {
            cell.emoji.setText('🌿');
          }
        }
      }
    }
  }

  private _tickDay() {
    if (this.isFinished) return;
    this.dayProgress += 1 / 40; // 40 ticks * 1.5s = 60s = 1 day
    if (this.dayProgress >= 1) {
      this.dayProgress = 0;
      this.dayCount++;
      // Reset animal-fed flags each day
      this.chickenFed = false;
      this.cowFed = false;
      this.dayText.setText(`🌞 Day ${this.dayCount}`);
      audioBus.speak(`Day ${this.dayCount}!`);
    }
    // Update sky color based on dayProgress (0..1)
    // 0 = dawn (orange), 0.25 = noon (blue), 0.5 = dusk (purple), 0.75 = night (dark blue)
    const t = this.dayProgress;
    let r = 0x87, g = 0xce, b = 0xeb;
    if (t < 0.25) {
      // Dawn → noon: orange → blue
      const k = t / 0.25;
      r = Math.floor(0xff * (1 - k) + 0x87 * k);
      g = Math.floor(0xa5 * (1 - k) + 0xce * k);
      b = Math.floor(0x60 * (1 - k) + 0xeb * k);
    } else if (t < 0.5) {
      // Noon → dusk: blue → purple
      const k = (t - 0.25) / 0.25;
      r = Math.floor(0x87 * (1 - k) + 0x6b * k);
      g = Math.floor(0xce * (1 - k) + 0x3b * k);
      b = Math.floor(0xeb * (1 - k) + 0x9b * k);
    } else if (t < 0.75) {
      // Dusk → night: purple → dark blue
      const k = (t - 0.5) / 0.25;
      r = Math.floor(0x6b * (1 - k) + 0x1a * k);
      g = Math.floor(0x3b * (1 - k) + 0x1a * k);
      b = Math.floor(0x9b * (1 - k) + 0x4b * k);
    } else {
      // Night → dawn: dark blue → orange
      const k = (t - 0.75) / 0.25;
      r = Math.floor(0x1a * (1 - k) + 0xff * k);
      g = Math.floor(0x1a * (1 - k) + 0xa5 * k);
      b = Math.floor(0x4b * (1 - k) + 0x60 * k);
    }
    this.skyRect.setFillStyle((r << 16) | (g << 8) | b, 1);
    // Toggle sun/moon icon
    if (t > 0.5 && t < 0.75) {
      this.dayText.setText(`🌙 Day ${this.dayCount} (night)`);
    } else if (t >= 0.75) {
      this.dayText.setText(`🌅 Day ${this.dayCount} (dawn)`);
    } else {
      this.dayText.setText(`🌞 Day ${this.dayCount}`);
    }
  }

  private _changeWeather() {
    if (this.isFinished) return;
    const roll = Math.random();
    if (roll < 0.5) this.weather = 'sunny';
    else if (roll < 0.85) this.weather = 'rainy';
    else this.weather = 'stormy';

    const icon = this.weather === 'sunny' ? '☀️' : this.weather === 'rainy' ? '🌧️' : '⛈️';
    const label = this.weather === 'sunny' ? 'Sunny' : this.weather === 'rainy' ? 'Rainy' : 'Stormy';
    this.weatherText.setText(`${icon} ${label}`);
    this.vocabLearned.add(this.weather);
    audioBus.speak(`Weather: ${label}`);

    // Rain auto-waters seeded (but not yet watered) crops
    if (this.weather === 'rainy' || this.weather === 'stormy') {
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const cell = this.grid[r][c];
          if (cell.state === 'seeded') {
            cell.state = 'watered';
            cell.emoji.setText('🌿');
            cell.bg.setFillStyle(0x3b82f6, 0.4);
          }
        }
      }
    }
    // Stormy: 25% chance to damage a random growing crop (reset it)
    if (this.weather === 'stormy') {
      const growingCells: FarmCell[] = [];
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          if (this.grid[r][c].state === 'growing') growingCells.push(this.grid[r][c]);
        }
      }
      if (growingCells.length > 0 && Math.random() < 0.25) {
        const cell = Phaser.Utils.Array.GetRandom(growingCells);
        cell.state = 'seeded';
        cell.growth = 0;
        cell.emoji.setText('🌱');
        cell.bg.setFillStyle(0x8b5a2b, 0.55);
        this.juice.shake('light');
        audioBus.play('incorrect');
      }
      this.juice.flash(this.theme.danger, 0.2, 200);
    }

    // Schedule next weather change
    this.weatherTimer = this.time.addEvent({
      delay: Phaser.Math.Between(25000, 40000), loop: false,
      callback: () => this._changeWeather(),
    });
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
    if (this.dayTimer) this.dayTimer.remove();
    if (this.weatherTimer) this.weatherTimer.remove();
    // Show day-end summary
    const summaryY = this.scale.height / 2 - 60;
    const summaryBg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2,
      this.scale.width - 80, 200, 0x000000, 0.7).setDepth(450);
    const summaryText = this.add.text(this.scale.width / 2, summaryY,
      `🌾 Day ${this.dayCount} Summary\n\n💰 Coins: ${this.coins}\n🧺 Harvested: ${this.harvested}\n📚 Vocab: ${this.vocabLearned.size} words\n🥚🥛 Animal bonus: ${this.animalCoinBonus}💰`,
      { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff',
        fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(451);
    this.tweens.add({
      targets: [summaryBg, summaryText], alpha: { from: 0, to: 1 },
      duration: 400, ease: 'Cubic.out',
    });
    audioBus.speak(`Day ${this.dayCount} complete! You earned ${this.coins} coins and learned ${this.vocabLearned.size} words!`);
    this.time.delayedCall(2000, () => this.finishGame(this.harvested >= 5));
  }
}
