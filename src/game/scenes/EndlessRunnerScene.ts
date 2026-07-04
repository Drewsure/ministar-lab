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
  private laneX = [200, 400, 600];
  private currentPrompt?: { term: TermItem; options: TermItem[]; correctLane: number; y: number };
  private speed = 40; // FIX: Slower start (was 60)
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

  protected maxQuestions() { return 15; }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 55, '🏃 Endless Runner', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt — "Which word means: X?"
    this.promptBg = this.add.rectangle(this.scale.width / 2, 110, 700, 60, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 110, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 660 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Strikes + distance
    this.strikesText = this.add.text(20, 155, '❤❤❤', { fontFamily: 'Inter, sans-serif', fontSize: '20px' }).setDepth(50);
    this.distanceText = this.add.text(this.scale.width - 20, 155, '0m', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Lane dividers (visible lanes)
    for (let i = 0; i < 4; i++) {
      const x = 100 + i * 200;
      const line = this.add.graphics();
      line.lineStyle(2, this.theme.accent, 0.2);
      line.beginPath();
      line.moveTo(x, 180);
      line.lineTo(x, 580);
      line.strokePath();
      line.setDepth(1);
    }

    // Lane labels (LEFT / CENTER / RIGHT)
    const labels = ['◀ LEFT', 'CENTER', 'RIGHT ▶'];
    labels.forEach((label, i) => {
      const t = this.add.text(this.laneX[i], 570, label, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: this.hex(this.theme.textMuted),
      }).setOrigin(0.5).setDepth(50).setAlpha(0.5);
      this.laneLabels.push(t);
    });

    // Instructions — clear and visible
    this.instructionsText = this.add.text(this.scale.width / 2, 200,
      'Tap LEFT or RIGHT side of screen to switch lanes!\nCatch the word that matches the meaning above!',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.warning),
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(50).setAlpha(0.7);
    this.makeSpeakable(this.instructionsText, 'Tap left or right side of screen to switch lanes! Catch the word that matches the meaning!');

    // Player
    this.player = this.add.text(this.laneX[this.playerLane], this.scale.height - 80, '🏃', { fontSize: '40px' }).setOrigin(0.5).setDepth(100);
    // Player glow (finite tween, not infinite)
    const glow = this.add.circle(this.laneX[this.playerLane], this.scale.height - 40, 30, this.theme.accent, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(99);
    this.events.on('update', () => { if (glow && glow.active) glow.x = this.laneX[this.playerLane]; });

    // Input
    this.input.keyboard?.on('keydown-LEFT', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.switchLane(1));
    this.input.keyboard?.on('keydown-A', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-D', () => this.switchLane(1));

    this.setupGlobalPointer((x, y) => {
      if (y < 180) return; // ignore taps on prompt area
      if (x < this.scale.width / 2) this.switchLane(-1); else this.switchLane(1);
    });

    this.spawnNextPrompt();
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.currentPrompt) return;
    this.currentPrompt.y += this.speed * 0.016;
    this.optionTexts.forEach((t) => { if (t && t.active) t.y = this.currentPrompt!.y; });
    if (this.currentPrompt.y >= this.scale.height - 100) this.checkAnswer();
    this.distance += this.speed * 0.016 * 0.1;
    this.distanceText.setText(`${Math.floor(this.distance)}m`);
    // FIX: Slower speed cap + level-based cap (was 200, now 120 + level*20)
    const maxSpeed = 120 + (this.level - 1) * 20;
    this.speed = Math.min(maxSpeed, 40 + this.distance * 0.4);
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
    this.makeSpeakable(this.promptText, `Which word means: ${def}?`);

    this.optionTexts.forEach(t => t?.destroy());
    this.optionTexts = [];
    this.currentPrompt.options.forEach((opt, i) => {
      const t = this.add.text(this.laneX[i], this.currentPrompt!.y, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'), padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(40);
      this.makeSpeakable(t, opt.term);
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
