import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// ============================================================================
// ENDLESS RUNNER — Navigate lanes by selecting the correct vocabulary
// ============================================================================
// The player's character runs forward automatically. Prompts appear
// ahead (e.g. "Which word means 'red fruit'?"). Three lanes show
// answer options. Player swipes/arrow-keys to switch lanes and hit
// the correct answer. Wrong lane = stumble. Endless until 3 strikes.
// ============================================================================

interface RunnerPrompt {
  prompt: TermItem;
  options: TermItem[];   // 3 options, one per lane
  correctLane: number;   // 0, 1, or 2
  y: number;             // current Y position (moves down toward player)
  spawned: boolean;
}

export default class EndlessRunnerScene extends BaseEngine {
  private player!: Phaser.GameObjects.Text;
  private playerLane = 1;  // 0=left, 1=center, 2=right
  private laneX = [200, 400, 600];
  private prompts: RunnerPrompt[] = [];
  private currentPrompt?: RunnerPrompt;
  private nextPromptY = -100;
  private speed = 80;       // pixels per second
  private strikes = 0;
  private maxStrikes = 3;
  private distance = 0;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private strikesText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private laneLines: Phaser.GameObjects.Rectangle[] = [];
  private canSwitch = true;

  protected maxQuestions() { return 15; }

  protected buildWorld() {
    // Title
    this.add.text(this.scale.width / 2, 105, 'Endless Runner', {
      fontFamily: 'Inter, sans-serif', fontSize: '30px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Lane lines (visual dividers)
    [300, 500].forEach(x => {
      const line = this.add.rectangle(x, this.scale.height / 2 + 50, 2, this.scale.height, 0xffffff, 0.1).setDepth(1);
      this.laneLines.push(line);
    });

    // Player character (emoji that runs)
    this.player = this.add.text(this.laneX[this.playerLane], this.scale.height - 80, '🏃', {
      fontSize: '40px',
    }).setOrigin(0.5).setDepth(100);

    // Player lane indicator (glowing circle under player)
    const glow = this.add.circle(this.laneX[this.playerLane], this.scale.height - 40, 30, this.theme.accent, 0.3)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(99);
    this.tweens.add({
      targets: glow, scale: { from: 1, to: 1.2 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    // Keep glow under player
    this.events.on('update', () => {
      glow.x = this.laneX[this.playerLane];
    });

    // Prompt banner (top of screen, shows the question)
    this.promptBg = this.add.rectangle(this.scale.width / 2, 170, 700, 60, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 170, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
      align: 'center', wordWrap: { width: 660 },
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText, 'Tap to hear the prompt');

    // Strikes display (top-left)
    this.strikesText = this.add.text(20, 220, '❤❤❤', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px',
    }).setDepth(50);

    // Distance display (top-right)
    this.distanceText = this.add.text(this.scale.width - 20, 220, '0m', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Keyboard controls
    this.input.keyboard?.on('keydown-LEFT', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.switchLane(1));
    this.input.keyboard?.on('keydown-A', () => this.switchLane(-1));
    this.input.keyboard?.on('keydown-D', () => this.switchLane(1));

    // Touch controls — tap left/right half of screen
    this.setupGlobalPointer((x, y) => {
      if (x < this.scale.width / 2) this.switchLane(-1);
      else this.switchLane(1);
    });

    // Spawn first prompt
    this.spawnNextPrompt();
  }

  protected onTick(_remainingMs: number) {
    // Move prompts down
    if (this.isFinished) return;
    const delta = (_remainingMs > 0 ? 1 : 1); // always move

    // Move current prompt
    if (this.currentPrompt) {
      this.currentPrompt.y += this.speed * 0.016; // ~60fps
      this.updatePromptDisplay();

      // Check if prompt reached the player
      if (this.currentPrompt.y >= this.scale.height - 100) {
        // Prompt hit the player — check if in correct lane
        this.checkAnswer();
      }
    }

    // Update distance
    this.distance += this.speed * 0.016 * 0.1;
    this.distanceText.setText(`${Math.floor(this.distance)}m`);

    // Speed up over time
    this.speed = Math.min(200, 80 + this.distance * 0.5);
  }

  private switchLane(direction: number) {
    if (!this.canSwitch || this.isFinished) return;
    const newLane = this.playerLane + direction;
    if (newLane < 0 || newLane > 2) return;
    this.playerLane = newLane;
    audioBus.play('tap');

    // Animate player to new lane
    this.tweens.add({
      targets: this.player,
      x: this.laneX[this.playerLane],
      duration: 150,
      ease: 'Quad.out',
    });

    // Tilt animation
    this.player.setAngle(direction * 15);
    this.time.delayedCall(150, () => this.player.setAngle(0));
  }

  private spawnNextPrompt() {
    if (this.score >= this.maxScore) {
      this.finishGame(true);
      return;
    }

    // Pick a random term as the prompt
    const prompt = this.terms[Math.floor(Math.random() * this.terms.length)];
    const distractors = this.terms.filter(t => t.id !== prompt.id);
    Phaser.Utils.Array.Shuffle(distractors);
    const options = [prompt, ...distractors.slice(0, 2)];
    Phaser.Utils.Array.Shuffle(options);
    const correctLane = options.findIndex(o => o.id === prompt.id);

    this.currentPrompt = {
      prompt,
      options,
      correctLane,
      y: 200,
      spawned: false,
    };

    // Update prompt text
    const def = prompt.definition ?? prompt.emoji ?? prompt.term;
    this.promptText.setText(`Which word means: "${def}"?`);
    this.promptText.setData('speakText', `Which word means: ${def}?`);
    this.promptBg.setData('speakText', `Which word means: ${def}?`);

    // Create option texts (3 lanes)
    this.currentPrompt.options.forEach((opt, i) => {
      const optText = this.add.text(this.laneX[i], this.currentPrompt!.y, `${opt.emoji ?? ''} ${opt.term}`.trim(), {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: this.hex(this.theme.text), fontStyle: 'bold',
        backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
        padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(40);
      optText.setData('speakText', opt.term);
      (this.currentPrompt as any)[`optText${i}`] = optText;
    });

    this.currentPrompt.spawned = true;
  }

  private updatePromptDisplay() {
    if (!this.currentPrompt) return;
    for (let i = 0; i < 3; i++) {
      const optText = (this.currentPrompt as any)[`optText${i}`] as Phaser.GameObjects.Text;
      if (optText) optText.y = this.currentPrompt.y;
    }
  }

  private checkAnswer() {
    if (!this.currentPrompt) return;
    const isCorrect = this.playerLane === this.currentPrompt.correctLane;
    const opt = this.currentPrompt.options[this.playerLane];

    this.recordAnswer({
      term: this.currentPrompt.prompt.term,
      response: opt.term,
      success: isCorrect,
      coordinate: { x: this.laneX[this.playerLane], y: this.currentPrompt.y, t: this.time.now },
    });

    if (isCorrect) {
      // Clean up options
      this.destroyPromptOptions();
      this.spawnNextPrompt();
    } else {
      // Strike
      this.strikes++;
      this.strikesText.setText('❤'.repeat(this.maxStrikes - this.strikes) + '🖤'.repeat(this.strikes));
      audioBus.play('incorrect');
      this.juice.shake('medium');

      if (this.strikes >= this.maxStrikes) {
        this.destroyPromptOptions();
        this.finishGame(false);
      } else {
        // Reset prompt to top
        this.destroyPromptOptions();
        this.spawnNextPrompt();
      }
    }
  }

  private destroyPromptOptions() {
    if (!this.currentPrompt) return;
    for (let i = 0; i < 3; i++) {
      const optText = (this.currentPrompt as any)[`optText${i}`] as Phaser.GameObjects.Text;
      if (optText) {
        this.tweens.add({
          targets: optText,
          alpha: 0, scale: 0.5,
          duration: 200,
          onComplete: () => optText.destroy(),
        });
      }
    }
    this.currentPrompt = undefined;
  }
}
