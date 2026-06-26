import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ENDLESS RUNNER — 3 lanes, switch to hit correct word, speed ramps per level

export default class EndlessRunnerScene extends BaseEngine {
  private player!: Phaser.GameObjects.Text;
  private playerLane = 1;
  private laneX = [200, 400, 600];
  private currentPrompt?: { term: TermItem; options: TermItem[]; correctLane: number; y: number };
  private speed = 60;
  private strikes = 0;
  private maxStrikes = 3;
  private distance = 0;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private strikesText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];

  protected maxQuestions() { return 15; }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 105, 'Endless Runner', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 170, 700, 60, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 170, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 660 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this.strikesText = this.add.text(20, 220, '❤❤❤', { fontFamily: 'Inter, sans-serif', fontSize: '20px' }).setDepth(50);
    this.distanceText = this.add.text(this.scale.width - 20, 220, '0m', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    this.player = this.add.text(this.laneX[this.playerLane], this.scale.height - 80, '🏃', { fontSize: '40px' }).setOrigin(0.5).setDepth(100);
    const glow = this.add.circle(this.laneX[this.playerLane], this.scale.height - 40, 30, this.theme.accent, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(99);
    this.tweens.add({ targets: glow, scale: { from: 1, to: 1.2 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.events.on('update', () => { glow.x = this.laneX[this.playerLane]; });

    this.input.keyboard?.on('keydown-LEFT', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.switchLane(1));
    this.input.keyboard?.on('keydown-A', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-D', () => this.switchLane(1));

    this.setupGlobalPointer((x, y) => {
      if (x < this.scale.width / 2) this.switchLane(-1); else this.switchLane(1);
    });

    this.spawnNextPrompt();
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.currentPrompt) return;
    this.currentPrompt.y += this.speed * 0.016;
    this.optionTexts.forEach((t, i) => { if (t) t.y = this.currentPrompt!.y; });
    if (this.currentPrompt.y >= this.scale.height - 100) this.checkAnswer();
    this.distance += this.speed * 0.016 * 0.1;
    this.distanceText.setText(`${Math.floor(this.distance)}m`);
    this.speed = Math.min(200, 60 + this.distance * 0.5);
  }

  private switchLane(dir: number) {
    if (this.isFinished) return;
    const newLane = this.playerLane + dir;
    if (newLane < 0 || newLane > 2) return;
    this.playerLane = newLane;
    audioBus.play('tap');
    this.tweens.add({ targets: this.player, x: this.laneX[this.playerLane], duration: 150, ease: 'Quad.out' });
    this.player.setAngle(dir * 15);
    this.time.delayedCall(150, () => this.player.setAngle(0));
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
    this.promptText.setData('speakText', `Which word means: ${def}?`);
    this.promptBg.setData('speakText', `Which word means: ${def}?`);

    this.optionTexts.forEach(t => t?.destroy());
    this.optionTexts = [];
    this.currentPrompt.options.forEach((opt, i) => {
      const t = this.add.text(this.laneX[i], this.currentPrompt!.y, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'), padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(40);
      t.setData('speakText', opt.term);
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
      audioBus.play('incorrect'); this.juice.shake('medium');
      if (this.strikes >= this.maxStrikes) { this.destroyOptions(); this.finishGame(false); }
      else { this.destroyOptions(); this.spawnNextPrompt(); }
    }
  }

  private destroyOptions() {
    this.optionTexts.forEach(t => { if (t) this.tweens.add({ targets: t, alpha: 0, scale: 0.5, duration: 200, onComplete: () => t.destroy() }); });
    this.optionTexts = [];
    this.currentPrompt = undefined;
  }
}
