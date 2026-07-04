import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// GROUP SORT — Pairing Engine  (AAA 2029 — new template #15)
// ============================================================================
// Sort terms into category buckets. Terms appear at the top, player drags
// each term into the correct category bucket at the bottom.
//   • Terms auto-categorized by first letter (for demo) or by emoji
//   • Drag-and-drop with snap animation
//   • Correct drop: green flash + particle burst
//   • Wrong drop: red flash + bounce back
//   • Level progression + TTS
// ============================================================================

interface SortTerm {
  term: TermItem;
  container: Phaser.GameObjects.Container;
  placed: boolean;
}

interface Category {
  name: string;
  x: number;
  terms: SortTerm[];
  bg: Phaser.GameObjects.Rectangle;
}

export default class GroupSortScene extends BaseEngine {
  private sortTerms: SortTerm[] = [];
  private categories: Category[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private unsortedY = 180;

  protected maxQuestions() { return Math.min(this.terms.length, 12); }

  protected buildWorld() {
    // ---- Title ----
    this.promptText = this.add.text(
      this.scale.width / 2, 95,
      '🗃️ Sort terms into categories',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Build categories (2-3 buckets based on term count) ----
    const terms = this.pickTerms(this.maxScore);
    const numCategories = terms.length <= 6 ? 2 : 3;

    // Categorize terms: group by first letter (demo categorization)
    // In production, this would be teacher-defined categories
    // CRASH GUARD: if any term has an empty .term string, t.term[0] is undefined
    // and .toUpperCase() throws. Fall back to '?' for empty terms.
    const firstLetters = [...new Set(terms.map(t => (t.term[0] ?? '?').toUpperCase()))].sort();
    const categoryNames: string[] = [];
    if (numCategories === 2) {
      const mid = Math.ceil(firstLetters.length / 2);
      categoryNames.push(`A-${firstLetters[mid - 1]}`, `${firstLetters[mid]}-Z`);
    } else {
      const third = Math.ceil(firstLetters.length / 3);
      categoryNames.push(
        `A-${firstLetters[third - 1]}`,
        `${firstLetters[third]}-${firstLetters[2 * third - 1]}`,
        `${firstLetters[2 * third] ?? firstLetters[third]}-Z`
      );
    }

    // Draw category buckets at bottom
    const bucketY = this.scale.height - 120;
    const bucketW = (this.scale.width - 80 - (numCategories - 1) * 20) / numCategories;
    const bucketH = 140;
    const startX = 40 + bucketW / 2;

    categoryNames.forEach((name, i) => {
      const x = startX + i * (bucketW + 20);
      const bg = this.add.rectangle(x, bucketY, bucketW, bucketH, this.theme.card, 0.7)
        .setStrokeStyle(3, this.theme.accent, 0.8).setDepth(20);

      // Category label — tap to hear (ESL: kids who can't read need to hear the category)
      const catLabel = this.add.text(x, bucketY - bucketH / 2 + 20, name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
      // Store speak text for global pointer handler (Phaser 4 per-object input unreliable)
      catLabel.setData('speakText', name);
      catLabel.setData('catX', x);
      catLabel.setData('catY', bucketY - bucketH / 2 + 20);

      // Drop zone indicator
      this.add.text(x, bucketY + 20, 'Drop here', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: this.hex(this.theme.textMuted),
      }).setOrigin(0.5).setDepth(21).setAlpha(0.5);

      // Determine which terms belong in this category
      const belongs = terms.filter(t => {
        const idx = firstLetters.indexOf((t.term[0] ?? '?').toUpperCase());
        if (numCategories === 2) return idx < Math.ceil(firstLetters.length / 2) ? i === 0 : i === 1;
        return idx < Math.ceil(firstLetters.length / 3) ? i === 0
             : idx < Math.ceil(2 * firstLetters.length / 3) ? i === 1 : i === 2;
      });

      this.categories.push({ name, x, terms: [], bg });
      void belongs;
    });

    // Global pointer for tap-to-speak on category labels
    this.setupGlobalPointer((x, y) => {
      for (const cat of this.categories) {
        if (Math.abs(x - cat.x) < 60 && Math.abs(y - 150) < 20) {
          audioBus.speak(cat.name);
          audioBus.play('tap');
          return;
        }
      }
    });

    // ---- Create draggable terms at top ----
    const shuffled = [...terms];
    Phaser.Utils.Array.Shuffle(shuffled);

    const termW = 110, termH = 50;
    const termsPerRow = Math.min(4, shuffled.length);
    const rowGap = 12;
    const colGap = 12;
    const totalW = termsPerRow * termW + (termsPerRow - 1) * colGap;
    const termsStartX = (this.scale.width - totalW) / 2 + termW / 2;

    shuffled.forEach((term, i) => {
      const col = i % termsPerRow;
      const row = Math.floor(i / termsPerRow);
      const x = termsStartX + col * (termW + colGap);
      const y = this.unsortedY + row * (termH + rowGap);

      // Glow (visible when dragged)
      const glow = this.add.circle(0, 0, termW * 0.6, this.theme.accent, 0).setDepth(39);
      // Shadow
      const shadow = this.add.rectangle(3, 3, termW, termH, 0x000000, 0.3).setDepth(40);
      // Background
      const bg = this.add.rectangle(0, 0, termW, termH, this.theme.cardAlt, 0.95)
        .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(41);
      // Shine
      const shine = this.add.rectangle(-termW / 4, -termH / 4, termW / 2, termH / 3, 0xffffff, 0.1).setDepth(42);
      // Text
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(43);

      const container = this.add.container(x, y, [glow, shadow, bg, shine, txt])
        .setSize(termW, termH).setInteractive({ useHandCursor: true, draggable: true }).setDepth(40);

      const sortTerm: SortTerm = { term, container, placed: false };
      this.sortTerms.push(sortTerm);
      container.setData('sortTerm', sortTerm);

      // Drag setup
      this.input.setDraggable(container);
      container.on('dragstart', () => {
        audioBus.play('tap');
        container.setScale(1.1);
        container.setDepth(100);
        // Show glow
        this.tweens.add({ targets: glow, alpha: 0.3, duration: 200 });
        // ESL: speak the term when picked up
    
      });
      container.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        container.x = dx;
        container.y = dy;
      });
      container.on('dragend', () => {
        container.setScale(1);
        this.tweens.add({ targets: glow, alpha: 0, duration: 200 });
        this.handleDrop(sortTerm);
      });

      // Tap to hear — REMOVED per-container pointerdown.
      // The global pointer handler in setupGlobalPointer handles tap-to-speak.
      // Per-container pointerdown caused speech to fire twice.
    });

    // Wire up global drag end
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const container = gameObject as Phaser.GameObjects.Container;
      const st = container.getData('sortTerm') as SortTerm | null;
      if (st) this.handleDrop(st);
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private handleDrop(sortTerm: SortTerm) {
    if (sortTerm.placed) return;

    // Find which bucket the term was dropped on
    const droppedX = sortTerm.container.x;
    const droppedY = sortTerm.container.y;

    let closestCat: Category | null = null;
    let closestDist = Infinity;
    this.categories.forEach(cat => {
      const dx = droppedX - cat.x;
      const dy = droppedY - (this.scale.height - 120);
      const dist = Math.hypot(dx, dy);
      if (dist < 120 && dist < closestDist) {
        closestDist = dist;
        closestCat = cat;
      }
    });

    if (!closestCat) {
      // Not dropped on any bucket — return to original position with bounce
      this.tweens.add({
        targets: sortTerm.container,
        x: sortTerm.container.x,
        y: sortTerm.container.y,
        duration: 300, ease: 'Back.out',
      });
      return;
    }

    // Bind to non-null const so closures retain the narrowing
    const cat: Category = closestCat;

    // Check if correct (term's first letter matches category range)
    const isCorrect = this.isCorrectCategory(sortTerm.term, cat);

    this.recordAnswer({
      term: sortTerm.term.term,
      response: cat.name,
      success: isCorrect,
      coordinate: { x: droppedX, y: droppedY, t: this.time.now },
    });

    if (isCorrect) {
      // Snap into bucket
      sortTerm.placed = true;
      cat.terms.push(sortTerm);
      const placedCount = cat.terms.length;
      const snapX = cat.x + (placedCount % 3 - 1) * 35;
      const snapY = this.scale.height - 120 + 30 + Math.floor(placedCount / 3) * 30;
      this.tweens.add({
        targets: sortTerm.container,
        x: snapX, y: snapY,
        scale: 0.7,
        duration: 300, ease: 'Back.out',
      });
      // Green flash on bucket
      cat.bg.setFillStyle(this.theme.success, 0.4);
      this.time.delayedCall(300, () => cat.bg.setFillStyle(this.theme.card, 0.7));
      this.juice.burst(droppedX, droppedY, 'correct');
      this.checkWin();
    } else {
      // Wrong bucket — red flash + bounce back
      cat.bg.setFillStyle(this.theme.danger, 0.4);
      this.time.delayedCall(300, () => cat.bg.setFillStyle(this.theme.card, 0.7));
      this.juice.burst(droppedX, droppedY, 'incorrect');
      this.tweens.add({
        targets: sortTerm.container,
        x: { from: droppedX, to: droppedX },
        duration: 60, yoyo: true, repeat: 3,
      });
    }
  }

  private isCorrectCategory(term: TermItem, cat: Category): boolean {
    // Parse category range (e.g. "A-M" or "N-Z")
    const match = cat.name.match(/^([A-Z])-([A-Z])$/);
    if (!match) return false;
    const start = match[1].charCodeAt(0);
    const end = match[2].charCodeAt(0);
    const letter = term.term[0].toUpperCase().charCodeAt(0);
    return letter >= start && letter <= end;
  }
}
