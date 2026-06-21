import Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// BALLOON POP — Pairing Engine
// Show a prompt; player pops the balloon carrying the matching term.
// ============================================================================

interface Balloon {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  hit: boolean;
}

export default class BalloonPopScene extends BaseEngine {
  private balloons: Balloon[] = [];
  private balloonGroup!: Phaser.GameObjects.Group;
  private promptText!: Phaser.GameObjects.Text;
  private activePrompt?: TermItem;
  private spawnTimer?: Phaser.Time.TimerEvent;

  protected maxQuestions() { return Math.min(this.terms.length, 8); }

  protected buildWorld() {
    this.promptText = this.add.text(
      this.scale.width / 2, 70,
      'Pop the balloon!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '42px',
        color: this.hex(this.theme.accent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    this.balloonGroup = this.add.group();
    this.activePrompt = this.terms[0];

    this.spawnTimer = this.time.addEvent({
      delay: 1100, loop: true,
      callback: this.spawnBalloon,
      callbackScope: this,
    });
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished || !this.activePrompt) return;
    this.promptText.setText(`Pop: "${this.activePrompt.term}"`);
    // ESL: speak the prompt aloud
    this.speakPrompt(this.activePrompt.term, this.activePrompt.definition);
    this.makeSpeakable(this.promptText, this.activePrompt.term);
  }

  private spawnBalloon() {
    if (this.isFinished || !this.activePrompt) return;

    // Always include the correct term + 1-2 decoys
    const isThisCorrect = Math.random() < 0.4;
    const term = isThisCorrect
      ? this.activePrompt
      : Phaser.Utils.Array.GetRandom(this.terms.filter(t => t.id !== this.activePrompt!.id)) ?? this.activePrompt;
    if (!term) return;
    const isCorrect = term.id === this.activePrompt.id;

    const balloonKey = 'balloon-' + this.theme.id;
    const balloonImg = this.add.image(0, 0, balloonKey).setDisplaySize(70, 90);

    const txt = this.add.text(0, 10, term.emoji ?? term.term.slice(0, 6), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const startX = Phaser.Math.Between(60, this.scale.width - 60);
    const container = this.add.container(startX, this.scale.height + 50, [balloonImg, txt]).setSize(70, 90).setInteractive({ useHandCursor: true });

    const b: Balloon = { container, term, hit: false };
    container.setData('balloon', b);
    this.balloons.push(b);
    this.balloonGroup.add(container);

    // Float up
    this.tweens.add({
      targets: container,
      y: -60,
      duration: 7000,
      ease: 'Sine.inOut',
      onComplete: () => {
        if (container.active) {
          container.destroy();
          this.balloons = this.balloons.filter(x => x !== b);
        }
      },
    });
    // Gentle wobble
    this.tweens.add({
      targets: container,
      x: '+=18', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    container.on('pointerdown', () => this.popBalloon(b, isCorrect));
  }

  private popBalloon(b: Balloon, isCorrect: boolean) {
    if (b.hit) return;
    b.hit = true;
    audioBus.play('pop');
    this.recordAnswer({
      term: this.activePrompt!.term,
      response: b.term.term,
      success: isCorrect,
      coordinate: { x: b.container.x, y: b.container.y, t: this.time.now },
    });

    // Burst particles
    this.juice.burst(b.container.x, b.container.y, isCorrect ? 'correct' : 'incorrect');

    // Pop animation
    this.tweens.add({
      targets: b.container,
      scale: 1.6, alpha: 0,
      duration: 200, ease: 'Back.in',
      onComplete: () => b.container.destroy(),
    });
    this.balloons = this.balloons.filter(x => x !== b);

    if (isCorrect) {
      // Advance to next prompt
      const remaining = this.terms.filter(t => t.id !== this.activePrompt!.id);
      if (remaining.length > 0) {
        this.activePrompt = Phaser.Utils.Array.GetRandom(remaining);
      } else {
        this.activePrompt = undefined;
      }
      this.checkWin();
    }
  }
}
