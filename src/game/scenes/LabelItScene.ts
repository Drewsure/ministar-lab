import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// LABEL IT — Students drag text labels onto hotspots on a teacher-uploaded image
// ============================================================================
// Teacher uploads a diagram (e.g. a plant, a map, a body) and defines label
// positions. Students drag the correct label to each hotspot.
// ============================================================================

interface LabelItem {
  id: string;
  text: string;
  x: number;       // target X (game coords, 0-800)
  y: number;       // target Y (game coords, 0-600)
  placed: boolean;
}

interface DragLabel {
  id: string;
  text: string;
  container: Phaser.GameObjects.Container;
  startX: number;
  startY: number;
  isPlaced: boolean;
}

export default class LabelItScene extends BaseEngine {
  private labels: LabelItem[] = [];
  private dragLabels: DragLabel[] = [];
  private imageKey = 'label-it-image';
  private imageUrl?: string;
  private imageObject?: Phaser.GameObjects.Image;
  private draggingLabel?: DragLabel;
  private hintText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return this.labels.length || 5; }

  protected buildWorld() {
    // Extract image URL + labels from the launch config
    const cfg = this.registry.get('launchConfig') as any;
    this.imageUrl = cfg.imageUrl;
    this.labels = (cfg.labels ?? []).map((l: any, i: number) => ({
      id: l.id ?? `label-${i}`,
      text: l.text,
      x: l.x ?? 100 + (i * 120),
      y: l.y ?? 100,
      placed: false,
    }));

    // Title
    this.add.text(
      this.scale.width / 2, 105,
      'Label It!',
      { fontFamily: 'Inter, sans-serif', fontSize: '30px', color: this.hex(this.theme.accent), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(50);

    this.add.text(
      this.scale.width / 2, 140,
      'Drag each label to the correct spot on the image',
      { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted) }
    ).setOrigin(0.5).setDepth(50);

    // Load the image if provided
    if (this.imageUrl) {
      this.load.image(this.imageKey, this.imageUrl);
      this.load.once('complete', () => {
        this.createImageAndLabels();
      });
      this.load.start();
    } else {
      // No image — show a placeholder with hotspots only
      this.createPlaceholder();
      this.createDragLabels();
    }

    // Hint text
    this.hintText = this.add.text(
      this.scale.width / 2, this.scale.height - 30,
      '',
      { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted) }
    ).setOrigin(0.5).setDepth(100);

    // Global pointer handler for dragging
    this.setupGlobalPointer((x, y) => {
      // If dragging, update label position
      if (this.draggingLabel) {
        this.draggingLabel.container.setPosition(x, y);
        return;
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  private createImageAndLabels() {
    // Add the image, scaled to fit the game area (max 600x350, centered)
    const imgY = 180;
    const maxW = 600, maxH = 350;
    try {
      this.imageObject = this.add.image(this.scale.width / 2, imgY + maxH / 2, this.imageKey);
      const tex = this.textures.get(this.imageKey).getSourceImage();
      const scale = Math.min(maxW / tex.width, maxH / tex.height);
      this.imageObject.setScale(scale).setDepth(10);
    } catch {
      this.createPlaceholder();
    }

    // Draw target hotspots on the image
    this.labels.forEach(label => {
      const hotspot = this.add.circle(label.x, label.y, 18, this.theme.warning, 0.3)
        .setStrokeStyle(3, this.theme.warning, 0.8).setDepth(20);
      // Pulse animation
      this.tweens.add({
        targets: hotspot,
        scale: { from: 1, to: 1.15 },
        duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
      // Number badge on the hotspot
      const idx = this.labels.indexOf(label) + 1;
      this.add.text(label.x, label.y, String(idx), {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
      // Make hotspot tappable for tap-to-speak
      hotspot.setData('speakText', `Spot ${idx}: ${label.text}`);
    });

    this.createDragLabels();
  }

  private createPlaceholder() {
    // If no image, just show a bordered box
    const imgY = 180;
    this.add.rectangle(this.scale.width / 2, imgY + 175, 600, 350, this.theme.card, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.4).setDepth(10);
    this.add.text(this.scale.width / 2, imgY + 175, 'No image\nTeacher can upload a diagram', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
      align: 'center',
    }).setOrigin(0.5).setDepth(11);

    // Draw hotspots anyway
    this.labels.forEach(label => {
      const hotspot = this.add.circle(label.x, label.y, 18, this.theme.warning, 0.3)
        .setStrokeStyle(3, this.theme.warning, 0.8).setDepth(20);
      const idx = this.labels.indexOf(label) + 1;
      this.add.text(label.x, label.y, String(idx), {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
    });
  }

  private createDragLabels() {
    // Create draggable labels at the bottom of the screen, shuffled
    const shuffled = [...this.labels].sort(() => Math.random() - 0.5);
    const labelY = this.scale.height - 60;
    const totalW = this.scale.width - 80;
    const slotW = totalW / shuffled.length;

    shuffled.forEach((label, i) => {
      const x = 40 + slotW * i + slotW / 2;

      const bg = this.add.rectangle(0, 0, Math.min(120, slotW - 10), 36, this.theme.card, 0.9)
        .setStrokeStyle(2, this.theme.accent, 0.6);
      const numBadge = this.add.circle(-50, 0, 12, this.theme.accent, 0.9);
      const numText = this.add.text(-50, 0, String(i + 1), {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const txt = this.add.text(10, 0, label.text, {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(x, labelY, [bg, numBadge, numText, txt])
        .setSize(120, 36).setDepth(60).setInteractive({ useHandCursor: true });

      // Make text + badge speakable (tap-to-hear)
      txt.setData('speakText', label.text);
      numText.setData('speakText', `Label ${i + 1}: ${label.text}`);

      const dragLabel: DragLabel = {
        id: label.id,
        text: label.text,
        container,
        startX: x,
        startY: labelY,
        isPlaced: false,
      };
      this.dragLabels.push(dragLabel);

      // Drag handlers
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (dragLabel.isPlaced) return;
        this.draggingLabel = dragLabel;
        container.setScale(1.1).setDepth(100);
        audioBus.play('tap');
      });

      container.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (this.draggingLabel !== dragLabel) return;
        this.draggingLabel = undefined;
        container.setScale(1).setDepth(60);
        this.checkPlacement(dragLabel, pointer.x, pointer.y);
      });
    });
  }

  private checkPlacement(dragLabel: DragLabel, x: number, y: number) {
    // Find the closest target hotspot
    const target = this.labels.find(l => l.id === dragLabel.id);
    if (!target) {
      // Snap back
      this.tweens.add({
        targets: dragLabel.container,
        x: dragLabel.startX, y: dragLabel.startY,
        duration: 300, ease: 'Back.out',
      });
      return;
    }

    const dist = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
    if (dist < 40) {
      // Correct placement!
      dragLabel.isPlaced = true;
      target.placed = true;
      this.tweens.add({
        targets: dragLabel.container,
        x: target.x, y: target.y,
        duration: 200, ease: 'Back.out',
      });
      // Change label color to success
      const bg = dragLabel.container.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(this.theme.success, 0.9);

      this.recordAnswer({
        term: dragLabel.text,
        response: 'placed',
        success: true,
        coordinate: { x: target.x, y: target.y, t: this.time.now },
      });

      this.hintText.setText(`✓ ${dragLabel.text} placed correctly!`);
      audioBus.speak(dragLabel.text);

      // Check if all labels placed
      if (this.labels.every(l => l.placed)) {
        this.time.delayedCall(800, () => this.finishGame(true));
      }
    } else {
      // Wrong spot — snap back
      this.tweens.add({
        targets: dragLabel.container,
        x: dragLabel.startX, y: dragLabel.startY,
        duration: 300, ease: 'Back.out',
      });
      this.recordAnswer({
        term: dragLabel.text,
        response: 'wrong spot',
        success: false,
        coordinate: { x, y, t: this.time.now },
      });
      this.hintText.setText('✗ Not quite — try again!');
    }
  }
}
