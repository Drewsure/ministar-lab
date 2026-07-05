import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// CROSSWORD — Text/Spelling Engine  (12th mode, AAA 2029)
// ============================================================================
// Generates a dense crossword layout from the term list using a greedy
// intersection algorithm adapted from MichaelWehar/Crossword-Layout-Generator.
// Players tap cells, type letters, and complete all words to win.
// ============================================================================

interface PlacedEntry {
  word: string;
  row: number;
  col: number;
  dir: 'across' | 'down';
  number: number;
  clue: string;
  cells: { r: number; c: number; letter: string }[];
  solved: boolean;
}

interface GridCell {
  letter: string;
  owner: PlacedEntry | null;
  text: Phaser.GameObjects.Text | null;
  rect: Phaser.GameObjects.Rectangle | null;
  userInput: string;
}

interface CellPos {
  r: number;
  c: number;
  letter: string;
}

export default class CrosswordScene extends BaseEngine {
  private grid: GridCell[][] = [];
  private gridRows = 0;
  private gridCols = 0;
  private cellSize = 38;
  private gridOffsetX = 0;
  private gridOffsetY = 130;

  private entries: PlacedEntry[] = [];
  private activeEntry: PlacedEntry | null = null;
  private activeCellIdx = 0;

  private clueText!: Phaser.GameObjects.Text;
  private activeCellHighlight!: Phaser.GameObjects.Rectangle;
  private activeEntryHighlight!: Phaser.GameObjects.Rectangle;
  private keyboardKeys: Phaser.GameObjects.Container[] = [];
  private solvedCount = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.add.text(
      this.scale.width / 2, 50,
      '🔤 Crossword',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.clueText = this.add.text(
      this.scale.width / 2, 84,
      'Tap a cell to start',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.textMuted),
        align: 'center',
        wordWrap: { width: 700 },
      }
    ).setOrigin(0.5).setDepth(50);

    // Build crossword
    this.generateLayout();
    this.renderGrid();
    this.renderKeyboard();

    // Highlight helpers
    this.activeEntryHighlight = this.add.rectangle(0, 0, 0, 0, this.theme.accent, 0.18)
      .setVisible(false).setDepth(14);
    this.activeCellHighlight = this.add.rectangle(0, 0, this.cellSize - 4, this.cellSize - 4, this.theme.accent2, 0.5)
      .setStrokeStyle(2, this.theme.accent2)
      .setVisible(false).setDepth(15);

    // Keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (e: KeyboardEvent) => this.handleKey(e));
    }

    // Global pointer handler for reliable cell + keyboard clicks
    this.setupGlobalPointer((x, y) => {
      // Hit-test grid cells
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          const cell = this.grid[r][c];
          if (cell.letter === '' || !cell.rect) continue;
          const cellX = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
          const cellY = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
          if (Math.abs(x - cellX) < this.cellSize / 2 && Math.abs(y - cellY) < this.cellSize / 2) {
            this.selectCell(r, c);
            return;
          }
        }
      }
      // Hit-test keyboard buttons
      for (const key of this.keyboardKeys) {
        if (Math.abs(x - key.x) < 15 && Math.abs(y - key.y) < 15) {
          const bg = key.getAt(0) as Phaser.GameObjects.Rectangle;
          const txt = key.getAt(1) as Phaser.GameObjects.Text;
          if (txt && txt.text === '⌫ DEL') {
            this.deleteLetter();
          } else if (txt) {
            // ESL: speak the letter when tapped
            audioBus.speak(txt.text);
            this.typeLetter(txt.text);
          }
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  // ===========================================================================
  // LAYOUT GENERATION — greedy intersection algorithm
  // ===========================================================================
  private generateLayout() {
    const terms = this.pickTerms(this.maxScore)
      .map(t => ({
        word: t.term.toUpperCase().replace(/[^A-Z]/g, ''),
        clue: t.definition ?? t.emoji ?? t.term,
        term: t,
      }))
      .filter(w => w.word.length >= 3);

    if (terms.length === 0) {
      this.entries = [];
      this.gridRows = 0;
      this.gridCols = 0;
      return;
    }

    // Sort longest first for better density
    terms.sort((a, b) => b.word.length - a.word.length);

    // Working grid: sparse map of "r,c" -> letter
    const sparse = new Map<string, string>();
    const placed: PlacedEntry[] = [];
    const minR = { v: 0 }, maxR = { v: 0 }, minC = { v: 0 }, maxC = { v: 0 };

    // Place first word horizontally at (0, 0)
    const first = terms[0];
    const firstCells: CellPos[] = [];
    for (let i = 0; i < first.word.length; i++) {
      sparse.set(`0,${i}`, first.word[i]);
      firstCells.push({ r: 0, c: i, letter: first.word[i] });
      maxC.v = Math.max(maxC.v, i);
    }
    placed.push({
      word: first.word, row: 0, col: 0, dir: 'across', number: 1,
      clue: first.clue, cells: firstCells, solved: false,
    });

    // Try to place each remaining word by intersecting with placed words
    for (let ti = 1; ti < terms.length; ti++) {
      const term = terms[ti];
      let bestPos: { row: number; col: number; dir: 'across' | 'down'; intersectIdx: number } | null = null;
      let bestScore = -1;

      for (const p of placed) {
        // For each letter in placed word, try to match against each letter in new word
        for (let pi = 0; pi < p.word.length; pi++) {
          for (let ni = 0; ni < term.word.length; ni++) {
            if (p.word[pi] !== term.word[ni]) continue;

            // Determine candidate position for the new word
            let row: number, col: number;
            let newDir: 'across' | 'down';
            if (p.dir === 'across') {
              // New word must be vertical, intersecting at p's cell
              row = p.row - ni;
              col = p.col + pi;
              newDir = 'down';
            } else {
              row = p.row + pi;
              col = p.col - ni;
              newDir = 'across';
            }

            // Validate placement
            const score = this.validatePlacement(term.word, row, col, newDir, sparse);
            if (score > bestScore) {
              bestScore = score;
              bestPos = { row, col, dir: newDir, intersectIdx: ni };
            }
          }
        }
      }

      if (bestPos && bestScore >= 1) {
        const cells: CellPos[] = [];
        for (let i = 0; i < term.word.length; i++) {
          const r = bestPos.dir === 'across' ? bestPos.row : bestPos.row + i;
          const c = bestPos.dir === 'across' ? bestPos.col + i : bestPos.col;
          sparse.set(`${r},${c}`, term.word[i]);
          cells.push({ r, c, letter: term.word[i] });
          minR.v = Math.min(minR.v, r);
          maxR.v = Math.max(maxR.v, r);
          minC.v = Math.min(minC.v, c);
          maxC.v = Math.max(maxC.v, c);
        }
        placed.push({
          word: term.word, row: bestPos.row, col: bestPos.col, dir: bestPos.dir,
          number: placed.length + 1, clue: term.clue, cells, solved: false,
        });
      }
    }

    // Normalize coordinates so min = 0
    const normRow = (r: number) => r - minR.v;
    const normCol = (c: number) => c - minC.v;
    this.gridRows = maxR.v - minR.v + 1;
    this.gridCols = maxC.v - minC.v + 1;

    // Build dense grid
    this.grid = Array.from({ length: this.gridRows }, () =>
      Array.from({ length: this.gridCols }, () => ({
        letter: '', owner: null, text: null, rect: null, userInput: '',
      }))
    );

    for (const entry of placed) {
      entry.row = normRow(entry.row);
      entry.col = normCol(entry.col);
      entry.cells = entry.cells.map(c => ({ r: normRow(c.r), c: normCol(c.c), letter: c.letter }));
      for (const cell of entry.cells) {
        this.grid[cell.r][cell.c].letter = sparse.get(`${cell.r + minR.v},${cell.c + minC.v}`) ?? '';
        this.grid[cell.r][cell.c].owner = entry;
      }
    }

    // Number entries (across first, then down, by position)
    const sorted = [...placed].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    sorted.forEach((e, i) => { e.number = i + 1; });
    this.entries = sorted;

    // Center the grid
    this.gridOffsetX = (this.scale.width - this.gridCols * this.cellSize) / 2;
  }

  private validatePlacement(
    word: string, row: number, col: number,
    dir: 'across' | 'down', sparse: Map<string, string>
  ): number {
    let intersections = 0;
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const key = `${r},${c}`;
      const existing = sparse.get(key);
      if (existing !== undefined) {
        if (existing !== word[i]) return -1; // conflict
        intersections++;
      } else {
        // Check perpendicular neighbors don't exist (would create invalid adjacencies)
        if (dir === 'across') {
          if (sparse.has(`${r - 1},${c}`) || sparse.has(`${r + 1},${c}`)) return -1;
        } else {
          if (sparse.has(`${r},${c - 1}`) || sparse.has(`${r},${c + 1}`)) return -1;
        }
      }
    }
    // Check cells immediately before and after the word are empty
    const beforeKey = `${row - dr},${col - dc}`;
    const afterKey = `${row + dr * word.length},${col + dc * word.length}`;
    if (sparse.has(beforeKey) || sparse.has(afterKey)) return -1;

    return intersections;
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================
  private renderGrid() {
    if (this.gridRows === 0) return;
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const cell = this.grid[r][c];
        if (cell.letter === '') continue; // skip empty cells

        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        const rect = this.add.rectangle(x, y, this.cellSize - 2, this.cellSize - 2, this.theme.card, 0.95)
          .setStrokeStyle(1.5, this.theme.accent, 0.5)
          .setInteractive({ useHandCursor: true })
          .setDepth(10);
        // NOTE: per-rect pointerdown removed — global handler handles cell taps.

        const text = this.add.text(x, y, '', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '23px',
          color: this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);
        text.setInteractive({ useHandCursor: true });
        // NOTE: per-text pointerdown removed — global handler handles cell taps.

        // Number label
        const owner = cell.owner;
        if (owner && owner.cells[0].r === r && owner.cells[0].c === c) {
          this.add.text(x - this.cellSize / 2 + 3, y - this.cellSize / 2 + 2, String(owner.number), {
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            color: this.hex(this.theme.textMuted),
          }).setOrigin(0, 0).setDepth(12);
        }

        cell.rect = rect;
        cell.text = text;
      }
    }
  }

  private renderKeyboard() {
    this.keyboardKeys.forEach(k => k.destroy());
    this.keyboardKeys = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const rows = [alphabet.slice(0, 10), alphabet.slice(10, 19), alphabet.slice(19)];
    const btnSize = 28, gap = 4;
    const kbY = this.gridOffsetY + this.gridRows * this.cellSize + 30;

    rows.forEach((row, ri) => {
      const totalW = row.length * btnSize + (row.length - 1) * gap;
      const startX = (this.scale.width - totalW) / 2 + btnSize / 2;
      for (let i = 0; i < row.length; i++) {
        const letter = row[i];
        const x = startX + i * (btnSize + gap);
        const y = kbY + ri * (btnSize + gap);
        const bg = this.add.rectangle(0, 0, btnSize, btnSize, this.theme.card, 0.9)
          .setStrokeStyle(1, this.theme.accent, 0.5);
        const txt = this.add.text(0, 0, letter, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          color: this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, txt])
          .setSize(btnSize, btnSize)
          .setInteractive({ useHandCursor: true });
        container.on('pointerover', () => { bg.setFillStyle(this.theme.cardAlt, 1); audioBus.play('hover'); });
        container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.9));
        // NOTE: per-container pointerdown removed — global handler handles letter taps.
        this.keyboardKeys.push(container);
      }
    });

    // Backspace + check button row
    const kbY2 = kbY + 3 * (btnSize + gap) + 8;
    const bsBg = this.add.rectangle(0, 0, 80, btnSize, this.theme.danger, 0.7)
      .setStrokeStyle(1, this.theme.danger);
    const bsTxt = this.add.text(0, 0, '⌫ DEL', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const bsBtn = this.add.container(this.scale.width / 2 - 50, kbY2, [bsBg, bsTxt])
      .setSize(80, btnSize).setInteractive({ useHandCursor: true });
    // NOTE: per-container pointerdown removed — global handler handles DEL taps.
    this.keyboardKeys.push(bsBtn);
  }

  // ===========================================================================
  // INTERACTION
  // ===========================================================================
  private selectCell(r: number, c: number) {
    const cell = this.grid[r][c];
    if (!cell.owner) return;
    // Toggle direction if tapping the active cell
    if (this.activeEntry && this.activeCellIdx < this.activeEntry.cells.length) {
      const curCell = this.activeEntry.cells[this.activeCellIdx];
      if (curCell.r === r && curCell.c === c) {
        // Toggle direction
        const other = this.entries.find(e =>
          e !== this.activeEntry && e.cells.some(cc => cc.r === r && cc.c === c)
        );
        if (other) {
          this.activeEntry = other;
          this.activeCellIdx = other.cells.findIndex(cc => cc.r === r && cc.c === c);
          this.updateHighlights();
          this.updateClueText();
          audioBus.play('tap');
          return;
        }
      }
    }
    this.activeEntry = cell.owner;
    this.activeCellIdx = cell.owner.cells.findIndex(cc => cc.r === r && cc.c === c);
    this.updateHighlights();
    this.updateClueText();
    audioBus.play('tap');
  }

  private updateHighlights() {
    if (!this.activeEntry) {
      this.activeCellHighlight.setVisible(false);
      this.activeEntryHighlight.setVisible(false);
      return;
    }
    // Entry highlight: bounding box of all cells in entry
    const cells = this.activeEntry.cells;
    const minC = Math.min(...cells.map(c => c.c));
    const maxC = Math.max(...cells.map(c => c.c));
    const minR = Math.min(...cells.map(c => c.r));
    const maxR = Math.max(...cells.map(c => c.r));
    const w = (maxC - minC + 1) * this.cellSize;
    const h = (maxR - minR + 1) * this.cellSize;
    const x = this.gridOffsetX + minC * this.cellSize + w / 2;
    const y = this.gridOffsetY + minR * this.cellSize + h / 2;
    this.activeEntryHighlight.setPosition(x, y).setSize(w, h).setVisible(true);

    // Active cell highlight
    const ac = cells[this.activeCellIdx];
    if (ac) {
      const cx = this.gridOffsetX + ac.c * this.cellSize + this.cellSize / 2;
      const cy = this.gridOffsetY + ac.r * this.cellSize + this.cellSize / 2;
      this.activeCellHighlight.setPosition(cx, cy).setVisible(true);
    }
  }

  private updateClueText() {
    if (!this.activeEntry) {
      this.clueText.setText('Tap a cell to start');
      return;
    }
    const dirLabel = this.activeEntry.dir === 'across' ? 'Across' : 'Down';
    this.clueText.setText(`${this.activeEntry.number} ${dirLabel}: ${this.activeEntry.clue}`);
    // ESL: speak the clue aloud


  }

  private handleKey(e: KeyboardEvent) {
    if (this.isFinished || !this.activeEntry) return;
    const k = e.key.toUpperCase();
    if (k === 'BACKSPACE') { this.deleteLetter(); return; }
    if (k === 'ARROWRIGHT' || k === 'ARROWLEFT' || k === 'ARROWUP' || k === 'ARROWDOWN') {
      this.moveCursor(k); return;
    }
    if (k.length === 1 && k >= 'A' && k <= 'Z') this.typeLetter(k);
  }

  private typeLetter(letter: string) {
    if (!this.activeEntry) return;
    const cell = this.activeEntry.cells[this.activeCellIdx];
    if (!cell) return;
    const gridCell = this.grid[cell.r][cell.c];
    gridCell.userInput = letter;
    gridCell.text?.setText(letter);
    audioBus.play('tap');
    this.juice.squash(gridCell.text!, 1.2);

    // Advance cursor
    if (this.activeCellIdx < this.activeEntry.cells.length - 1) {
      this.activeCellIdx++;
    }
    this.updateHighlights();
    this.checkEntrySolved();
  }

  private deleteLetter() {
    if (!this.activeEntry) return;
    if (this.activeCellIdx > 0) this.activeCellIdx--;
    const cell = this.activeEntry.cells[this.activeCellIdx];
    if (!cell) return;
    const gridCell = this.grid[cell.r][cell.c];
    gridCell.userInput = '';
    gridCell.text?.setText('');
    audioBus.play('tap');
    this.updateHighlights();
  }

  private moveCursor(dir: string) {
    if (!this.activeEntry) return;
    const cell = this.activeEntry.cells[this.activeCellIdx];
    let r = cell.r, c = cell.c;
    if (dir === 'ARROWRIGHT') c++;
    else if (dir === 'ARROWLEFT') c--;
    else if (dir === 'ARROWDOWN') r++;
    else if (dir === 'ARROWUP') r--;
    if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return;
    if (this.grid[r][c].letter === '') return;
    this.selectCell(r, c);
  }

  private checkEntrySolved() {
    if (!this.activeEntry) return;
    const entry = this.activeEntry;
    const allFilled = entry.cells.every(c => this.grid[c.r][c.c].userInput === c.letter);
    if (allFilled && !entry.solved) {
      entry.solved = true;
      this.solvedCount++;
      this.recordAnswer({
        term: entry.word,
        response: entry.cells.map(c => this.grid[c.r][c.c].userInput).join(''),
        success: true,
        coordinate: {
          x: this.gridOffsetX + entry.cells[0].c * this.cellSize,
          y: this.gridOffsetY + entry.cells[0].r * this.cellSize,
          t: this.time.now,
        },
      });
      // Highlight solved cells with glow
      entry.cells.forEach((c, i) => {
        this.grid[c.r][c.c].rect?.setFillStyle(this.theme.success, 0.5);
        // Pulse each cell
        this.tweens.add({
          targets: this.grid[c.r][c.c].rect,
          scale: { from: 1, to: 1.15 },
          duration: 200, delay: i * 50, yoyo: true, ease: 'Quad.out',
        });
      });
      // Big burst at center of word
      const centerX = this.gridOffsetX + entry.cells[Math.floor(entry.cells.length / 2)].c * this.cellSize + this.cellSize / 2;
      const centerY = this.gridOffsetY + entry.cells[Math.floor(entry.cells.length / 2)].r * this.cellSize + this.cellSize / 2;
      this.juice.burst(centerX, centerY, 'correct');
      this.juice.glowRing(centerX, centerY, this.theme.success, 80);
      this.juice.scorePopup(centerX, centerY - 20, entry.word, this.theme.success);
      audioBus.play('correct');
      // ESL: speak the completed word
  
      this.checkWin();
    }
  }

  protected checkWin() {
    if (this.solvedCount >= this.entries.length && !this.isFinished) {
      this.time.delayedCall(500, () => this.finishGame(true));
    }
  }
}
