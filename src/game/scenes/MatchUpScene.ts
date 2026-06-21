import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MATCH UP — Pairing Engine
// Drag left-column terms to right-column definitions.
// ============================================================================

interface MatchRow {
  term: TermItem;
  definition: TermItem;
  // left card = term, right card = definition (shuffled separately)
}

export default class MatchUpScene extends BaseEngine {
  private rows: MatchRow[] = [];
  private dragging?: { card: Phaser.GameObjects.Container; offsetX: number; offsetY: number };
  private slots: { definition: TermItem; container: Phaser.GameObjects.Container; occupied: boolean }[] = [];
  private cards: { term: TermItem; container: Phaser.GameObjects.Container; placed: boolean }[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private draggingStartX = 0;
  private draggingStartY = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    this.promptText = this.add.text(
      this.scale.width / 2, 60,
      'Drag terms → definitions',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Build pairs
    const pool = this.pickTerms(this.maxScore);
    this.rows = pool.map(t => ({ term: t, definition: { ...t, term: t.definition ?? t.emoji ?? '★' } }));

    this.buildColumns();
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private buildColumns() {
    const termCol = [...this.rows].map(r => r.term);
    const defCol = [...this.rows].map(r => r.definition);
    Phaser.Utils.Array.Shuffle(defCol);

    const cardW = 280, cardH = 70;
    const gap = 16;
    const startY = 130;

    // Left column (terms)
    termCol.forEach((term, i) => {
      const y = startY + i * (cardH + gap);
      const bg = this.add.rectangle(0, 0, cardW, cardH, this.theme.card, 0.95)
        .setStrokeStyle(2, this.theme.accent, 0.7);
      const txt = this.add.text(0, 0, term.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '23px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(180, y, [bg, txt]).setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      container.setData('term', term);
      this.cards.push({ term, container, placed: false });

      this.input.setDraggable(container);
      container.on('dragstart', () => {
        audioBus.play('flip');
        this.draggingStartX = container.x;
        this.draggingStartY = container.y;
        container.setDepth(100);
        this.tweens.add({ targets: container, scale: 1.05, duration: 150 });
      });
      container.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        container.x = dx;
        container.y = dy;
      });
      container.on('dragend', () => {
        this.tweens.add({ targets: container, scale: 1, duration: 150 });
        this.handleDrop(container);
      });
    });

    // Right column (definitions = targets)
    defCol.forEach((def, i) => {
      const y = startY + i * (cardH + gap);
      const bg = this.add.rectangle(0, 0, cardW, cardH, this.theme.cardAlt, 0.6)
        .setStrokeStyle(2, this.theme.accent2, 0.5);
      const txt = this.add.text(0, 0, def.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '21px',
        color: this.hex(this.theme.text),
        align: 'center',
        wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5);

      const container = this.add.container(this.scale.width - 180, y, [bg, txt]).setSize(cardW, cardH);
      container.setData('definition', def);
      container.setData('bg', bg);
      this.slots.push({ definition: def, container, occupied: false });
    });
  }

  private handleDrop(dragged: Phaser.GameObjects.Container) {
    const term = dragged.getData('term') as TermItem;
    let snapped = false;
    for (const slot of this.slots) {
      if (slot.occupied) continue;
      const dist = Phaser.Math.Distance.Between(dragged.x, dragged.y, slot.container.x, slot.container.y);
      if (dist < 80) {
        // Snap into slot
        const isCorrect = slot.definition.id === term.id;
        slot.occupied = true;
        this.recordAnswer({
          term: term.term,
          response: slot.definition.term,
          success: isCorrect,
          coordinate: { x: slot.container.x, y: slot.container.y, t: this.time.now },
        });

        if (isCorrect) {
          audioBus.play('correct');
          this.juice.burst(slot.container.x, slot.container.y, 'correct');
          // Animate merge
          this.tweens.add({
            targets: dragged,
            x: slot.container.x, y: slot.container.y,
            duration: 200, ease: 'Back.out',
            onComplete: () => {
              // Tint the slot green
              (slot.container.getData('bg') as Phaser.GameObjects.Rectangle).setFillStyle(this.theme.success, 0.7);
              dragged.setVisible(false);
            },
          });
          const card = this.cards.find(c => c.term.id === term.id);
          if (card) card.placed = true;
          snapped = true;
          this.checkWin();
        } else {
          audioBus.play('incorrect');
          this.juice.shake('medium');
          // Snap back
          this.tweens.add({
            targets: dragged,
            x: this.draggingStartX, y: this.draggingStartY,
            duration: 250, ease: 'Back.out',
          });
          slot.occupied = false;
        }
        break;
      }
    }
    if (!snapped) {
      this.tweens.add({
        targets: dragged,
        x: this.draggingStartX, y: this.draggingStartY,
        duration: 250, ease: 'Back.out',
      });
    }
  }
}
