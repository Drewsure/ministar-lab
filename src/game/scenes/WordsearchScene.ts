import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// WORDSEARCH — Text/Spelling Engine
// Find vocabulary words hidden in a generated letter grid.
// Algorithm adapted from bunkat/wordfind (intersecting matrices).
// ============================================================================

interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dir: 'horizontal' | 'vertical' | 'diagonal';
  cells: { r: number; c: number }[];
}

const DIRECTIONS = [
  { name: 'horizontal', dr: 0, dc: 1 },
  { name: 'vertical', dr: 1, dc: 0 },
  { name: 'diagonal', dr: 1, dc: 1 },
] as const;

export default class WordsearchScene extends BaseEngine {
  private grid: string[][] = [];
  private gridRows = 10;
  private gridCols = 10;
  private cellSize = 44;
  private placedWords: PlacedWord[] = [];
  private foundWords = new Set<string>();
  private cellTexts: Phaser.GameObjects.Text[][] = [];
  private cellRects: Phaser.GameObjects.Rectangle[][] = [];
  private selecting = false;
  private selStart?: { r: number; c: number };
  private selEnd?: { r: number; c: number };
  private selectionLine?: Phaser.GameObjects.Rectangle;
  private wordsList: { term: TermItem; word: string; text: Phaser.GameObjects.Text }[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    this.add.text(
      this.scale.width / 2, 50,
      'Find the hidden words',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Pick words and place them
    const allWords = this.pickTerms(this.maxScore)
      .map(t => ({ term: t, word: t.term.toUpperCase().replace(/[^A-Z]/g, '') }))
      .filter(w => w.word.length >= 2 && w.word.length <= Math.min(this.gridRows, this.gridCols));

    this.generateGrid(allWords);

    // ---- FIX: maxScore is the number of words ACTUALLY placed (was counting failed placements too) ----
    this.maxScore = this.placedWords.length;

    this.renderGrid();
    this.renderWordsList(allWords);

    // Selection input
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.startSelection(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateSelection(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endSelection(p));
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private generateGrid(words: { term: TermItem; word: string }[]) {
    this.grid = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(''));
    this.placedWords = [];

    // Sort longest first for placement success
    const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

    for (const w of sorted) {
      let placed = false;
      for (let attempt = 0; attempt < 100 && !placed; attempt++) {
        const dir = Phaser.Utils.Array.GetRandom([...DIRECTIONS]);
        const maxR = dir.dr === 0 ? this.gridRows : this.gridRows - w.word.length + 1;
        const maxC = dir.dc === 0 ? this.gridCols : this.gridCols - w.word.length + 1;
        if (maxR <= 0 || maxC <= 0) continue;
        const r = Phaser.Math.Between(0, maxR - 1);
        const c = Phaser.Math.Between(0, maxC - 1);

        // Check fits with existing letters
        let ok = true;
        const cells: { r: number; c: number }[] = [];
        for (let i = 0; i < w.word.length; i++) {
          const rr = r + dir.dr * i;
          const cc = c + dir.dc * i;
          const existing = this.grid[rr][cc];
          if (existing !== '' && existing !== w.word[i]) { ok = false; break; }
          cells.push({ r: rr, c: cc });
        }
        if (!ok) continue;
        // Place
        cells.forEach((cell, i) => { this.grid[cell.r][cell.c] = w.word[i]; });
        this.placedWords.push({ word: w.word, row: r, col: c, dir: dir.name, cells });
        placed = true;
      }
    }

    // Fill empty cells with random letters
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c] === '') {
          this.grid[r][c] = String.fromCharCode(65 + Phaser.Math.Between(0, 25));
        }
      }
    }
  }

  private renderGrid() {
    const totalW = this.gridCols * this.cellSize;
    const totalH = this.gridRows * this.cellSize;
    const startX = (this.scale.width - totalW) / 2;
    const startY = 100;

    this.cellTexts = [];
    this.cellRects = [];

    for (let r = 0; r < this.gridRows; r++) {
      this.cellTexts[r] = [];
      this.cellRects[r] = [];
      for (let c = 0; c < this.gridCols; c++) {
        const x = startX + c * this.cellSize + this.cellSize / 2;
        const y = startY + r * this.cellSize + this.cellSize / 2;
        const rect = this.add.rectangle(x, y, this.cellSize - 2, this.cellSize - 2, this.theme.card, 0.3)
          .setStrokeStyle(1, this.theme.accent, 0.2);
        const txt = this.add.text(x, y, this.grid[r][c], {
          fontFamily: 'Inter, sans-serif',
          fontSize: '25px',
          color: this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        txt.setData('r', r); txt.setData('c', c);
        this.cellRects[r][c] = rect;
        this.cellTexts[r][c] = txt;
      }
    }
  }

  private renderWordsList(words: { term: TermItem; word: string }[]) {
    const listX = 20;
    const listY = 100;
    this.add.text(listX, listY, 'Words to find:', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: this.hex(this.theme.textMuted),
    }).setDepth(50);

    words.forEach((w, i) => {
      const t = this.add.text(listX, listY + 24 + i * 22, `☐ ${w.word}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.text),
      }).setDepth(50);
      this.wordsList.push({ term: w.term, word: w.word, text: t });
    });
  }

  private startSelection(p: Phaser.Input.Pointer) {
    const cell = this.pointToCell(p);
    if (!cell) return;
    this.selecting = true;
    this.selStart = cell;
    this.selEnd = cell;
    this.highlightSelection();
  }

  private updateSelection(p: Phaser.Input.Pointer) {
    if (!this.selecting) return;
    const cell = this.pointToCell(p);
    if (!cell) return;
    this.selEnd = cell;
    this.highlightSelection();
  }

  private endSelection(_p: Phaser.Input.Pointer) {
    if (!this.selecting || !this.selStart || !this.selEnd) {
      this.selecting = false;
      return;
    }
    this.selecting = false;
    const cells = this.lineCells(this.selStart, this.selEnd);
    if (!cells) { this.clearHighlight(); return; }
    const word = cells.map(c => this.grid[c.r][c.c]).join('');
    const reversed = word.split('').reverse().join('');

    const found = this.wordsList.find(w => !this.foundWords.has(w.word) && (w.word === word || w.word === reversed));
    if (found) {
      audioBus.play('correct');
      this.foundWords.add(found.word);
      // ESL: speak the found word aloud
  
      this.recordAnswer({
        term: found.term.term,
        response: found.word,
        success: true,
        coordinate: { x: cells[0].c * this.cellSize, y: cells[0].r * this.cellSize, t: this.time.now },
      });
      found.text.setText(`✓ ${found.word}`);
      found.text.setColor(this.hex(this.theme.success));
      // Tint the cells permanently
      cells.forEach(c => {
        this.cellRects[c.r][c.c].setFillStyle(this.theme.success, 0.4);
      });
      this.juice.burst(this.cellRects[cells[0].r][cells[0].c].x, this.cellRects[cells[0].r][cells[0].c].y, 'correct');
      this.checkWin();
    } else {
      // ---- FIX: record failed selections for telemetry parity (was silently skipped) ----
      audioBus.play('incorrect');
      this.recordAnswer({
        term: 'invalid-selection',
        response: word,
        success: false,
        coordinate: { x: this.selEnd.c * this.cellSize, y: this.selEnd.r * this.cellSize, t: this.time.now },
      });
      this.juice.shake('light');
    }
    this.clearHighlight();
  }

  private pointToCell(p: Phaser.Input.Pointer): { r: number; c: number } | null {
    const totalW = this.gridCols * this.cellSize;
    const startX = (this.scale.width - totalW) / 2;
    const startY = 100;
    const c = Math.floor((p.x - startX) / this.cellSize);
    const r = Math.floor((p.y - startY) / this.cellSize);
    if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return null;
    return { r, c };
  }

  private lineCells(a: { r: number; c: number }, b: { r: number; c: number }): { r: number; c: number }[] | null {
    const dr = Math.sign(b.r - a.r);
    const dc = Math.sign(b.c - a.c);
    const ddr = Math.abs(b.r - a.r);
    const ddc = Math.abs(b.c - a.c);
    // Only allow straight lines (horizontal, vertical, diagonal)
    if (ddr !== 0 && ddc !== 0 && ddr !== ddc) return null;
    const len = Math.max(ddr, ddc) + 1;
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < len; i++) {
      cells.push({ r: a.r + dr * i, c: a.c + dc * i });
    }
    return cells;
  }

  private selectionLine?: Phaser.GameObjects.Graphics;

  private highlightSelection() {
    this.clearHighlight();
    if (!this.selStart || !this.selEnd) return;
    const cells = this.lineCells(this.selStart, this.selEnd);
    if (!cells) return;
    cells.forEach(c => {
      this.cellRects[c.r][c.c].setFillStyle(this.theme.accent2, 0.4);
    });
    // Draw a line through the selection
    if (this.selectionLine) this.selectionLine.destroy();
    this.selectionLine = this.add.graphics().setDepth(30);
    this.selectionLine.lineStyle(6, this.theme.accent2, 0.5);
    this.selectionLine.beginPath();
    const startX = (this.scale.width - this.gridCols * this.cellSize) / 2 + this.selStart.c * this.cellSize + this.cellSize / 2;
    const startY = 100 + this.selStart.r * this.cellSize + this.cellSize / 2;
    const endX = (this.scale.width - this.gridCols * this.cellSize) / 2 + this.selEnd.c * this.cellSize + this.cellSize / 2;
    const endY = 100 + this.selEnd.r * this.cellSize + this.cellSize / 2;
    this.selectionLine.moveTo(startX, startY);
    this.selectionLine.lineTo(endX, endY);
    this.selectionLine.strokePath();
  }

  private clearHighlight() {
    if (this.selectionLine) {
      this.selectionLine.destroy();
      this.selectionLine = undefined;
    }
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        // Don't un-tint found words
        const isFound = this.placedWords.some(pw =>
          pw.cells.some(cell => cell.r === r && cell.c === c) && this.foundWords.has(pw.word)
        );
        if (!isFound) {
          this.cellRects[r][c].setFillStyle(this.theme.card, 0.3);
        }
      }
    }
  }
}
