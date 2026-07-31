import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// TREASURE HUNT — Grid-based exploration dig game (AAA 2029 edition)
// ============================================================================
// Minesweeper-meets-treasure-hunt:
//   • 5x5 grid of dig plots, 8 vocab treasures hidden inside
//   • Tap a plot to dig — costs 1 energy
//   • Hint numbers (adjacent treasure count) reveal after each dig
//   • Find a treasure = answer a vocab question to claim it
//   • Wrong answer = treasure sinks back, must be re-dug
//   • Energy meter (10 digs) — find all treasures before running out
//   • Shovel power-up every 3 correct answers (free dig)
//   • Mobile-friendly 60px tap targets, audio cue on every dig
// ============================================================================

interface Plot {
  x: number; y: number; row: number; col: number;
  hasTreasure: boolean; treasureWord?: string;
  dug: boolean; hintShown: boolean;
  bg: Phaser.GameObjects.Rectangle;
  content: Phaser.GameObjects.Text;
}

export default class TreasureHuntScene extends BaseEngine {
  private grid: Plot[][] = [];
  private readonly GRID = 5;
  private readonly CELL = 64;
  private energy = 12;
  private maxEnergy = 12;
  private treasuresFound = 0;
  private totalTreasures = 0;
  private shovelPowerups = 0;
  private energyText!: Phaser.GameObjects.Text;
  private foundText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private currentDigPlot: Plot | null = null;
  private canAct = true;

  protected maxQuestions() { return Math.min(this.terms.length, 12); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 30, '🗺️ Treasure Hunt', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Stats row
    this.energyText = this.add.text(20, 60, `⛏️ Energy: ${this.energy}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setDepth(50);
    this.foundText = this.add.text(this.scale.width / 2, 60, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(this.scale.width - 20, 60, `🪏 Shovels: ${this.shovelPowerups}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 95, 600, 32, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.5).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 95,
      'Tap a plot to dig! Find treasures and answer vocab questions to claim them.',
      { fontFamily: 'Inter, sans-serif', fontSize: '13px',
        color: this.hex(this.theme.text), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this._buildGrid();
    this._updateStats();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      // Option buttons (vocab question)
      for (let i = 0; i < this.optionButtons.length; i++) {
        const btn = this.optionButtons[i];
        if (Math.abs(x - btn.x) < 110 && Math.abs(y - btn.y) < 28) {
          this._handleVocabAnswer(i);
          return;
        }
      }
      // Grid plots
      for (let row = 0; row < this.GRID; row++) {
        for (let col = 0; col < this.GRID; col++) {
          const plot = this.grid[row][col];
          if (Math.abs(x - plot.x) < this.CELL / 2 && Math.abs(y - plot.y) < this.CELL / 2) {
            this._dig(plot);
            return;
          }
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildGrid() {
    const totalW = this.GRID * this.CELL + (this.GRID - 1) * 6;
    const startX = (this.scale.width - totalW) / 2 + this.CELL / 2;
    const startY = 160;

    // Place treasures (maxQuestions() treasures)
    const treasureCount = this.maxQuestions();
    this.totalTreasures = treasureCount;
    const positions: { r: number; c: number }[] = [];
    for (let r = 0; r < this.GRID; r++) {
      for (let c = 0; c < this.GRID; c++) positions.push({ r, c });
    }
    Phaser.Utils.Array.Shuffle(positions);
    const treasurePositions = new Set(positions.slice(0, treasureCount).map(p => `${p.r},${p.c}`));

    // Assign vocab words to treasure positions
    const terms = [...this.terms];
    Phaser.Utils.Array.Shuffle(terms);
    let termIdx = 0;

    for (let row = 0; row < this.GRID; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.GRID; col++) {
        const x = startX + col * (this.CELL + 6);
        const y = startY + row * (this.CELL + 6);
        const isTreasure = treasurePositions.has(`${row},${col}`);
        const bg = this.add.rectangle(0, 0, this.CELL, this.CELL, 0x8b5a2b, 0.7)
          .setStrokeStyle(2, this.theme.accent, 0.3);
        const content = this.add.text(0, 0, '🟫', { fontSize: '28px' }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, content])
          .setSize(this.CELL, this.CELL).setDepth(20);
        this.grid[row][col] = {
          x, y, row, col, hasTreasure: isTreasure,
          treasureWord: isTreasure ? terms[termIdx++ % terms.length].term : undefined,
          dug: false, hintShown: false, bg, content,
        };
        // Idle hover effect via the container (subtle scale)
        container.setInteractive({ useHandCursor: true });
      }
    }
  }

  private _dig(plot: Plot) {
    if (plot.dug) {
      this.promptText.setText('Already dug here! Try another plot.');
      audioBus.play('incorrect');
      return;
    }
    if (this.energy <= 0 && this.shovelPowerups <= 0) {
      this.promptText.setText('Out of energy! Game over.');
      this.finishGame(this.treasuresFound >= this.totalTreasures);
      return;
    }
    // Spend energy (prefer free shovels first)
    if (this.shovelPowerups > 0) {
      this.shovelPowerups--;
    } else {
      this.energy--;
    }
    plot.dug = true;
    audioBus.play('flip');

    // Squash animation
    this.tweens.add({
      targets: [plot.bg, plot.content],
      scale: 0.85, duration: 100, yoyo: true, ease: 'Quad.out',
    });

    if (plot.hasTreasure) {
      // Found treasure — ask vocab question
      plot.content.setText('💎');
      plot.bg.setFillStyle(this.theme.warning, 0.7);
      audioBus.play('correct');
      this.juice.burst(plot.x, plot.y, 'correct');
      this.juice.scorePopup(plot.x, plot.y - 30, '💎 Treasure!', this.theme.warning);
      this.promptText.setText('💎 Treasure found! Answer the question to claim it.');
      this.currentDigPlot = plot;
      this._showVocabQuestion(plot);
    } else {
      // Empty dig — show hint (adjacent treasure count)
      const hint = this._countAdjacentTreasures(plot.row, plot.col);
      plot.content.setText(hint === 0 ? '⬜' : String(hint));
      plot.content.setColor(hint === 0 ? '#94a3b8'
        : hint === 1 ? '#22c55e'
        : hint === 2 ? '#fbbf24' : '#ef4444');
      plot.bg.setFillStyle(0x4338ca, 0.5);
      audioBus.play('pop');
      this.promptText.setText(hint === 0
        ? 'Empty plot — no treasures nearby.'
        : `Hint: ${hint} treasure${hint > 1 ? 's' : ''} nearby!`);
    }
    this._updateStats();
  }

  private _countAdjacentTreasures(row: number, col: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r < 0 || r >= this.GRID || c < 0 || c >= this.GRID) continue;
        if (this.grid[r][c].hasTreasure && !this.grid[r][c].dug) count++;
      }
    }
    return count;
  }

  private _showVocabQuestion(plot: Plot) {
    // Clear old buttons
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];

    if (!plot.treasureWord) return;
    // Question: which word matches this definition?
    const targetTerm = this.terms.find(t => t.term === plot.treasureWord);
    if (!targetTerm) return;
    const others = this.terms.filter(t => t.id !== targetTerm.id);
    Phaser.Utils.Array.Shuffle(others);
    const options = [targetTerm, ...others.slice(0, 3)];
    Phaser.Utils.Array.Shuffle(options);

    this.promptText.setText(`💎 Which word matches: "${targetTerm.definition ?? targetTerm.term}"?`);
    // AAAA KIDS MODE — speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Which word matches: ${targetTerm.definition ?? targetTerm.term}?`, { isQuestion: true });

    const startY = 440;
    options.forEach((t, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = this.scale.width / 2 + (col === 0 ? -130 : 130);
      const y = startY + row * 50;
      const bg = this.add.rectangle(0, 0, 240, 40, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.warning, 0.5);
      const txt = this.add.text(0, 0, `${t.emoji ?? '⭐'} ${t.term}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '14px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(240, 40).setDepth(40);
      this.makeSpeakable(txt, t.term);
      this.optionButtons.push(container);
    });
  }

  private _handleVocabAnswer(idx: number) {
    if (!this.currentDigPlot || this.isFinished) return;
    this.canAct = false;
    const plot = this.currentDigPlot;
    const targetTerm = this.terms.find(t => t.term === plot.treasureWord);
    if (!targetTerm) { this.canAct = true; return; }
    const btn = this.optionButtons[idx];
    const selectedText = (btn.getAt(1) as Phaser.GameObjects.Text).text;
    const selectedWord = selectedText.replace(/^[^\s]+ /, '').trim();
    const isCorrect = selectedWord === targetTerm.term;

    this.recordAnswer({
      term: targetTerm.term, response: selectedWord, success: isCorrect,
      coordinate: { x: plot.x, y: plot.y, t: this.time.now },
    });

    if (isCorrect) {
      this.treasuresFound++;
      audioBus.play('correct');
      audioBus.speak(targetTerm.term);
      this.juice.burst(plot.x, plot.y, 'win');
      this.juice.scorePopup(plot.x, plot.y - 40, `+1 💎 ${targetTerm.term}!`, this.theme.warning);
      plot.content.setText('👑');
      plot.bg.setFillStyle(this.theme.success, 0.7);

      // Every 3 correct → bonus shovel
      if (this.treasuresFound % 3 === 0) {
        this.shovelPowerups++;
        this.juice.scorePopup(this.scale.width / 2, 200, '🪏 +1 Shovel!', this.theme.accent);
        audioBus.speak('Bonus shovel!');
      }

      // Check win
      if (this.treasuresFound >= this.totalTreasures) {
        this.time.delayedCall(1200, () => this.finishGame(true));
        return;
      }
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
      this.juice.burst(plot.x, plot.y, 'incorrect');
      // Treasure sinks back
      plot.content.setText('🟫');
      plot.bg.setFillStyle(0x8b5a2b, 0.7);
      plot.dug = false; // can be re-dug
      plot.hasTreasure = true; // still there
      this.promptText.setText(`❌ Wrong! It was "${targetTerm.term}". The treasure sank back.`);
    }

    this._updateStats();
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];
    this.currentDigPlot = null;

    this.time.delayedCall(800, () => {
      if (!this.isFinished) {
        this.canAct = true;
        if (this.energy <= 0 && this.shovelPowerups <= 0) {
          this.finishGame(this.treasuresFound >= this.totalTreasures);
        } else {
          this.promptText.setText('Tap another plot to dig!');
        }
      }
    });
  }

  private _updateStats() {
    this.energyText.setText(`⛏️ Energy: ${this.energy}`);
    if (this.energy <= 3) this.energyText.setColor(this.hex(this.theme.danger));
    else if (this.energy <= 6) this.energyText.setColor(this.hex(this.theme.warning));
    else this.energyText.setColor(this.hex(this.theme.success));
    this.foundText.setText(`💎 Treasures: ${this.treasuresFound}/${this.totalTreasures}`);
  }
}
