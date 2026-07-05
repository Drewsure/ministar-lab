import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// RESCUE QUEST — Voice-activated. Say verbs to clear obstacles and rescue the character.

interface Obstacle { type: string; command: string; emoji: string; x: number; y: number; cleared: boolean; text: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; }
const OBSTACLE_TYPES = [
  { type: 'wall', command: 'Climb', emoji: '🧱', label: 'Climb the wall' },
  { type: 'river', command: 'Swim', emoji: '🌊', label: 'Swim across' },
  { type: 'cliff', command: 'Jump', emoji: '⛰️', label: 'Jump the gap' },
  { type: 'cage', command: 'Open', emoji: '🔒', label: 'Open the cage' },
  { type: 'fire', command: 'Stop', emoji: '🔥', label: 'Stop the fire' },
  { type: 'rock', command: 'Push', emoji: '🪨', label: 'Push the rock' },
];

export default class RescueQuestScene extends BaseEngine {
  private obstacles: Obstacle[] = [];
  private hero!: Phaser.GameObjects.Text;
  private target!: Phaser.GameObjects.Text;
  private heroX = 100;
  private currentObstacleIdx = 0;
  private recognition: any = null;
  private isListening = false;
  private micButton!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private heardText!: Phaser.GameObjects.Text;
  private canAnswer = true;

  protected maxQuestions() { return Math.min(6, OBSTACLE_TYPES.length); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 105, 'Rescue Quest', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(this.scale.width / 2, 140, 'Say the action word to rescue the character!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    this.hero = this.add.text(this.heroX, 400, '🦸', { fontSize: '48px' }).setOrigin(0.5).setDepth(100);
    this.target = this.add.text(this.scale.width - 80, 400, '🐰', { fontSize: '48px' }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: this.target, scale: { from: 1, to: 1.15 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.statusText = this.add.text(this.scale.width / 2, this.scale.height - 140, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.heardText = this.add.text(this.scale.width / 2, this.scale.height - 105, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted), fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(50);

    this.createObstacles();
    const micBg = this.add.circle(0, 0, 30, this.theme.accent, 0.9).setStrokeStyle(3, 0xffffff, 0.6);
    const micIcon = this.add.text(0, 0, '🎤', { fontSize: '24px' }).setOrigin(0.5);
    this.micButton = this.add.container(this.scale.width / 2, this.scale.height - 60, [micBg, micIcon])
      .setSize(60, 60).setInteractive({ useHandCursor: true }).setDepth(60);
    this.micButton.on('pointerover', () => this.micButton.setScale(1.1));
    this.micButton.on('pointerout', () => this.micButton.setScale(1));
    this.micButton.on('pointerdown', () => { audioBus.play('tap'); if (this.isListening) this.stopListening(); else this.startListening(); });

    this.initSpeechRecognition();
    this.updateCurrentObstacle();
  }

  protected onTick(_remainingMs: number) {}

  private createObstacles() {
    const count = this.maxScore;
    const startX = 180, gap = (this.scale.width - 260) / count;
    for (let i = 0; i < count; i++) {
      const obsType = OBSTACLE_TYPES[i % OBSTACLE_TYPES.length];
      const x = startX + i * gap, y = 400;
      const text = this.add.text(x, y, obsType.emoji, { fontSize: '40px' }).setOrigin(0.5).setDepth(50);
      const label = this.add.text(x, y - 40, obsType.label, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: this.hex(this.theme.textMuted),
      }).setOrigin(0.5).setDepth(50).setAlpha(0);
      this.obstacles.push({ type: obsType.type, command: obsType.command, emoji: obsType.emoji, x, y, cleared: false, text, label });
    }
  }

  private updateCurrentObstacle() {
    if (this.currentObstacleIdx >= this.obstacles.length) { this.finishGame(true); return; }
    const obs = this.obstacles[this.currentObstacleIdx];
    this.canAnswer = true;
    const labelText = obs.label.text;
    this.statusText.setText(`Say "${obs.command}" to ${labelText.toLowerCase()}`);
    this.heardText.setText('');
    this.obstacles.forEach((o, i) => {
      o.label.setAlpha(i === this.currentObstacleIdx ? 1 : 0);
      if (i === this.currentObstacleIdx) this.tweens.add({ targets: o.text, scale: { from: 1, to: 1.2 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    audioBus.speak(`Say ${obs.command} to ${labelText.toLowerCase()}`);
  }

  private initSpeechRecognition() {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { this.statusText.setText('Speech recognition not available'); return; }
      this.recognition = new SR();
      this.recognition.lang = 'en-US'; this.recognition.continuous = false; this.recognition.interimResults = true; this.recognition.maxAlternatives = 3;
      this.recognition.onresult = (event: any) => {
        let heard = '';
        for (let i = event.resultIndex; i < event.results.length; i++) heard += event.results[i][0].transcript;
        this.heardText.setText(`Heard: "${heard.trim()}"`);
        if (event.results[event.results.length - 1].isFinal) this.checkCommand(heard.trim());
      };
      this.recognition.onerror = (event: any) => { this.isListening = false; this.micButton.setScale(1); this.statusText.setText('Mic error'); };
      this.recognition.onend = () => { this.isListening = false; this.micButton.setScale(1); (this.micButton.list[0] as any).setFillStyle(this.theme.accent, 0.9); };
    } catch {}
  }

  private startListening() {
    if (!this.recognition || !this.canAnswer) return;
    try { this.recognition.start(); this.isListening = true; this.micButton.setScale(1.2); (this.micButton.list[0] as any).setFillStyle(this.theme.danger, 0.9); this.statusText.setText('Listening...'); } catch (e: any) { this.statusText.setText('Mic error'); }
  }

  private stopListening() { if (this.recognition) { try { this.recognition.stop(); } catch {} } this.isListening = false; this.micButton.setScale(1); (this.micButton.list[0] as any).setFillStyle(this.theme.accent, 0.9); }

  private checkCommand(heard: string) {
    if (!this.canAnswer) return;
    this.canAnswer = false; this.stopListening();
    const obs = this.obstacles[this.currentObstacleIdx];
    const target = obs.command.toLowerCase();
    const heardClean = heard.toLowerCase().replace(/[^a-z]/g, '');
    const isCorrect = heardClean === target || heardClean.includes(target) || target.includes(heardClean);
    this.recordAnswer({ term: obs.command, response: heard, success: isCorrect, coordinate: { x: obs.x, y: obs.y, t: this.time.now } });
    if (isCorrect) { this.statusText.setText(`✓ ${obs.command}! Obstacle cleared!`); this.statusText.setColor(this.hex(this.theme.success)); this.clearObstacle(obs); audioBus.speak(obs.command); }
    else { this.statusText.setText(`✗ You said "${heard}". Say "${obs.command}"`); this.statusText.setColor(this.hex(this.theme.danger)); audioBus.speak(obs.command); }
    this.time.delayedCall(2000, () => { if (this.isFinished) return; if (isCorrect) this.currentObstacleIdx++; this.updateCurrentObstacle(); });
  }

  private clearObstacle(obs: Obstacle) {
    obs.cleared = true;
    this.tweens.add({ targets: [obs.text, obs.label], alpha: 0, scale: 0, y: '-=30', duration: 400, ease: 'Back.in' });
    this.tweens.add({ targets: this.hero, x: obs.x + 40, duration: 600, ease: 'Cubic.out' });
    this.heroX = obs.x + 40;
    this.juice.burst(obs.x, obs.y, 'correct');
  }
}
