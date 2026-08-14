import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// RHYTHM TAP — Multi-lane vocabulary rhythm game (AAA 2029 edition)
// ============================================================================
// Guitar-Hero-inspired gameplay:
//   • 3 lanes (left / center / right) — each lane carries a falling note
//   • Notes fall in time with a beat grid
//   • Tap the correct lane when the word crosses the hit line
//   • Perfect = 3pts + combo, Good = 2pts, OK = 1pt, Miss = 0pts + combo reset
//   • Combo multiplier kicks in at 5 / 10 / 20 — score popup + screen flash
//   • Beat pulse on the hit line + background grid sweep
//   • Audio cue (60 BPM tick) keeps rhythm for ESL learners
//   • AAAA: Only SPOKEN words (gold) must be tapped. Unspoken words (gray) pass freely.
//   • Tapping an unspoken word = drama (flash + shake + score -2 + "Don't tap!")
//   • Letting a spoken word pass = miss (combo reset)
//   • Words repeat continuously until 150s timeout
// ============================================================================

interface FallingNote {
  lane: 0 | 1 | 2;
  word: string;
  y: number;
  speed: number;
  hit: boolean;
  missed: boolean;
  text: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  spoken: boolean; // AAAA: tracks whether the word has been vocalized as it falls
  mustTap: boolean; // AAAA: only spoken words require a tap — unspoken pass freely
}

export default class RhythmTapScene extends BaseEngine {
  private readonly LANES = 3;
  private readonly LANE_W = 180;
  private readonly HIT_LINE_Y = 380;
  private readonly SPAWN_Y = -40;

  private notes: FallingNote[] = [];
  private combo = 0;
  private maxCombo = 0;
  private perfects = 0;
  private goods = 0;
  private oks = 0;
  private misses = 0;
  private totalScore = 0;

  private laneBg: Phaser.GameObjects.Rectangle[] = [];
  private laneFlash: Phaser.GameObjects.Rectangle[] = [];
  private laneButtons: Phaser.GameObjects.Container[] = [];
  private hitLine!: Phaser.GameObjects.Rectangle;
  private hitLineGlow!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  // AAAA: Color-coding toggle — when true, must-tap notes glow gold and
  // free-pass notes are dim gray. When false, all notes look identical
  // and the child must rely on audio only (harder "pure listening" mode).
  // Read from localStorage 'ministar-rhythm-color-code' (default: true).
  private _stalledNotes: FallingNote[] = []; // AAAA: missed notes that stall in the lane
  private readonly MAX_STALLED = 5; // AAAA: game ends when this many notes are stalled
  private _colorCodeNotes = true; // AAAA: optional color-coding toggle
  private feedbackText!: Phaser.GameObjects.Text;
  private accuracyText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private gameLoop?: Phaser.Time.TimerEvent;
  private beatTimer?: Phaser.Time.TimerEvent;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private notesIdx = 0;
  private notesQueue: string[] = [];
  private beatPulse = 0;
  private canTap = true;

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    // AAAA: Load color-code preference from localStorage (default: ON).
    try {
      this._colorCodeNotes = localStorage.getItem('ministar-rhythm-color-code') !== 'false';
    } catch {}

    this.add.text(this.scale.width / 2, 35, '🎵 Rhythm Tap', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 65, 540, 28, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.5).setDepth(48);
    const prompt = this.add.text(this.scale.width / 2, 65,
      'Tap the lane (Left / Center / Right) when the word crosses the line!',
      { fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: this.hex(this.theme.text), fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(prompt, 'Tap the lane when the word crosses the line!');

    // Score + combo
    this.scoreText = this.add.text(20, 90, 'Score: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.comboText = this.add.text(this.scale.width - 20, 90, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Build 3 lanes
    const totalW = this.LANES * this.LANE_W;
    const startX = (this.scale.width - totalW) / 2 + this.LANE_W / 2;

    for (let i = 0; i < this.LANES; i++) {
      const x = startX + i * this.LANE_W;
      // Lane background
      const bg = this.add.rectangle(x, 280, this.LANE_W - 8, 320, this.theme.cardAlt, 0.4)
        .setStrokeStyle(2, this.theme.accent, 0.25).setDepth(5);
      this.laneBg.push(bg);
      // Lane flash (alpha=0 by default, pulses on tap)
      const flash = this.add.rectangle(x, 280, this.LANE_W - 8, 320, this.theme.accent, 0)
        .setDepth(6);
      this.laneFlash.push(flash);
      // Lane button (bottom)
      const btnW = this.LANE_W - 16, btnH = 60;
      const btnBg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.95)
        .setStrokeStyle(3, this.theme.accent, 0.7);
      const btnLabel = this.add.text(0, 0,
        i === 0 ? '◀ LEFT' : i === 1 ? '▲ TAP ▲' : 'RIGHT ▶',
        { fontFamily: 'Inter, sans-serif', fontSize: '18px',
          color: '#ffffff', fontStyle: 'bold' }
      ).setOrigin(0.5);
      const btn = this.add.container(x, this.scale.height - 60, [btnBg, btnLabel])
        .setSize(btnW, btnH).setDepth(40);
      this.laneButtons.push(btn);
    }

    // Hit line + glow
    this.hitLineGlow = this.add.rectangle(this.scale.width / 2, this.HIT_LINE_Y,
      totalW + 20, 24, this.theme.success, 0.25).setDepth(8);
    this.hitLine = this.add.rectangle(this.scale.width / 2, this.HIT_LINE_Y,
      totalW + 20, 4, this.theme.success, 0.9).setDepth(10);
    this.add.text(this.scale.width / 2, this.HIT_LINE_Y - 22, '━━ HIT LINE ━━',
      { fontFamily: 'Inter, sans-serif', fontSize: '11px',
        color: this.hex(this.theme.success) }
    ).setOrigin(0.5).setDepth(11);

    // Feedback + accuracy
    this.feedbackText = this.add.text(this.scale.width / 2, 440, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(60);
    this.accuracyText = this.add.text(this.scale.width / 2, 470, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(60);

    // AAAA: Build notes queue — repeat words to fill a large queue for
    // continuous spawning (game runs until timeout at 150s, not until queue empty).
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.notesQueue = [];
    // Fill with 3x the pool size so there's always more to spawn.
    const targetCount = Math.max(pool.length * 3, 30);
    while (this.notesQueue.length < targetCount) {
      this.notesQueue.push(pool[this.notesQueue.length % pool.length].term);
    }

    // Tap handlers — global pointerdown checks all 3 lane buttons
    this.setupGlobalPointer((x, y) => {
      if (!this.canTap || this.isFinished) return;
      for (let i = 0; i < this.laneButtons.length; i++) {
        const btn = this.laneButtons[i];
        if (Math.abs(x - btn.x) < (this.LANE_W - 16) / 2 &&
            Math.abs(y - btn.y) < 30) {
          this._handleLaneTap(i as 0 | 1 | 2);
          return;
        }
      }
    });

    // Beat timer — 100 BPM tick + hit-line pulse
    this.beatTimer = this.time.addEvent({
      delay: 600, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.beatTimer) this.beatTimer.remove(); return; }
        this.beatPulse = 1;
        try { audioBus.play('tap', { freq: 220 }); } catch {}
      },
    });

    // Spawn timer — spawn a new note every 1.8s (continuous, never stops until game ends)
    this.spawnTimer = this.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.spawnTimer) this.spawnTimer.remove(); return; }
        this._spawnNote();
      },
    });

    // First note spawns immediately
    this._spawnNote();

    // Game loop — advance all notes
    this.gameLoop = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => this._tick(),
    });
  }

  protected onTick(_remainingMs: number) {
    // Beat pulse decay on the hit line
    if (this.beatPulse > 0) {
      this.beatPulse = Math.max(0, this.beatPulse - 0.06);
      this.hitLineGlow.setAlpha(0.25 + this.beatPulse * 0.5);
      this.hitLine.setScale(1, 1 + this.beatPulse * 0.3);
    }
  }

  private _spawnNote() {
    // AAAA: Infinite spawning — loop the queue, don't stop when we reach the end.
    // Game only ends on timeout (150s) or score threshold. Words repeat.
    if (this.notesQueue.length === 0) return;
    const word = this.notesQueue[this.notesIdx % this.notesQueue.length];
    this.notesIdx++;

    const lane = Math.floor(Math.random() * this.LANES) as 0 | 1 | 2;

    // AAAA: Only ~50% of notes are "must tap" (spoken words). The rest are
    // silent decoys that pass through freely. This makes it a game of
    // "listen and tap only correct items" — not tap-everything.
    const mustTap = Math.random() < 0.5;

    const totalW = this.LANES * this.LANE_W;
    const startX = (this.scale.width - totalW) / 2 + this.LANE_W / 2;
    const x = startX + lane * this.LANE_W;

    // AAAA: Color identification is OPTIONAL — controlled by _colorCodeNotes flag.
    // When ON: must-tap notes glow gold, free-pass notes are dim gray.
    // When OFF: all notes look identical — child must rely on AUDIO ONLY
    // (whether the word was spoken) to decide which to tap. This is the
    // harder "pure listening" mode, toggled by a setting.
    const colorCode = this._colorCodeNotes;
    const bgColor = colorCode
      ? (mustTap ? this.theme.warning : this.theme.card)
      : this.theme.accent; // Same color for both when color-coding is OFF
    const bgAlpha = colorCode ? (mustTap ? 0.9 : 0.5) : 0.85;
    const strokeColor = colorCode ? (mustTap ? 0xffff00 : 0xffffff) : 0xffffff;
    const strokeAlpha = colorCode ? (mustTap ? 0.8 : 0.3) : 0.4;
    const textColor = colorCode ? (mustTap ? '#ffffff' : '#999999') : '#ffffff';

    const bg = this.add.rectangle(x, this.SPAWN_Y, this.LANE_W - 24, 50,
      bgColor, bgAlpha)
      .setStrokeStyle(2, strokeColor, strokeAlpha).setDepth(15);
    const text = this.add.text(x, this.SPAWN_Y, word, {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: textColor, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);

    const note: FallingNote = {
      lane, word, y: this.SPAWN_Y, speed: (1.0 + Math.min(1.2, this.notesIdx * 0.03)) * this.timeMultiplier(),
      hit: false, missed: false, text, bg, spoken: false, mustTap,
    };
    this.notes.push(note);
    // Pulse the lane slightly to telegraph the incoming note
    this._flashLane(lane, 0.3);
  }

  private _tick() {
    if (this.isFinished) { if (this.gameLoop) this.gameLoop.remove(); return; }
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      note.y += note.speed;
      note.text.y = note.y;
      note.bg.y = note.y;
      // AAAA: Vocalize the word when it reaches the "reading zone" (middle of screen).
      // ONLY must-tap notes are spoken — free-pass notes stay silent.
      if (!note.spoken && note.mustTap && note.y > 120 && note.y < 250) {
        note.spoken = true;
        audioBus.speak(note.word, { rate: 0.92, pitch: 1.05 });
      }
      // AAAA: Only must-tap notes register a miss when they pass the hit line.
      // Free-pass notes (mustTap=false) pass through with NO consequence.
      if (note.y > this.HIT_LINE_Y + 30) {
        if (note.mustTap) {
          note.missed = true;
          this._registerMiss(note);
        } else {
          // Free-pass note passed — fade it out silently.
          note.missed = true;
          this.tweens.add({
            targets: [note.text, note.bg],
            alpha: 0, duration: 300, ease: 'Cubic.out',
            onComplete: () => { try { note.text.destroy(); note.bg.destroy(); } catch {} },
          });
        }
      }
    }
    // Cleanup dead notes (off-screen below)
    this.notes = this.notes.filter(n => {
      if (n.y > this.scale.height + 50) {
        try { n.text.destroy(); n.bg.destroy(); } catch {}
        return false;
      }
      return true;
    });
  }

  private _handleLaneTap(lane: 0 | 1 | 2) {
    if (!this.canTap || this.isFinished) return;
    this._flashLane(lane, 0.6);
    audioBus.play('flip');

    // Find the closest un-hit MUST-TAP note in this lane near the hit line.
    // Free-pass notes (mustTap=false) are IGNORED — tapping them is a mistake.
    let best: FallingNote | null = null;
    let bestDist = Infinity;
    let tappedFreePass: FallingNote | null = null;

    for (const note of this.notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const dist = Math.abs(note.y - this.HIT_LINE_Y);
      if (dist < 80) {
        if (note.mustTap && dist < bestDist) {
          bestDist = dist;
          best = note;
        } else if (!note.mustTap && !tappedFreePass && dist < 40) {
          // Tapping a free-pass (unspoken) note — this is a MISTAKE.
          tappedFreePass = note;
        }
      }
    }

    // AAAA: Tapping an unspoken (free-pass) word = penalty (drama, loss).
    if (tappedFreePass && !best) {
      const fp = tappedFreePass as FallingNote;
      fp.hit = true; // Mark so it doesn't also count as a miss
      audioBus.play('incorrect');
      this.juice.shake('medium');
      this.juice.flash(this.theme.danger, 0.4, 250);
      this.juice.scorePopup(fp.text.x, fp.text.y - 20, '❌ Don\'t tap!', this.theme.danger);
      this.combo = 0;
      this._updateCombo();
      this.totalScore = Math.max(0, this.totalScore - 2); // Score deduction
      this.scoreText.setText('Score: ' + this.totalScore);
      this.feedbackText.setText(`❌ ${fp.word} was not called!`);
      this.feedbackText.setColor('#' + this.theme.danger.toString(16).padStart(6, '0'));
      audioBus.speak(`Don't tap! ${fp.word} was not called!`, { rate: 0.9 });
      // Squash the wrongly-tapped note
      this.tweens.add({
        targets: [fp.text, fp.bg],
        scale: 0.5, alpha: 0, duration: 200, ease: 'Cubic.in',
        onComplete: () => { try { fp.text.destroy(); fp.bg.destroy(); } catch {} },
      });
      this.recordAnswer({
        term: fp.word, response: 'wrong-tap', success: false,
        coordinate: { x: fp.text.x, y: fp.text.y, t: this.time.now },
      });
      return;
    }

    if (!best) {
      // No must-tap note in this lane near the hit line — no penalty (just a tap)
      return;
    }

    const note = best as FallingNote;
    note.hit = true;
    let timing: string, points: number;
    if (bestDist < 12) { timing = 'PERFECT!'; points = 3; this.combo++; this.perfects++; }
    else if (bestDist < 28) { timing = 'GOOD!'; points = 2; this.combo++; this.goods++; }
    else if (bestDist < 60) { timing = 'OK'; points = 1; this.combo = 0; this.oks++; }
    else { timing = 'MISS!'; points = 0; this.combo = 0; this.misses++; }

    // Combo bonuses
    if (this.combo >= 5) points += 1;
    if (this.combo >= 10) points += 1;
    if (this.combo >= 20) points += 2;
    if (this.maxCombo < this.combo) this.maxCombo = this.combo;

    this.totalScore += points;
    this.scoreText.setText('Score: ' + this.totalScore);
    this._updateCombo();

    if (timing !== 'MISS!') {
      audioBus.play('correct');
      // AAAA KIDS MODE — Speak the note word with karaoke highlight.
      this.speakPromptWithHighlight(note.text, note.word);
      this.juice.burst(note.text.x, note.text.y, this.combo >= 5 ? 'streak' : 'correct');
      this.juice.scorePopup(note.text.x, note.text.y - 30,
        `${timing} +${points}`, timing === 'PERFECT!' ? this.theme.warning : this.theme.success);

      // AAAA THREE-TIER JUICE LOOP — woven into the hit logic:
      // Tier 1 (0-50ms): Squash-and-stretch the note text + bg.
      // Tier 2 (50-150ms): Hit-Stop (2-frame freeze) + particle burst.
      // Tier 3 (150-500ms): ⭐ reward flies to score UI anchor.
      this._threeTierJuice(note.text.x, note.text.y, note.text);

      // Destroy note after Three-Tier Juice completes (scale tween handles it).
      this.time.delayedCall(300, () => {
        try { note.text.destroy(); note.bg.destroy(); } catch {}
      });
    } else {
      audioBus.play('incorrect');
      this.juice.shake('light');
    }

    this.recordAnswer({
      term: note.word, response: timing,
      success: timing !== 'MISS!',
      coordinate: { x: note.text.x, y: note.text.y, t: this.time.now },
    });

    this.feedbackText.setText(`${timing} — ${note.word}`);
    this.feedbackText.setColor(timing === 'PERFECT!' ? '#' + this.theme.warning.toString(16).padStart(6, '0')
      : timing === 'GOOD!' ? '#' + this.theme.success.toString(16).padStart(6, '0')
      : timing === 'OK' ? '#ffffff'
      : '#' + this.theme.danger.toString(16).padStart(6, '0'));

    // Accuracy
    const total = this.perfects + this.goods + this.oks + this.misses;
    const acc = total > 0 ? Math.round(((this.perfects + this.goods + this.oks) / total) * 100) : 100;
    this.accuracyText.setText(`Perfect ${this.perfects} · Good ${this.goods} · OK ${this.oks} · Miss ${this.misses} · ${acc}% accuracy`);

    // Streak flash at combo milestones
    if (this.combo === 5 || this.combo === 10 || this.combo === 20) {
      this.juice.flash(this.theme.warning, 0.2, 200);
      this.juice.scorePopup(this.scale.width / 2, 200,
        `COMBO x${this.combo}!`, this.theme.warning);
    }

    this.checkWin();
  }

  private _registerMiss(note: FallingNote, wrongLane = false) {
    this.combo = 0;
    this.misses++;
    this._updateCombo();
    audioBus.play('incorrect');
    this.juice.shake('light');
    this.feedbackText.setText(wrongLane ? '✗ WRONG LANE!' : '✗ MISS!');
    this.feedbackText.setColor('#' + this.theme.danger.toString(16).padStart(6, '0'));

    this.recordAnswer({
      term: note.word, response: wrongLane ? 'wrong-lane' : 'miss',
      success: false,
      coordinate: { x: this.scale.width / 2, y: this.HIT_LINE_Y, t: this.time.now },
    });

    const total = this.perfects + this.goods + this.oks + this.misses;
    const acc = total > 0 ? Math.round(((this.perfects + this.goods + this.oks) / total) * 100) : 100;
    this.accuracyText.setText(`Perfect ${this.perfects} · Good ${this.goods} · OK ${this.oks} · Miss ${this.misses} · ${acc}% accuracy`);

    // AAAA: Missed must-tap notes STALL in the lane — they don't disappear.
    // They stack up visually (turning red + semi-transparent) and block the lane.
    // When MAX_STALLED notes accumulate, the game ends (lane is too clogged).
    if (!wrongLane && note.mustTap) {
      // Stop the note at the hit line — it stalls here.
      note.y = this.HIT_LINE_Y;
      note.text.y = note.y;
      note.bg.y = note.y;
      note.missed = true; // Prevents re-processing in _tick

      // Turn it red + semi-transparent to show it's stalled.
      try {
        note.bg.setFillStyle(this.theme.danger, 0.6);
        note.bg.setStrokeStyle(3, this.theme.danger, 0.9);
        note.text.setColor('#ff6666');
        note.text.setAlpha(0.7);
      } catch {}

      // Add a "stalled" wobble animation.
      this.tweens.add({
        targets: [note.text, note.bg],
        x: { from: note.text.x - 3, to: note.text.x + 3 },
        duration: 200, yoyo: true, repeat: 999, ease: 'Sine.inOut',
      });

      this._stalledNotes.push(note);

      // Show stalled count warning.
      this.juice.scorePopup(note.text.x, note.text.y - 30, `⚠ STALLED! (${this._stalledNotes.length}/${this.MAX_STALLED})`, this.theme.danger);
      audioBus.speak(`Missed! ${note.word}!`, { rate: 0.92 });

      // Check if too many stalled notes — game over.
      if (this._stalledNotes.length >= this.MAX_STALLED) {
        this.time.delayedCall(500, () => {
          this._finish();
        });
      }
    } else if (!wrongLane) {
      // Free-pass note missed (shouldn't happen — they don't register misses).
      // Just fade it out.
      this.tweens.add({
        targets: [note.text, note.bg],
        alpha: 0, duration: 300, ease: 'Cubic.out',
        onComplete: () => { try { note.text.destroy(); note.bg.destroy(); } catch {} },
      });
    }
  }

  private _flashLane(lane: number, intensity: number) {
    const flash = this.laneFlash[lane];
    if (!flash) return;
    flash.setAlpha(intensity);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 250, ease: 'Cubic.out',
    });
  }

  private _updateCombo() {
    if (this.combo >= 2) {
      this.comboText.setText(`🔥 x${this.combo}`);
    } else {
      this.comboText.setText('');
    }
  }

  private _finish() {
    if (this.isFinished) return;
    // AAAA: Game ends on timeout or score threshold, not when queue is empty.
    // Win = at least 50% of tapped must-tap words were correct.
    const total = this.perfects + this.goods + this.oks + this.misses;
    const win = total > 0 && (this.perfects + this.goods) / total >= 0.5;
    this.finishGame(win);
  }
}
