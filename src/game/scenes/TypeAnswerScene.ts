import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// TYPE ANSWER — Text Engine  (AAA 2029 — new template #16)
// ============================================================================
// Read the definition, type the correct term. Builds spelling + recall.
//   • Definition shown as prompt (with TTS)
//   • On-screen keyboard + physical keyboard support
//   • Letter-by-letter feedback (green = correct position, red = wrong)
//   • Hint button (reveals first letter, costs streak)
//   • Skip button (moves to next term, marks as incorrect)
//   • Level progression + combo multipliers
// ============================================================================

export default class TypeAnswerScene extends BaseEngine {
  private rounds: TermItem[] = [];
  private round = 0;
  private currentTerm?: TermItem;
  private userInput = '';
  private promptText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private inputBg!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;
  private keyboardKeys: Phaser.GameObjects.Container[] = [];
  private hintUsed = false;
  private canSubmit = true;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(
      this.scale.width / 2, 100,
      '⌨️ Type the Answer',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Prompt (definition) ----
    this.promptText = this.add.text(
      this.scale.width / 2, 160,
      'Definition appears here',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: this.hex(this.theme.text),
        align: 'center',
        wordWrap: { width: 600 },
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Input box ----
    this.inputBg = this.add.rectangle(
      this.scale.width / 2, 240, 400, 50, this.theme.card, 0.8
    ).setStrokeStyle(2, this.theme.accent, 0.6).setDepth(49);

    this.inputText = this.add.text(
      this.scale.width / 2, 240, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '24px',
        color: this.hex(this.theme.text),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Blinking cursor
    this.tweens.add({
      targets: this.inputText,
      alpha: { from: 1, to: 0.6 },
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // ---- Hint text ----
    this.hintText = this.add.text(
      this.scale.width / 2, 290, '',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: this.hex(this.theme.textMuted),
      }
    ).setOrigin(0.5).setDepth(50);

    // ---- Hint + Skip buttons ----
    const hintBtn = this.add.rectangle(
      this.scale.width / 2 - 100, 340, 160, 40, this.theme.warning, 0.7
    ).setStrokeStyle(2, this.theme.warning, 1).setDepth(50)
      .setInteractive({ useHandCursor: true });
    this.add.text(this.scale.width / 2 - 100, 340, '💡 Hint (-streak)', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    hintBtn.on('pointerdown', () => this.useHint());

    const skipBtn = this.add.rectangle(
      this.scale.width / 2 + 100, 340, 160, 40, this.theme.danger, 0.7
    ).setStrokeStyle(2, this.theme.danger, 1).setDepth(50)
      .setInteractive({ useHandCursor: true });
    this.add.text(this.scale.width / 2 + 100, 340, '⏭ Skip', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    skipBtn.on('pointerdown', () => this.skip());

    // ---- On-screen keyboard ----
    this.renderKeyboard();

    // ---- Physical keyboard input ----
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (e: KeyboardEvent) => this.handleKey(e));
    }

    // ---- Start first round ----
    this.rounds = this.pickTerms(this.maxScore);
    this.showRound();

    // Global pointer handler for reliable keyboard clicks
    this.setupGlobalPointer((x, y) => {
      if (!this.canSubmit) return;
      // Hit-test letter keys
      for (const key of this.keyboardKeys) {
        if (Math.abs(x - key.x) < 18 && Math.abs(y - key.y) < 18) {
          const txt = key.getAt(1) as Phaser.GameObjects.Text;
          if (txt) {
            // ESL: speak the letter when tapped
            audioBus.speak(txt.text);
            this.typeLetter(txt.text);
          }
          return;
        }
      }
      // Hit-test submit button
      const submitX = this.scale.width / 2 - 140;
      const btnY = 410 + 3 * 40 + 10;
      if (Math.abs(x - submitX) < 60 && Math.abs(y - btnY) < 18) {
        this.submit();
        return;
      }
      // Hit-test backspace button
      const backX = this.scale.width / 2 + 140;
      if (Math.abs(x - backX) < 60 && Math.abs(y - btnY) < 18) {
        this.deleteLetter();
        return;
      }
      // Hit-test hint button
      if (Math.abs(x - (this.scale.width / 2 - 100)) < 80 && Math.abs(y - 340) < 20) {
        this.useHint();
        return;
      }
      // Hit-test skip button
      if (Math.abs(x - (this.scale.width / 2 + 100)) < 80 && Math.abs(y - 340) < 20) {
        this.skip();
        return;
      }
    });
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private showRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.score >= this.maxScore * 0.5);
      return;
    }
    this.currentTerm = this.rounds[this.round];
    this.userInput = '';
    this.hintUsed = false;
    this.canSubmit = true;
    this.updateInputDisplay();
    this.hintText.setText('');

    const def = this.currentTerm.definition ?? this.currentTerm.term;
    this.promptText.setText(`"${def}"`);
    // ESL: speak the definition


  }

  private renderKeyboard() {
    this.keyboardKeys.forEach(k => k.destroy());
    this.keyboardKeys = [];
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const keySize = 36, gap = 4;
    const kbY = 410;

    rows.forEach((row, ri) => {
      const totalW = row.length * keySize + (row.length - 1) * gap;
      const startX = (this.scale.width - totalW) / 2 + keySize / 2;
      const y = kbY + ri * (keySize + gap);
      for (let i = 0; i < row.length; i++) {
        const letter = row[i];
        const x = startX + i * (keySize + gap);
        const bg = this.add.rectangle(0, 0, keySize, keySize, this.theme.card, 0.9)
          .setStrokeStyle(1, this.theme.accent, 0.5);
        const txt = this.add.text(0, 0, letter, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          color: this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, txt])
          .setSize(keySize, keySize).setInteractive({ useHandCursor: true }).setDepth(40);
        container.on('pointerover', () => bg.setFillStyle(this.theme.cardAlt, 1));
        container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.9));
        container.on('pointerdown', () => this.typeLetter(letter));
        this.keyboardKeys.push(container);
      }
    });

    // Space + Submit + Backspace row
    const btnY = kbY + 3 * (keySize + gap) + 10;
    const submitBg = this.add.rectangle(0, 0, 120, keySize, this.theme.success, 0.8)
      .setStrokeStyle(1, this.theme.success);
    const submitTxt = this.add.text(0, 0, '✓ Submit', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const submitBtn = this.add.container(this.scale.width / 2 - 140, btnY, [submitBg, submitTxt])
      .setSize(120, keySize).setInteractive({ useHandCursor: true }).setDepth(40);
    submitBtn.on('pointerdown', () => this.submit());

    const backspaceBg = this.add.rectangle(0, 0, 120, keySize, this.theme.danger, 0.7)
      .setStrokeStyle(1, this.theme.danger);
    const backspaceTxt = this.add.text(0, 0, '⌫ Delete', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const backspaceBtn = this.add.container(this.scale.width / 2 + 140, btnY, [backspaceBg, backspaceTxt])
      .setSize(120, keySize).setInteractive({ useHandCursor: true }).setDepth(40);
    backspaceBtn.on('pointerdown', () => this.deleteLetter());
  }

  private handleKey(e: KeyboardEvent) {
    if (!this.canSubmit) return;
    const k = e.key.toUpperCase();
    if (k === 'BACKSPACE') { this.deleteLetter(); return; }
    if (k === 'ENTER') { this.submit(); return; }
    if (k.length === 1 && k >= 'A' && k <= 'Z') this.typeLetter(k);
  }

  private typeLetter(letter: string) {
    if (!this.canSubmit || !this.currentTerm) return;
    const target = this.currentTerm.term.toUpperCase();
    if (this.userInput.length >= target.length) return;
    this.userInput += letter;
    audioBus.play('tap');
    this.updateInputDisplay();
  }

  private deleteLetter() {
    if (!this.canSubmit) return;
    this.userInput = this.userInput.slice(0, -1);
    audioBus.play('tap');
    this.updateInputDisplay();
  }

  private updateInputDisplay() {
    if (!this.currentTerm) return;
    const target = this.currentTerm.term.toUpperCase();
    let display = '';
    for (let i = 0; i < target.length; i++) {
      if (i < this.userInput.length) {
        display += this.userInput[i];
      } else {
        display += '_';
      }
      display += ' ';
    }
    this.inputText.setText(display);
  }

  private submit() {
    if (!this.canSubmit || !this.currentTerm) return;
    const target = this.currentTerm.term.toUpperCase();
    const isCorrect = this.userInput === target;
    this.canSubmit = false;

    this.recordAnswer({
      term: this.currentTerm.term,
      response: this.userInput,
      success: isCorrect,
      coordinate: { x: this.scale.width / 2, y: 240, t: this.time.now },
    });

    if (isCorrect) {
      // Green flash + celebrate
      this.inputBg.setFillStyle(this.theme.success, 0.8);
      this.juice.burst(this.scale.width / 2, 240, 'correct');
      audioBus.speak(this.currentTerm.term);
      this.time.delayedCall(1200, () => {
        this.round++;
        this.inputBg.setFillStyle(this.theme.card, 0.8);
        this.showRound();
      });
    } else {
      // Red flash + show correct answer
      this.inputBg.setFillStyle(this.theme.danger, 0.8);
      this.hintText.setText(`Correct answer: ${this.currentTerm.term}`);
      this.time.delayedCall(2000, () => {
        this.round++;
        this.inputBg.setFillStyle(this.theme.card, 0.8);
        this.showRound();
      });
    }
  }

  private useHint() {
    if (!this.currentTerm || this.hintUsed) return;
    this.hintUsed = true;
    this.streak = 0; // hint costs the streak
    // Reveal first letter
    const first = this.currentTerm.term[0].toUpperCase();
    this.hintText.setText(`Starts with: ${first}`);
    audioBus.speak(`Starts with ${first}`);
    // Fill in first letter
    if (this.userInput.length === 0) {
      this.userInput = first;
      this.updateInputDisplay();
    }
  }

  private skip() {
    if (!this.canSubmit || !this.currentTerm) return;
    this.recordAnswer({
      term: this.currentTerm.term,
      response: 'skipped',
      success: false,
      coordinate: { x: this.scale.width / 2, y: 240, t: this.time.now },
    });
    this.round++;
    this.showRound();
  }
}
