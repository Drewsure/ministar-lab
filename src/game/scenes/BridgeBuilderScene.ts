import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// BRIDGE BUILDER (Rocket Launch) — Text/Spelling Engine
// The high-engagement alternative to Hangman.
// Each correct letter launches a rocket segment across the gap.
// Each wrong letter collapses one bridge strut.
// 5 wrong = bridge collapses, rocket falls.
// ============================================================================

export default class BridgeBuilderScene extends BaseEngine {
  private round = 0;
  private rounds: TermItem[] = [];
  private targetWord = '';
  private revealed: boolean[] = [];
  private wrongCount = 0;
  private maxWrong = 5;
  private letterButtons: Phaser.GameObjects.Container[] = [];
  private wordSlots: Phaser.GameObjects.Text[] = [];
  private rocket!: Phaser.GameObjects.Image;
  private bridgeStruts: Phaser.GameObjects.Rectangle[] = [];
  private canInteract = true;
  private hintText!: Phaser.GameObjects.Text;
  private rocketStartX = 0;
  private solvedRounds = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 5); }

  protected buildWorld() {
    this.add.text(
      this.scale.width / 2, 50,
      '🚀 Bridge Builder',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '39px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.rounds = this.pickTerms(this.maxScore);

    // Build bridge at the bottom of the screen
    const bridgeY = this.scale.height - 50;
    const strutCount = this.maxWrong;
    const strutW = 80;
    const gap = 10;
    const totalW = strutCount * strutW + (strutCount - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + strutW / 2;
    for (let i = 0; i < strutCount; i++) {
      const strut = this.add.rectangle(
        startX + i * (strutW + gap), bridgeY,
        strutW, 18, this.theme.accent, 0.85
      ).setStrokeStyle(2, this.theme.accent2, 0.7);
      this.bridgeStruts.push(strut);
    }

    // Rocket on the left, will travel right
    const playerKey = 'player-' + this.theme.id;
    if (!this.textures.exists(playerKey)) {
      const g = this.make.graphics();
      g.fillStyle(this.theme.accent, 1);
      g.fillTriangle(16, 0, 32, 28, 0, 28);
      g.generateTexture(playerKey, 32, 32);
      g.destroy();
    }
    this.rocket = this.add.image(startX - strutW - 30, bridgeY, playerKey).setDisplaySize(50, 50).setRotation(-Math.PI / 2).setDepth(20);
    this.rocketStartX = startX - strutW - 30;

    this.hintText = this.add.text(this.scale.width / 2, 100, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: this.hex(this.theme.textMuted),
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5).setDepth(50);

    this.renderRound();
  }

  protected onTick(_remainingMs: number) { /* HUD */ }

  private renderRound() {
    if (this.round >= this.rounds.length) {
      this.finishGame(this.score >= this.maxScore * 0.5);
      return;
    }
    const term = this.rounds[this.round];
    this.targetWord = term.term.toUpperCase().replace(/[^A-Z]/g, '');
    this.revealed = new Array(this.targetWord.length).fill(false);
    this.wrongCount = 0;
    this.canInteract = true;

    // ---- Reset bridge fully (fix: was only resetting fill, not scale/alpha/visible) ----
    this.bridgeStruts.forEach(s => {
      s.setFillStyle(this.theme.accent, 0.85);
      s.setScale(1, 1);
      s.setAlpha(1);
      s.setVisible(true);
    });

    // ---- Reset rocket position (fix: was drifting cumulatively across rounds) ----
    this.rocket.setPosition(this.rocketStartX, this.scale.height - 50);
    this.rocket.setAngle(0).setRotation(-Math.PI / 2).setAlpha(1);

    // Render word slots
    this.wordSlots.forEach(s => s.destroy());
    this.wordSlots = [];
    const slotW = 40, gap = 6;
    const totalW = this.targetWord.length * slotW + (this.targetWord.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + slotW / 2;
    for (let i = 0; i < this.targetWord.length; i++) {
      const slot = this.add.text(startX + i * (slotW + gap), 180, '_', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '48px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(50);
      this.wordSlots.push(slot);
    }

    // Hint
    this.hintText.setText(term.definition ? `Hint: ${term.emoji ?? ''} ${term.definition}` : (term.emoji ? `Hint: ${term.emoji}` : ''));

    // Render letter keyboard
    this.letterButtons.forEach(b => b.destroy());
    this.letterButtons = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const kbRows = [alphabet.slice(0, 13), alphabet.slice(13)];
    const kbBtnSize = 44;
    const kbGap = 6;
    kbRows.forEach((row, ri) => {
      const totalRW = row.length * kbBtnSize + (row.length - 1) * kbGap;
      const startX2 = (this.scale.width - totalRW) / 2 + kbBtnSize / 2;
      const y = 280 + ri * (kbBtnSize + kbGap);
      for (let i = 0; i < row.length; i++) {
        const letter = row[i];
        const x = startX2 + i * (kbBtnSize + kbGap);
        const bg = this.add.rectangle(0, 0, kbBtnSize, kbBtnSize, this.theme.card, 0.95)
          .setStrokeStyle(2, this.theme.accent, 0.6);
        const txt = this.add.text(0, 0, letter, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '30px',
          color: this.hex(this.theme.text),
          fontStyle: 'bold',
        }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, txt]).setSize(kbBtnSize, kbBtnSize).setInteractive({ useHandCursor: true });
        container.setData('letter', letter);
        container.setData('bg', bg);
        container.on('pointerover', () => {
          bg.setFillStyle(this.theme.cardAlt, 1);
          audioBus.play('hover');
        });
        container.on('pointerout', () => bg.setFillStyle(this.theme.card, 0.95));
        container.on('pointerdown', () => this.guessLetter(letter, container));
        this.letterButtons.push(container);
      }
    });
  }

  private guessLetter(letter: string, btn: Phaser.GameObjects.Container) {
    if (!this.canInteract) return;
    const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
    btn.disableInteractive();
    const inWord = this.targetWord.includes(letter);

    let revealedAny = false;
    for (let i = 0; i < this.targetWord.length; i++) {
      if (this.targetWord[i] === letter && !this.revealed[i]) {
        this.revealed[i] = true;
        this.wordSlots[i].setText(letter);
        this.wordSlots[i].setColor(this.hex(this.theme.success));
        this.juice.squash(this.wordSlots[i], 1.3);
        revealedAny = true;
      }
    }

    // ---- Only record telemetry ONCE per letter guess (fix: was double-counting per-letter) ----

    // ---- Record telemetry now (after computing revealedAny) ----
    this.recordAnswer({
      term: this.rounds[this.round].term,
      response: letter,
      success: revealedAny,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (inWord) {
      audioBus.play('launch');
      bg.setFillStyle(this.theme.success, 0.7);
      this.juice.burst(btn.x, btn.y, 'correct');
      // ---- Nudge rocket forward by ONE step per correct guess (fix: was jumping cumulative total) ----
      const totalDistance = this.scale.width - this.rocketStartX - 100;
      const strutStep = totalDistance / this.targetWord.length;
      this.tweens.add({ targets: this.rocket, x: this.rocket.x + strutStep, duration: 300, ease: 'Quad.out' });
      this.checkWinRound();
    } else {
      audioBus.play('incorrect');
      bg.setFillStyle(this.theme.danger, 0.7);
      this.juice.shake('medium');
      // Collapse one strut
      const strutIdx = this.maxWrong - 1 - this.wrongCount;
      if (strutIdx >= 0 && strutIdx < this.bridgeStruts.length) {
        const strut = this.bridgeStruts[strutIdx];
        this.tweens.add({
          targets: strut,
          scaleY: 0, alpha: 0,
          duration: 300, ease: 'Back.in',
          onComplete: () => strut.setVisible(false),
        });
      }
      this.wrongCount++;
      if (this.wrongCount >= this.maxWrong) {
        this.canInteract = false;
        // Rocket falls
        this.tweens.add({
          targets: this.rocket,
          y: this.scale.height + 80, angle: 180,
          duration: 800, ease: 'Cubic.in',
          onComplete: () => {
            this.time.delayedCall(500, () => {
              this.round++;
              this.renderRound();
            });
          },
        });
      }
    }
  }

  private checkWinRound() {
    if (this.revealed.every(Boolean)) {
      this.canInteract = false;
      this.solvedRounds++;
      // ESL: speak the completed word
      this.speakPrompt(this.rounds[this.round].term, this.rounds[this.round].definition);
      this.juice.burst(this.scale.width / 2, 200, 'win');
      this.hud.celebrate();
      // Rocket launches off-screen
      this.tweens.add({
        targets: this.rocket,
        x: this.scale.width + 80, y: 100,
        duration: 600, ease: 'Cubic.out',
        onComplete: () => {
          this.time.delayedCall(400, () => {
            this.round++;
            this.renderRound();
          });
        },
      });
      this.checkWin();
    }
  }
}
