import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// RHYTHM TAP — Vocabulary words fall from top. Tap when they cross the hit line.
// Perfect = 3pts, Good = 2pts, OK = 1pt, Miss = 0pts. Combo system.

export default class RhythmTapScene extends BaseEngine {
  private currentIdx = 0;
  private combo = 0;
  private maxCombo = 0;
  private wordY = 0;
  private fallSpeed = 1;
  private gameLoop?: Phaser.Time.TimerEvent;
  private canTap = false;
  private hitLineY = 65; // percentage
  private wordText!: Phaser.GameObjects.Text;
  private scoreDisplay!: Phaser.GameObjects.Text;
  private comboDisplay!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private tapBtn!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 35, '🎵 Rhythm Tap', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.scoreDisplay = this.add.text(20, 60, 'Score: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.comboDisplay = this.add.text(this.scale.width - 20, 60, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Game area
    const gameArea = this.add.rectangle(this.scale.width / 2, 300, this.scale.width - 40, 280, 0x000000, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.3).setDepth(5);

    // Hit line
    const hitLineY = 200 + (this.hitLineY / 100) * 280;
    this.add.rectangle(this.scale.width / 2, hitLineY, this.scale.width - 40, 3, this.theme.success, 0.8).setDepth(10);
    this.add.text(this.scale.width / 2, hitLineY - 20, '━━ TAP HERE ━━', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: this.hex(this.theme.success),
    }).setOrigin(0.5).setDepth(11);

    // Falling word
    this.wordText = this.add.text(this.scale.width / 2, 100, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    // Feedback
    this.feedbackText = this.add.text(this.scale.width / 2, 450, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);

    // Tap button
    this.tapBtn = this.add.text(this.scale.width / 2, 520, '👆 TAP NOW!', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'), padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(40).setInteractive({ useHandCursor: true });

    this.tapBtn.on('pointerdown', () => this._handleTap());

    this._nextWord();
  }

  protected onTick(_remainingMs: number) {}

  private _nextWord() {
    if (this.currentIdx >= this.terms.length) { this._finish(); return; }
    const word = this.terms[this.currentIdx].term;
    this.wordY = 0;
    this.fallSpeed = 0.8 + this.currentIdx * 0.1;
    this.canTap = true;
    this.wordText.setText(word);
    this.wordText.setVisible(true);
    this.feedbackText.setText('');
    this.makeSpeakable(this.wordText, word);

    this.gameLoop = this.time.addEvent({
      delay: 30, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.gameLoop) this.gameLoop.remove(); return; }
        this.wordY += this.fallSpeed;
        // Map 0-100% to game area
        const pixelY = 100 + (this.wordY / 100) * 280;
        this.wordText.y = pixelY;
        if (this.wordY > 100) {
          if (this.gameLoop) this.gameLoop.remove();
          this._miss();
        }
      },
    });
  }

  private _handleTap() {
    if (!this.canTap || this.isFinished) return;
    this.canTap = false;
    if (this.gameLoop) this.gameLoop.remove();
    const dist = Math.abs(this.wordY - this.hitLineY);
    let timing: string, points: number;
    if (dist < 3) { timing = 'PERFECT!'; points = 3; this.combo++; }
    else if (dist < 8) { timing = 'GOOD!'; points = 2; this.combo++; }
    else if (dist < 15) { timing = 'OK'; points = 1; this.combo = 0; }
    else { timing = 'MISS!'; points = 0; this.combo = 0; }

    if (this.combo >= 3) points += 1;
    if (this.combo >= 5) points += 1;
    if (this.maxCombo < this.combo) this.maxCombo = this.combo;

    this.score += points;
    this.scoreDisplay.setText('Score: ' + this.score);
    if (this.combo >= 2) this.comboDisplay.setText('🔥 x' + this.combo);
    else this.comboDisplay.setText('');

    const word = this.terms[this.currentIdx].term;
    if (timing !== 'MISS!') {
      audioBus.play('correct');
      audioBus.speak(word);
      this.juice.burst(this.wordText.x, this.wordText.y, 'correct');
    } else {
      audioBus.play('incorrect');
    }

    this.recordAnswer({ term: word, response: timing, success: timing !== 'MISS!', coordinate: { x: this.wordText.x, y: this.wordText.y, t: this.time.now } });

    this.feedbackText.setText(`${timing} +${points} — ${word}`);
    this.wordText.setVisible(false);
    this.time.delayedCall(1500, () => { this.currentIdx++; this._nextWord(); });
  }

  private _miss() {
    this.canTap = false;
    this.combo = 0;
    this.comboDisplay.setText('');
    audioBus.play('incorrect');
    const word = this.terms[this.currentIdx].term;
    this.recordAnswer({ term: word, response: 'miss', success: false, coordinate: { x: this.wordText.x, y: this.wordText.y, t: this.time.now } });
    this.feedbackText.setText('✗ MISS! — ' + word);
    this.wordText.setVisible(false);
    this.time.delayedCall(1500, () => { this.currentIdx++; this._nextWord(); });
  }

  private _finish() {
    this.finishGame(this.score >= this.terms.length * 2);
  }
}
