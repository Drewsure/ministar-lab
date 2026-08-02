import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MATCH UP — Pairing Engine  (AAA 2029 edition)
// ============================================================================
// Premium drag-to-match with:
//   • Drag glow trail following the card
//   • Connection line drawn between matched pairs
//   • Snap animation with elastic bounce
//   • Wrong drop: red flash + card shakes + returns to origin
//   • Correct drop: green glow + particle burst + TTS
//   • Hover lift effect on draggable cards
//   • Progress indicator (X/Y matched)
//   • Smooth entrance animation
// ============================================================================

interface MatchRow {
  term: TermItem;
  definition: TermItem;
}

interface CardInfo {
  term: TermItem;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
  placed: boolean;
  homeX: number;
  homeY: number;
}

interface SlotInfo {
  definition: TermItem;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  occupied: boolean;
  x: number;
  y: number;
}

export default class MatchUpScene extends BaseEngine {
  private rows: MatchRow[] = [];
  private slots: SlotInfo[] = [];
  private cards: CardInfo[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private dragLine?: Phaser.GameObjects.Graphics;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  protected buildWorld() {
    // ---- Title ----
    this.promptText = this.add.text(
      this.scale.width / 2, 80,
      'Drag terms to definitions',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Progress ----
    this.progressText = this.add.text(
      this.scale.width / 2, 115, 'Matched: 0 / 0',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(50);

    // Build pairs
    const pool = this.pickTerms(this.maxScore);
    this.rows = pool.map(t => ({ term: t, definition: { ...t, term: t.definition ?? t.emoji ?? '★' } }));
    this.progressText.setText(`Matched: 0 / ${this.rows.length}`);

    this.buildColumns();

    // Global pointer handler for tap-to-speak on right column (definitions)
    this.setupGlobalPointer((x, y) => {
      // Check if tapping a right-column slot (to hear the definition)
      for (const slot of this.slots) {
        if (Math.abs(x - slot.x) < 130 && Math.abs(y - slot.y) < 32) {
          audioBus.speak(slot.definition.term);
          audioBus.play('tap');
          return;
        }
      }
      // Check if tapping a left-column card (to hear the term)
      for (const card of this.cards) {
        if (!card.placed && Math.abs(x - card.homeX) < 130 && Math.abs(y - card.homeY) < 32) {
          audioBus.speak(card.term.term);
          audioBus.play('tap');
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private buildColumns() {
    const termCol = [...this.rows].map(r => r.term);
    const defCol = [...this.rows].map(r => r.definition);
    Phaser.Utils.Array.Shuffle(defCol);

    const cardW = 260, cardH = 64;
    const gap = 14;
    const startY = 170;

    // Left column (terms — draggable)
    termCol.forEach((term, i) => {
      const y = startY + i * (cardH + gap);
      const x = 160;

      // Glow ring (visible when dragged)
      const glow = this.add.circle(0, 0, cardW * 0.6, this.theme.accent, 0).setDepth(14);

      // Card shadow
      const shadow = this.add.rectangle(3, 3, cardW, cardH, 0x000000, 0.3).setDepth(15);
      // Card background
      const bg = this.add.rectangle(0, 0, cardW, cardH, this.theme.card, 0.95)
        .setStrokeStyle(2, this.theme.accent, 0.7).setDepth(16);
      // Shine
      const shine = this.add.rectangle(-cardW / 4, -cardH / 4, cardW / 2, cardH / 3, 0xffffff, 0.1).setDepth(17);
      // Term text with emoji
      const txt = this.add.text(0, 0, `${term.emoji ?? ''} ${term.term}`.trim(), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(18);

      const container = this.add.container(x, y, [glow, shadow, bg, shine, txt])
        .setSize(cardW, cardH).setInteractive({ useHandCursor: true, draggable: true }).setDepth(20);
      container.setData('term', term);

      const cardInfo: CardInfo = {
        term, container, bg, glow,
        placed: false, homeX: x, homeY: y,
      };
      this.cards.push(cardInfo);

      // Hover effect
      container.on('pointerover', () => {
        if (!cardInfo.placed) {
          this.tweens.add({ targets: container, y: y - 6, scale: 1.03, duration: 120, ease: 'Quad.out' });
          audioBus.play('hover');
        }
      });
      container.on('pointerout', () => {
        if (!cardInfo.placed) {
          this.tweens.add({ targets: container, y: y, scale: 1, duration: 120, ease: 'Quad.out' });
        }
      });

      // Drag events
      container.on('dragstart', () => {
        audioBus.play('flip');
        container.setDepth(100);
        this.tweens.add({ targets: container, scale: 1.1, duration: 150, ease: 'Back.out' });
        // Show glow
        this.tweens.add({ targets: glow, alpha: 0.3, duration: 200 });
        // ESL: speak the term
    
      });
      container.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        container.x = dx;
        container.y = dy;
        // Draw drag line from home to current position
        this.updateDragLine(x, y, dx, dy);
      });
      container.on('dragend', () => {
        this.tweens.add({ targets: container, scale: 1, duration: 150 });
        this.tweens.add({ targets: glow, alpha: 0, duration: 200 });
        this.clearDragLine();
        this.handleDrop(container, cardInfo);
      });

      // NOTE: per-container pointerdown removed. The global handler in
      // setupGlobalPointer handles tap-to-speak. Double-listening caused
      // speech to fire twice.

      // Entrance animation
      container.setAlpha(0).setX(x - 100);
      this.tweens.add({
        targets: container, alpha: 1, x: x,
        duration: 400, delay: i * 80, ease: 'Back.out',
      });
    });

    // Right column (definitions — drop targets)
    defCol.forEach((def, i) => {
      const y = startY + i * (cardH + gap);
      const x = this.scale.width - 160;

      // Slot background (dashed border look)
      const bg = this.add.rectangle(0, 0, cardW, cardH, this.theme.cardAlt, 0.4)
        .setStrokeStyle(2, this.theme.accent2, 0.5).setDepth(10);
      // Drop zone indicator
      const indicator = this.add.text(0, 0, def.term, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: this.hex(this.theme.textMuted),
        align: 'center',
        wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5).setDepth(11);

      const container = this.add.container(x, y, [bg, indicator]).setSize(cardW, cardH).setDepth(10);
      // Store speak text for the global pointer handler (Phaser 4 per-object input is unreliable)
      indicator.setData('speakText', def.term);
      this.slots.push({
        definition: def, container, bg,
        occupied: false, x, y,
      });

      // Entrance animation
      container.setAlpha(0).setX(x + 100);
      this.tweens.add({
        targets: container, alpha: 1, x: x,
        duration: 400, delay: i * 80, ease: 'Back.out',
      });
    });
  }

  private updateDragLine(fromX: number, fromY: number, toX: number, toY: number) {
    this.clearDragLine();
    this.dragLine = this.add.graphics().setDepth(50);
    this.dragLine.lineStyle(3, this.theme.accent, 0.5);
    this.dragLine.beginPath();
    this.dragLine.moveTo(fromX, fromY);
    this.dragLine.lineTo(toX, toY);
    this.dragLine.strokePath();
  }

  private clearDragLine() {
    if (this.dragLine) {
      this.dragLine.destroy();
      this.dragLine = undefined;
    }
  }

  private handleDrop(dragged: Phaser.GameObjects.Container, cardInfo: CardInfo) {
    const term = dragged.getData('term') as TermItem;
    let snapped = false;

    for (const slot of this.slots) {
      if (slot.occupied) continue;
      const dist = Phaser.Math.Distance.Between(dragged.x, dragged.y, slot.x, slot.y);
      if (dist < 80) {
        const isCorrect = slot.definition.id === term.id;
        slot.occupied = true;

        this.recordAnswer({
          term: term.term,
          response: slot.definition.term,
          success: isCorrect,
          coordinate: { x: slot.x, y: slot.y, t: this.time.now },
        });

        if (isCorrect) {
          audioBus.play('correct');
      
          this.juice.burst(slot.x, slot.y, 'correct');
          this.juice.glowRing(slot.x, slot.y, this.theme.success, 60);

          // Draw permanent connection line
          const line = this.add.graphics().setDepth(5);
          line.lineStyle(4, this.theme.success, 0.6);
          line.beginPath();
          line.moveTo(cardInfo.homeX, cardInfo.homeY);
          line.lineTo(slot.x, slot.y);
          line.strokePath();

          // Animate merge
          this.tweens.add({
            targets: dragged,
            x: slot.x, y: slot.y,
            duration: 250, ease: 'Back.out',
            onComplete: () => {
              slot.bg.setFillStyle(this.theme.success, 0.7);
              slot.bg.setStrokeStyle(3, this.theme.success, 1);
              dragged.setVisible(false);
            },
          });
          cardInfo.placed = true;
          this.progressText.setText(`Matched: ${this.score + 1} / ${this.rows.length}`);
          snapped = true;
          this.checkWin();
        } else {
          audioBus.play('incorrect');
          this.juice.shake('medium');
          this.juice.flash(this.theme.danger, 0.15, 100);
          slot.occupied = false;
          // Shake + return
          this.tweens.add({
            targets: dragged,
            x: '+=10', duration: 50, yoyo: true, repeat: 3,
            onComplete: () => {
              this.tweens.add({
                targets: dragged,
                x: cardInfo.homeX, y: cardInfo.homeY,
                duration: 300, ease: 'Back.out',
              });
            },
          });
        }
        break;
      }
    }
    if (!snapped && !cardInfo.placed) {
      this.tweens.add({
        targets: dragged,
        x: cardInfo.homeX, y: cardInfo.homeY,
        duration: 300, ease: 'Back.out',
      });
    }
  }
}
