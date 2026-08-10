import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// BALLOON POP — Wordwall-style vocabulary matching (AAA 2029 edition)
// ============================================================================
// MECHANIC (researched from Wordwall):
//   • Balloons float up from the bottom, each carrying a vocabulary word
//   • Definition boxes are at the BOTTOM of the screen
//   • Player POPS a balloon → the word DROPS straight down
//   • If the word lands in the matching definition box → correct!
//   • If it lands in the wrong box or misses → wrong!
//   • It's about TIMING + MATCHING — pop at the right moment
//
// FEATURES:
//   • Real balloon visuals (circle + string + highlight + color)
//   • Pop animation: burst into confetti particles + sound
//   • Word drops with gravity after pop
//   • Definition boxes at bottom highlight when word lands
//   • Combo system for consecutive correct matches
//   • Level progression + TTS
// ============================================================================

interface Balloon {
  container: Phaser.GameObjects.Container;
  term: TermItem;
  hit: boolean;
  x: number;
  y: number;
  color: number;
  riseTween: Phaser.Tweens.Tween | null;
  baseX: number;
}

interface DefBox {
  term: TermItem;
  x: number;
  y: number;
  w: number;
  h: number;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const BALLOON_COLORS = [0xef4444, 0x22c55e, 0x3b82f6, 0xfbbf24, 0xa855f7, 0xec4899, 0x06b6d4, 0xf97316];

export default class BalloonPopScene extends BaseEngine {
  private balloons: Balloon[] = [];
  private defBoxes: DefBox[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private comboCount = 0;
  private lastCorrectTime = 0;
  private currentRound = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    // ---- Title ----
    this.add.text(this.scale.width / 2, 60, '🎈 Balloon Pop', {
      fontFamily: 'Inter, sans-serif', fontSize: '26px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // ---- Prompt ----
    this.promptBg = this.add.rectangle(this.scale.width / 2, 100, 620, 36, this.theme.card, 0.9)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 100, 'Pop balloons — drop each word into its matching definition below!', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText);

    // ---- Build definition boxes at bottom ----
    this._buildDefBoxes();

    // ---- Spawn timer ----
    this.spawnTimer = this.time.addEvent({
      delay: 2500, loop: true,
      callback: this.spawnBalloon,
      callbackScope: this,
    });

    // ---- First balloon ----
    this.time.delayedCall(1000, () => this.spawnBalloon());

    // ---- Global pointer for popping ----
    this.setupGlobalPointer((x, y) => {
      for (const b of this.balloons) {
        if (b.hit) continue;
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy < 40 * 40) {
          this.popBalloon(b);
          break;
        }
      }
    });

    audioBus.speak('Pop the balloons and drop each word into its matching definition below!');
  }

  protected onTick(_remainingMs: number) {}

  // ===========================================================================
  // DEFINITION BOXES
  // ===========================================================================
  private _buildDefBoxes() {
    this.defBoxes.forEach(d => { try { d.bg.destroy(); d.text.destroy(); } catch {} });
    this.defBoxes = [];

    // Pick 4 terms for this round — each will have a matching balloon spawn.
    // AAAA KIDS MODE — Only spawn balloons whose term has a matching box, so
    // every pop has a clear correct/wrong outcome (no more "missed" feedback
    // for balloons whose word was never in any box).
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    const roundTerms = pool.slice(0, Math.min(4, pool.length));

    const boxW = Math.min(180, (this.scale.width - 40) / roundTerms.length);
    const boxH = 64;
    const gap = 10;
    const totalW = roundTerms.length * boxW + (roundTerms.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + boxW / 2;
    const boxY = this.scale.height - 50;

    Phaser.Utils.Array.Shuffle(roundTerms);
    roundTerms.forEach((term, i) => {
      const x = startX + i * (boxW + gap);
      const bg = this.add.rectangle(x, boxY, boxW, boxH, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(30);
      const text = this.add.text(x, boxY, term.definition ?? term.term, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: this.hex(this.theme.text), fontStyle: 'bold',
        align: 'center', wordWrap: { width: boxW - 10 },
      }).setOrigin(0.5).setDepth(31);
      this.makeHoverSpeakable(text, term.definition ?? term.term);

      this.defBoxes.push({ term, x, y: boxY, w: boxW, h: boxH, bg, text });
    });

    this.promptText.setText('Pop a balloon — drop its word into the matching definition!');
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, 'Pop a balloon and drop its word into the matching definition below!', { isQuestion: true });
  }

  // ===========================================================================
  // BALLOON SPAWN
  // ===========================================================================
  private spawnBalloon() {
    if (this.isFinished) return;
    if (this.defBoxes.length === 0) return;
    // AAAA KIDS MODE — Only spawn balloons carrying one of the CURRENT
    // round's definition-box terms. This guarantees every popped balloon has
    // a matching box — no more "missed because the word had no box" feedback.
    const box = Phaser.Utils.Array.GetRandom(this.defBoxes);
    const term = box.term;
    const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];

    // Spawn somewhere in the left 60% so the horizontal sway can carry the
    // balloon across multiple boxes — player must TIME the pop to land the
    // falling word in the correct definition box.
    const baseX = Phaser.Math.Between(120, this.scale.width - 120);
    const y = this.scale.height + 30; // start below screen

    // Build balloon visual
    const balloonCircle = this.add.circle(0, 0, 28, color, 1)
      .setStrokeStyle(2, 0xffffff, 0.5);
    // Highlight (glossy effect)
    const highlight = this.add.circle(-8, -8, 8, 0xffffff, 0.4);
    // String
    const string = this.add.text(0, 24, '〰️', { fontSize: '14px' }).setOrigin(0.5).setAlpha(0.6);
    // Word label on balloon
    const label = this.add.text(0, 0, term.term, {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(baseX, y, [balloonCircle, highlight, string, label])
      .setDepth(20);

    const balloon: Balloon = {
      container, term, hit: false, x: baseX, y, color,
      riseTween: null, baseX,
    };
    this.balloons.push(balloon);

    // Float up tween (12-15s rise time depending on level)
    // AAAA KIDS MODE — Gentler rise ramp + slow mode. Was 14000-(level-1)*1500 floor 6000.
    // Now: 14000-(level-1)*1000, floor 8000ms, divided by timeMultiplier().
    const riseDuration = Math.max(8000, 14000 - (this.level - 1) * 1000) / this.timeMultiplier();
    const startTime = this.time.now;
    const swayAmplitude = 60; // px left/right of baseX
    const swayPeriod = 2600; // ms for a full left-right cycle
    const riseTween = this.tweens.add({
      targets: container,
      y: -50,
      duration: riseDuration,
      ease: 'Sine.inOut',
      // AAAA — Horizontal sway gives the player TIMING control over where the
      // word will land. Without sway, the balloon's x is fixed and the player
      // has no way to aim the drop.
      onUpdate: () => {
        const elapsed = this.time.now - startTime;
        const sway = Math.sin((elapsed / swayPeriod) * Math.PI * 2) * swayAmplitude;
        const clamped = Math.max(40, Math.min(this.scale.width - 40, balloon.baseX + sway));
        container.x = clamped;
        balloon.x = clamped;
        balloon.y = container.y;
      },
      onComplete: () => {
        // Balloon escaped — remove silently (no penalty)
        if (!balloon.hit) {
          this.balloons.splice(this.balloons.indexOf(balloon), 1);
          try { container.destroy(); } catch {}
        }
      },
    });
    balloon.riseTween = riseTween;
  }

  // ===========================================================================
  // POP BALLOON — word drops down with gravity
  // ===========================================================================
  private popBalloon(b: Balloon) {
    if (b.hit) return;
    b.hit = true;
    // AAAA — Stop the rise/sway tween so the drop tween has full control of y.
    if (b.riseTween) { try { b.riseTween.stop(); } catch {} }

    // Pop sound + confetti
    audioBus.play('pop');
    this.juice.burst(b.x, b.y, 'correct');

    // Hide balloon parts, keep label visible — it falls
    (b.container.getAt(0) as Phaser.GameObjects.Arc).setVisible(false); // circle
    (b.container.getAt(1) as Phaser.GameObjects.Arc).setVisible(false); // highlight
    (b.container.getAt(2) as Phaser.GameObjects.Text).setVisible(false); // string
    // Keep label visible — it falls

    // Drop the word with gravity tween
    const dropTargetY = this.scale.height - 50; // where def boxes are

    this.tweens.add({
      targets: b.container,
      y: dropTargetY,
      duration: 800,
      ease: 'Cubic.in', // accelerating fall (gravity)
      onUpdate: () => {
        b.y = b.container.y;
        b.x = b.container.x;
      },
      onComplete: () => {
        // Check which def box the word landed in
        this._checkLanding(b);
        // Remove balloon
        this.balloons.splice(this.balloons.indexOf(b), 1);
        try { b.container.destroy(); } catch {}
      },
    });
  }

  // ===========================================================================
  // CHECK LANDING — did the word land in the right definition box?
  // ===========================================================================
  private _checkLanding(b: Balloon) {
    let landedBox: DefBox | null = null;
    for (const box of this.defBoxes) {
      if (Math.abs(b.x - box.x) < box.w / 2 && Math.abs(b.y - box.y) < box.h / 2) {
        landedBox = box;
        break;
      }
    }

    if (!landedBox) {
      // Missed all boxes — word fell between the cracks.
      this.promptText.setText(`❌ Missed! ${b.term.term} didn't land in any box. Try again!`);
      this.speakPromptWithHighlight(this.promptText, `Missed! ${b.term.term} didn't land in any box.`);
      audioBus.play('incorrect');
      this.juice.shake('light');
      this.juice.scorePopup(b.x, b.y - 30, '❌ Miss', this.theme.danger);
      this.recordAnswer({
        term: b.term.term, response: 'missed', success: false,
        coordinate: { x: b.x, y: b.y, t: this.time.now },
      });
      this.comboCount = 0;
      return;
    }

    // Check if correct match
    const isCorrect = landedBox.term.id === b.term.id;

    this.recordAnswer({
      term: b.term.term, response: landedBox.term.term, success: isCorrect,
      coordinate: { x: b.x, y: b.y, t: this.time.now },
    });

    if (isCorrect) {
      // Correct! Flash box green + big celebration
      landedBox.bg.setFillStyle(this.theme.success, 0.95);
      audioBus.play('correct');
      audioBus.speak(b.term.term);
      this.juice.burst(b.x, b.y, 'correct');
      this.juice.confettiRain(900);
      this.juice.scorePopup(b.x, b.y - 30, `✅ ${b.term.term}`, this.theme.success);

      // Combo system
      const now = Date.now();
      if (now - this.lastCorrectTime < 5000) {
        this.comboCount++;
      } else {
        this.comboCount = 1;
      }
      this.lastCorrectTime = now;

      const comboText = this.comboCount >= 2 ? `  🔥 x${this.comboCount} combo!` : '';
      this.promptText.setText(`✅ Correct! ${b.term.term} = ${landedBox.term.definition ?? landedBox.term.term}${comboText}`);
      this.speakPromptWithHighlight(this.promptText, `Correct! ${b.term.term}!`);
      this.juice.scorePopup(b.x, b.y - 60, `+1${comboText}`, this.theme.warning);

      // Reset box after delay
      setTimeout(() => {
        if (landedBox) landedBox.bg.setFillStyle(this.theme.card, 0.92);
      }, 600);

      // Next round
      this.currentRound++;
      if (this.currentRound >= this.maxScore) {
        this.time.delayedCall(1000, () => this.finishGame(true));
      } else {
        this.time.delayedCall(1500, () => {
          if (!this.isFinished) this._nextRound();
        });
      }
    } else {
      // Wrong box
      landedBox.bg.setFillStyle(this.theme.danger, 0.95);
      audioBus.play('incorrect');
      this.juice.shake('medium');
      this.promptText.setText(`❌ Wrong! ${b.term.term} doesn't match that definition.`);
      this.speakPromptWithHighlight(this.promptText, `Wrong! ${b.term.term} doesn't match.`);
      this.juice.scorePopup(b.x, b.y - 30, '❌ Wrong', this.theme.danger);
      this.comboCount = 0;

      setTimeout(() => {
        if (landedBox) landedBox.bg.setFillStyle(this.theme.card, 0.92);
      }, 600);
    }
  }

  // ===========================================================================
  // NEXT ROUND
  // ===========================================================================
  private _nextRound() {
    // Pick a fresh set of definition boxes for the next round.
    this._buildDefBoxes();
  }
}
