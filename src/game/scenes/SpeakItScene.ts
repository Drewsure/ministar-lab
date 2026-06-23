import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// SPEAK IT — Student SPEAKS the word aloud. Web Speech API (SpeechRecognition)
// checks if the spoken word matches the target term.
// ============================================================================
// Great for pronunciation practice + accessibility (no typing needed).
// ============================================================================

interface SpeakRound {
  prompt: TermItem;
  options: TermItem[];   // 4 options shown as text (student can also tap to hear)
}

export default class SpeakItScene extends BaseEngine {
  private round = 0;
  private rounds: SpeakRound[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private canAnswer = true;
  private micButton!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private heardText!: Phaser.GameObjects.Text;
  private recognition: any = null;
  private isListening = false;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // Build rounds
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    const count = this.maxScore;
    for (let i = 0; i < count; i++) {
      const prompt = pool[i % pool.length];
      const distractors = pool.filter(t => t.id !== prompt.id);
      Phaser.Utils.Array.Shuffle(distractors);
      const options = [prompt, ...distractors.slice(0, 3)];
      Phaser.Utils.Array.Shuffle(options);
      this.rounds.push({ prompt, options });
    }

    // Title
    this.add.text(
      this.scale.width / 2, 105,
      'Speak It!',
      { fontFamily: 'Inter, sans-serif', fontSize: '30px', color: this.hex(this.theme.accent), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(50);

    this.add.text(
      this.scale.width / 2, 140,
      'Say the word that matches the definition',
      { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: this.hex(this.theme.textMuted) }
    ).setOrigin(0.5).setDepth(50);

    // Prompt banner
    this.promptBg = this.add.rectangle(
      this.scale.width / 2, 215, 640, 70, this.theme.card, 0.85
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);

    this.promptText = this.add.text(
      this.scale.width / 2, 215, '',
      { fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.text), fontStyle: 'bold', align: 'center', wordWrap: { width: 580 } }
    ).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText, 'Tap to hear the definition');

    // Status text
    this.statusText = this.add.text(
      this.scale.width / 2, 320,
      '',
      { fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.warning), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(50);

    // Heard text (what the speech recognition heard)
    this.heardText = this.add.text(
      this.scale.width / 2, 360,
      '',
      { fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.textMuted), fontStyle: 'italic' }
    ).setOrigin(0.5).setDepth(50);

    // Microphone button (big, center)
    this.createMicButton();

    // Options (tap to hear each)
    this.createOptions();

    this.renderRound();

    // Initialize speech recognition
    this.initSpeechRecognition();
  }

  protected onTick(_remainingMs: number) { /* HUD-only */ }

  private createMicButton() {
    const cx = this.scale.width / 2;
    const cy = 450;
    const micBg = this.add.circle(0, 0, 40, this.theme.accent, 0.9)
      .setStrokeStyle(3, 0xffffff, 0.6);
    const micIcon = this.add.text(0, 0, '🎤', {
      fontFamily: 'Inter, sans-serif', fontSize: '32px',
    }).setOrigin(0.5);
    this.micButton = this.add.container(cx, cy, [micBg, micIcon])
      .setSize(80, 80).setInteractive({ useHandCursor: true }).setDepth(60);

    this.micButton.on('pointerover', () => this.micButton.setScale(1.1));
    this.micButton.on('pointerout', () => this.micButton.setScale(1));
    this.micButton.on('pointerdown', () => {
      audioBus.play('tap');
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
  }

  private createOptions() {
    // Show 4 option texts below the mic — tap any to hear it
    // (helps students who can't read the word yet)
  }

  private initSpeechRecognition() {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        this.statusText.setText('Speech recognition not available — use the Type Answer game instead');
        this.statusText.setColor(this.hex(this.theme.danger));
        return;
      }
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;

      this.recognition.onresult = (event: any) => {
        let heard = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          heard += event.results[i][0].transcript;
        }
        this.heardText.setText(`Heard: "${heard.trim()}"`);
        if (event.results[event.results.length - 1].isFinal) {
          this.checkAnswer(heard.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        this.micButton.setScale(1);
        this.statusText.setText('Microphone error: ' + (event.error ?? 'unknown'));
        this.statusText.setColor(this.hex(this.theme.danger));
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.micButton.setScale(1);
        (this.micButton.list[0] as Phaser.GameObjects.Arc).setFillStyle(this.theme.accent, 0.9);
      };
    } catch {}
  }

  private startListening() {
    if (!this.recognition || !this.canAnswer) return;
    try {
      this.recognition.start();
      this.isListening = true;
      this.micButton.setScale(1.2);
      (this.micButton.list[0] as Phaser.GameObjects.Arc).setFillStyle(this.theme.danger, 0.9);
      this.statusText.setText('Listening... Say the word!');
      this.statusText.setColor(this.hex(this.theme.warning));
      this.heardText.setText('');
    } catch (e: any) {
      this.statusText.setText('Could not start microphone: ' + e.message);
    }
  }

  private stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    this.isListening = false;
    this.micButton.setScale(1);
    (this.micButton.list[0] as Phaser.GameObjects.Arc).setFillStyle(this.theme.accent, 0.9);
  }

  private checkAnswer(heard: string) {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    this.stopListening();

    const r = this.rounds[this.round];
    const target = r.prompt.term.toLowerCase().replace(/[^a-z]/g, '');
    const heardClean = heard.toLowerCase().replace(/[^a-z]/g, '');

    // Check if the heard text contains the target word
    const isCorrect = heardClean === target || heardClean.includes(target) || target.includes(heardClean);

    this.recordAnswer({
      term: r.prompt.term,
      response: heard,
      success: isCorrect,
      coordinate: { x: this.scale.width / 2, y: 450, t: this.time.now },
    });

    if (isCorrect) {
      this.statusText.setText('✓ Correct! Great pronunciation!');
      this.statusText.setColor(this.hex(this.theme.success));
      audioBus.speak(r.prompt.term);
    } else {
      this.statusText.setText(`✗ The word was "${r.prompt.term}"`);
      this.statusText.setColor(this.hex(this.theme.danger));
      audioBus.speak(r.prompt.term);
    }

    this.time.delayedCall(2000, () => {
      this.round++;
      this.renderRound();
    });
  }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.score >= this.maxScore * 0.6);
      return;
    }
    this.canAnswer = true;
    const r = this.rounds[this.round];
    const defText = r.prompt.definition ?? r.prompt.emoji ?? r.prompt.term;
    this.promptText.setText(`Say the word for: "${defText}"`);
    this.promptText.setData('speakText', `Say the word for: ${defText}`);
    this.promptBg.setData('speakText', `Say the word for: ${defText}`);
    this.statusText.setText('Tap the microphone and speak!');
    this.statusText.setColor(this.hex(this.theme.textMuted));
    this.heardText.setText('');
  }
}
