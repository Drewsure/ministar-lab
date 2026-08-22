import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ENDLESS RUNNER — 3 lanes, switch to hit correct word, speed ramps per level
// RESEARCH: "Endless runner difficulty increments at same pace as player progresses"
// RESEARCH: "Introduce all obstacles gradually in early stages, then make more difficult"
// FIX: Clear visible instructions, no infinite tweens, capped audio frequency,
// slower starting speed, proper lane labels, tap-to-speak on all text.

export default class EndlessRunnerScene extends BaseEngine {
  private player!: Phaser.GameObjects.Text;
  private playerLane = 1;
  // Lane X positions — computed dynamically in buildWorld() so the lanes
  // are always centered across the canvas. Was hardcoded [200,400,600]
  // which only worked on 800px-wide canvases (the old fixed size).
  private laneX: number[] = [0, 0, 0];
  private currentPrompt?: { term: TermItem; options: TermItem[]; correctLane: number; y: number };
  private speed = 30; // AAAA KIDS MODE: Gentler start (was 40)
  private strikes = 0;
  private maxStrikes = 3;
  private distance = 0;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private strikesText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private laneLabels: Phaser.GameObjects.Text[] = [];
  private instructionsText!: Phaser.GameObjects.Text;
  private canSwitch = true;
  // Track the top/bottom of the play area so lane dividers + spawn point
  // scale with the canvas (was hardcoded 180 / 580).
  private playTopY = 180;
  private playBottomY = 580;

  protected maxQuestions() { return 15; }

  protected buildWorld() {
    const W = this.scale.width;
    const H = this.scale.height;

    // LANE POSITIONS — span ~60% of canvas width, centered.
    // Old hardcoded [200, 400, 600] left the right half empty on big monitors.
    // Now: 3 lanes spread across the middle 60% of the canvas, centered.
    const laneSpan = W * 0.60;
    const laneGap = laneSpan / 2; // distance between adjacent lanes
    const laneCenterX = W / 2;
    this.laneX = [
      laneCenterX - laneGap, // LEFT lane
      laneCenterX,            // CENTER lane
      laneCenterX + laneGap, // RIGHT lane
    ];

    // PLAY AREA — top below HUD/prompt, bottom above player.
    // Scales with canvas height so lane dividers extend properly on tall screens.
    this.playTopY = 200;
    this.playBottomY = H - 120;

    this.add.text(W / 2, 55, '🏃 Endless Runner', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt — "Which word means: X?"
    this.promptBg = this.add.rectangle(W / 2, 110, Math.min(700, W - 80), 60, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(W / 2, 110, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: Math.min(660, W - 120) },
    }).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText);

    // Strikes + distance
    this.strikesText = this.add.text(20, 155, '❤❤❤', { fontFamily: 'Inter, sans-serif', fontSize: '20px' }).setDepth(50);
    this.distanceText = this.add.text(W - 20, 155, '0m', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Lane dividers — 4 vertical lines bounding the 3 lanes, extending from
    // playTop to playBottom. Now centered + scaled.
    const dividerLeft = this.laneX[0] - (laneGap / 2);
    const dividerRight = this.laneX[2] + (laneGap / 2);
    for (let i = 0; i < 4; i++) {
      const x = dividerLeft + i * (dividerRight - dividerLeft) / 3;
      const line = this.add.graphics();
      line.lineStyle(2, this.theme.accent, 0.2);
      line.beginPath();
      line.moveTo(x, this.playTopY);
      line.lineTo(x, this.playBottomY);
      line.strokePath();
      line.setDepth(1);
    }

    // Lane labels (LEFT / CENTER / RIGHT) — placed at the bottom of the play area
    const labels = ['◀ LEFT', 'CENTER', 'RIGHT ▶'];
    labels.forEach((label, i) => {
      const t = this.add.text(this.laneX[i], this.playBottomY - 20, label, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: this.hex(this.theme.textMuted),
      }).setOrigin(0.5).setDepth(50).setAlpha(0.5);
      this.laneLabels.push(t);
    });

    // Instructions — clear and visible
    this.instructionsText = this.add.text(W / 2, 200,
      'Tap LEFT or RIGHT side of screen to switch lanes!\nCatch the word that matches the meaning above!',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.warning),
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(50).setAlpha(0.7);
    this.makeHoverSpeakable(this.instructionsText, 'Tap left or right side of screen to switch lanes! Catch the word that matches the meaning!');

    // Player — sits at the bottom of the center lane, on whichever lane is active
    this.player = this.add.text(this.laneX[this.playerLane], H - 80, '🏃', { fontSize: '40px' }).setOrigin(0.5).setDepth(100);
    // Player glow (finite tween, not infinite) — follows the active lane
    const glow = this.add.circle(this.laneX[this.playerLane], H - 40, 30, this.theme.accent, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(99);
    this.events.on('update', () => { if (glow && glow.active) glow.x = this.laneX[this.playerLane]; });

    // Input
    this.input.keyboard?.on('keydown-LEFT', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.switchLane(1));
    this.input.keyboard?.on('keydown-A', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-D', () => this.switchLane(1));

    this.setupGlobalPointer((x, y) => {
      if (y < this.playTopY) return; // ignore taps on prompt area
      if (x < W / 2) this.switchLane(-1); else this.switchLane(1);
    });

    // DRAMA: On-screen LEFT/RIGHT buttons for mobile — BIG tap targets
    // Now positioned at canvas corners (not hardcoded x=80).
    const btnMargin = Math.max(60, W * 0.06);
    const leftBtn = this.add.text(btnMargin, H - 60, '◀', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px', color: '#ffffff',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 28, y: 16 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    leftBtn.on('pointerdown', () => this.switchLane(-1));

    const rightBtn = this.add.text(W - btnMargin, H - 60, '▶', {
      fontFamily: 'Inter, sans-serif', fontSize: '40px', color: '#ffffff',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 28, y: 16 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(400).setInteractive({ useHandCursor: true });
    rightBtn.on('pointerdown', () => this.switchLane(1));

    this.spawnNextPrompt();
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.currentPrompt) return;
    // PHYSICS FIX: Frame-rate independent using actual delta time.
    // Was: speed * 0.016 (hardcoded 60fps — breaks on 120Hz/30fps displays)
    const dt = this.game.loop.delta / 1000;
    this.currentPrompt.y += this.speed * dt;
    this.optionTexts.forEach((t) => { if (t && t.active) t.y = this.currentPrompt!.y; });
    if (this.currentPrompt.y >= this.playBottomY) this.checkAnswer();
    this.distance += this.speed * dt * 0.1;
    this.distanceText.setText(`${Math.floor(this.distance)}m`);
    // FIX: Slower speed cap + level-based cap (was 200, now 120 + level*20)
    // AAAA KIDS MODE — Gentler speed ramp for ages 4-9 + slow mode support.
    // Was: maxSpeed = 120 + (level-1)*20, growth = 0.4/m.
    // Now: maxSpeed = 70 + (level-1)*8, growth = 0.15/m.
    const tm = this.timeMultiplier();
    const maxSpeed = (70 + (this.level - 1) * 8) * tm;
    this.speed = Math.min(maxSpeed, (30 + this.distance * 0.15) * tm);
  }

  private switchLane(dir: number) {
    if (this.isFinished || !this.canSwitch) return;
    const newLane = this.playerLane + dir;
    if (newLane < 0 || newLane > 2) return;
    this.playerLane = newLane;
    this.canSwitch = false;
    audioBus.play('tap');
    this.tweens.add({ targets: this.player, x: this.laneX[this.playerLane], duration: 120, ease: 'Quad.out' });
    this.player.setAngle(dir * 15);
    this.time.delayedCall(150, () => {
      if (this.isFinished) return;
      this.player.setAngle(0);
      this.canSwitch = true;
    });
    // Hide instructions after first move
    if (this.instructionsText && this.instructionsText.alpha > 0) {
      this.tweens.add({ targets: this.instructionsText, alpha: 0, duration: 300 });
    }
  }

  private spawnNextPrompt() {
    if (this.score >= this.maxScore) { this.finishGame(true); return; }
    const prompt = this.terms[Math.floor(Math.random() * this.terms.length)];
    const distractors = this.terms.filter(t => t.id !== prompt.id);
    Phaser.Utils.Array.Shuffle(distractors);
    const options = [prompt, ...distractors.slice(0, 2)];
    Phaser.Utils.Array.Shuffle(options);
    const correctLane = options.findIndex(o => o.id === prompt.id);
    this.currentPrompt = { term: prompt, options, correctLane, y: 200 };

    const def = prompt.definition ?? prompt.emoji ?? prompt.term;
    this.promptText.setText(`Which word means: "${def}"?`);
    this.makeHoverSpeakable(this.promptText, `Which word means: ${def}?`);
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.time.delayedCall(400, () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.promptText, `Which word means: ${def}?`, { isQuestion: true });
    });

    this.optionTexts.forEach(t => t?.destroy());
    this.optionTexts = [];
    this.currentPrompt.options.forEach((opt, i) => {
      const t = this.add.text(this.laneX[i], this.currentPrompt!.y, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'), padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(40);
      this.makeHoverSpeakable(t, opt.term);
      this.optionTexts.push(t);
    });
  }

  private checkAnswer() {
    if (!this.currentPrompt) return;
    const isCorrect = this.playerLane === this.currentPrompt.correctLane;
    const opt = this.currentPrompt.options[this.playerLane];
    this.recordAnswer({ term: this.currentPrompt.term.term, response: opt.term, success: isCorrect,
      coordinate: { x: this.laneX[this.playerLane], y: this.currentPrompt.y, t: this.time.now } });
    if (isCorrect) { this.destroyOptions(); this.spawnNextPrompt(); }
    else {
      this.strikes++;
      this.strikesText.setText('❤'.repeat(this.maxStrikes - this.strikes) + '🖤'.repeat(this.strikes));
      audioBus.play('incorrect');
      this.juice.shake('medium');
      if (this.strikes >= this.maxStrikes) { this.destroyOptions(); this.finishGame(false); }
      else { this.destroyOptions(); this.spawnNextPrompt(); }
    }
  }

  private destroyOptions() {
    this.optionTexts.forEach(t => { if (t) { try { t.destroy(); } catch {} } });
    this.optionTexts = [];
    this.currentPrompt = undefined;
  }
}
