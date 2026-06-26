import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// TRAINING ACADEMY — Simon Says with speech-to-text. Say commands to make mascot move.

interface TrainingCommand { text: string; emoji: string; action: 'jump' | 'spin' | 'dance' | 'wave' | 'sit' | 'run'; }
const COMMANDS: TrainingCommand[] = [
  { text: 'Jump', emoji: '⬆️', action: 'jump' },
  { text: 'Spin', emoji: '🔄', action: 'spin' },
  { text: 'Dance', emoji: '💃', action: 'dance' },
  { text: 'Wave', emoji: '👋', action: 'wave' },
  { text: 'Sit', emoji: '🪑', action: 'sit' },
  { text: 'Run', emoji: '🏃', action: 'run' },
];

export default class TrainingAcademyScene extends BaseEngine {
  private currentCommand?: TrainingCommand;
  private commandText!: Phaser.GameObjects.Text;
  private mascot!: Phaser.GameObjects.Text;
  private recognition: any = null;
  private isListening = false;
  private micButton!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private heardText!: Phaser.GameObjects.Text;
  private canAnswer = true;
  private round = 0;

  protected maxQuestions() { return 10; }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 105, 'Training Academy', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(this.scale.width / 2, 140, 'Say the command to make the mascot move!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    this.commandText = this.add.text(this.scale.width / 2, 220, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '48px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.makeSpeakable(this.commandText);

    this.mascot = this.add.text(this.scale.width / 2, this.scale.height / 2, '🐶', { fontSize: '96px' }).setOrigin(0.5).setDepth(50);
    this.statusText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.textMuted), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.heardText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 140, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted), fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(50);

    const micBg = this.add.circle(0, 0, 35, this.theme.accent, 0.9).setStrokeStyle(3, 0xffffff, 0.6);
    const micIcon = this.add.text(0, 0, '🎤', { fontSize: '28px' }).setOrigin(0.5);
    this.micButton = this.add.container(this.scale.width / 2, this.scale.height - 80, [micBg, micIcon])
      .setSize(70, 70).setInteractive({ useHandCursor: true }).setDepth(60);
    this.micButton.on('pointerover', () => this.micButton.setScale(1.1));
    this.micButton.on('pointerout', () => this.micButton.setScale(1));
    this.micButton.on('pointerdown', () => { audioBus.play('tap'); if (this.isListening) this.stopListening(); else this.startListening(); });

    this.initSpeechRecognition();
    this.nextCommand();
  }

  protected onTick(_remainingMs: number) {}

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
    try {
      this.recognition.start(); this.isListening = true; this.micButton.setScale(1.2);
      (this.micButton.list[0] as any).setFillStyle(this.theme.danger, 0.9);
      this.statusText.setText('Listening... Say the command!'); this.heardText.setText('');
    } catch (e: any) { this.statusText.setText('Mic error: ' + e.message); }
  }

  private stopListening() { if (this.recognition) { try { this.recognition.stop(); } catch {} } this.isListening = false; this.micButton.setScale(1); (this.micButton.list[0] as any).setFillStyle(this.theme.accent, 0.9); }

  private nextCommand() {
    if (this.round >= this.maxScore) { this.finishGame(true); return; }
    this.canAnswer = true;
    this.currentCommand = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    this.commandText.setText(`${this.currentCommand.emoji} ${this.currentCommand.text}!`);
    this.commandText.setData('speakText', `Say: ${this.currentCommand.text}!`);
    this.statusText.setText('Tap the microphone and speak!'); this.heardText.setText('');
    audioBus.speak(`Say: ${this.currentCommand.text}!`);
  }

  private checkCommand(heard: string) {
    if (!this.canAnswer || !this.currentCommand) return;
    this.canAnswer = false; this.stopListening();
    const target = this.currentCommand.text.toLowerCase();
    const heardClean = heard.toLowerCase().replace(/[^a-z]/g, '');
    const isCorrect = heardClean === target || heardClean.includes(target) || target.includes(heardClean);
    this.recordAnswer({ term: this.currentCommand.text, response: heard, success: isCorrect,
      coordinate: { x: this.scale.width / 2, y: this.scale.height / 2, t: this.time.now } });
    if (isCorrect) { this.statusText.setText('✓ Perfect!'); this.statusText.setColor(this.hex(this.theme.success)); this.animateMascot(this.currentCommand.action); audioBus.speak(this.currentCommand.text); }
    else { this.statusText.setText(`✗ You said "${heard}". Say "${this.currentCommand.text}"`); this.statusText.setColor(this.hex(this.theme.danger)); audioBus.speak(this.currentCommand.text); }
    this.round++;
    this.time.delayedCall(2500, () => { if (!this.isFinished) this.nextCommand(); });
  }

  private animateMascot(action: string) {
    const m = this.mascot;
    switch (action) {
      case 'jump': this.tweens.add({ targets: m, y: '-=80', duration: 300, yoyo: true, repeat: 2, ease: 'Quad.out' }); break;
      case 'spin': this.tweens.add({ targets: m, angle: 360, duration: 800, ease: 'Cubic.out' }); break;
      case 'dance': this.tweens.add({ targets: m, x: '+=20', duration: 200, yoyo: true, repeat: 5, ease: 'Sine.inOut' }); this.tweens.add({ targets: m, angle: 15, duration: 200, yoyo: true, repeat: 5 }); break;
      case 'wave': this.tweens.add({ targets: m, angle: -20, duration: 200, yoyo: true, repeat: 3 }); break;
      case 'sit': this.tweens.add({ targets: m, scaleY: 0.7, duration: 400, yoyo: true, ease: 'Cubic.out' }); break;
      case 'run': this.tweens.add({ targets: m, x: '+=100', duration: 300, yoyo: true, ease: 'Cubic.out' }); break;
    }
  }
}
