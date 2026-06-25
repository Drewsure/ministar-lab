import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// LABEL IT — Drag labels onto hotspots on a teacher-uploaded diagram

interface LabelItem { id: string; text: string; x: number; y: number; placed: boolean; }
interface DragLabel { id: string; text: string; container: Phaser.GameObjects.Container; startX: number; startY: number; isPlaced: boolean; }

export default class LabelItScene extends BaseEngine {
  private labels: LabelItem[] = [];
  private dragLabels: DragLabel[] = [];
  private hintText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return this.labels.length || 5; }

  protected buildWorld() {
    const cfg = this.registry.get('launchConfig') as any;
    this.labels = (cfg?.labels ?? []).map((l: any, i: number) => ({
      id: l.id ?? `label-${i}`, text: l.text, x: l.x ?? 100 + (i * 120), y: l.y ?? 100, placed: false,
    }));

    this.add.text(this.scale.width / 2, 105, 'Label It!', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(this.scale.width / 2, 140, 'Drag each label to the correct spot', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Draw target hotspots
    this.labels.forEach((label, i) => {
      const hotspot = this.add.circle(label.x, label.y, 18, this.theme.warning, 0.4)
        .setStrokeStyle(3, this.theme.warning, 0.8).setDepth(20);
      this.tweens.add({ targets: hotspot, scale: { from: 1, to: 1.15 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.add.text(label.x, label.y, String(i + 1), {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
      hotspot.setData('speakText', `Spot ${i + 1}: ${label.text}`);
    });

    this.hintText = this.add.text(this.scale.width / 2, this.scale.height - 30, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(100);

    this.createDragLabels();
    this.setupGlobalPointer((x, y) => { if (this.draggingLabel) { this.draggingLabel.container.setPosition(x, y); } });
  }

  private draggingLabel?: DragLabel;

  protected onTick(_remainingMs: number) {}

  private createDragLabels() {
    const shuffled = [...this.labels].sort(() => Math.random() - 0.5);
    const labelY = this.scale.height - 60;
    const totalW = this.scale.width - 80;
    const slotW = totalW / shuffled.length;
    shuffled.forEach((label, i) => {
      const x = 40 + slotW * i + slotW / 2;
      const bg = this.add.rectangle(0, 0, Math.min(120, slotW - 10), 36, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.6);
      const numBadge = this.add.circle(-50, 0, 12, this.theme.accent, 0.9);
      const numText = this.add.text(-50, 0, String(i + 1), { fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      const txt = this.add.text(10, 0, label.text, { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.text), fontStyle: 'bold' }).setOrigin(0.5);
      const container = this.add.container(x, labelY, [bg, numBadge, numText, txt]).setSize(120, 36).setDepth(60).setInteractive({ useHandCursor: true });
      txt.setData('speakText', label.text); numText.setData('speakText', `Label ${i + 1}: ${label.text}`);
      const dragLabel: DragLabel = { id: label.id, text: label.text, container, startX: x, startY: labelY, isPlaced: false };
      this.dragLabels.push(dragLabel);
      container.on('pointerdown', () => { if (dragLabel.isPlaced) return; this.draggingLabel = dragLabel; container.setScale(1.1).setDepth(100); audioBus.play('tap'); });
      container.on('pointerup', () => { if (this.draggingLabel !== dragLabel) return; this.draggingLabel = undefined; container.setScale(1).setDepth(60); this.checkPlacement(dragLabel); });
    });
  }

  private checkPlacement(dragLabel: DragLabel) {
    const target = this.labels.find(l => l.id === dragLabel.id);
    if (!target) { this.tweens.add({ targets: dragLabel.container, x: dragLabel.startX, y: dragLabel.startY, duration: 300, ease: 'Back.out' }); return; }
    const dist = Math.sqrt((dragLabel.container.x - target.x) ** 2 + (dragLabel.container.y - target.y) ** 2);
    if (dist < 40) {
      dragLabel.isPlaced = true; target.placed = true;
      this.tweens.add({ targets: dragLabel.container, x: target.x, y: target.y, duration: 200, ease: 'Back.out' });
      (dragLabel.container.list[0] as any).setFillStyle(this.theme.success, 0.9);
      this.recordAnswer({ term: dragLabel.text, response: 'placed', success: true, coordinate: { x: target.x, y: target.y, t: this.time.now } });
      this.hintText.setText(`✓ ${dragLabel.text} placed correctly!`);
      audioBus.speak(dragLabel.text);
      if (this.labels.every(l => l.placed)) this.time.delayedCall(800, () => this.finishGame(true));
    } else {
      this.tweens.add({ targets: dragLabel.container, x: dragLabel.startX, y: dragLabel.startY, duration: 300, ease: 'Back.out' });
      this.recordAnswer({ term: dragLabel.text, response: 'wrong spot', success: false, coordinate: { x: dragLabel.container.x, y: dragLabel.container.y, t: this.time.now } });
      this.hintText.setText('✗ Not quite — try again!');
    }
  }
}
