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
//   • Wrong-lane tap = MISS + combo reset (encourages reading, not mashing)
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

  protected maxQuestions() { return Math.min(this.terms.length, 18); }

  protected buildWorld() {
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
    this.makeSpeakable(prompt, 'Tap the lane when the word crosses the line!');

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

    // Build notes queue: shuffle terms, repeat to fill maxQuestions
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);
    this.notesQueue = [];
    while (this.notesQueue.length < this.maxQuestions()) {
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

    // Spawn timer — spawn a new note every 1.8s
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
    if (this.notesIdx >= this.notesQueue.length) {
      if (this.notes.length === 0) this._finish();
      return;
    }
    const lane = Math.floor(Math.random() * this.LANES) as 0 | 1 | 2;
    const word = this.notesQueue[this.notesIdx];
    this.notesIdx++;

    const totalW = this.LANES * this.LANE_W;
    const startX = (this.scale.width - totalW) / 2 + this.LANE_W / 2;
    const x = startX + lane * this.LANE_W;

    const bg = this.add.rectangle(x, this.SPAWN_Y, this.LANE_W - 24, 50,
      this.theme.accent, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.4).setDepth(15);
    const text = this.add.text(x, this.SPAWN_Y, word, {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);

    const note: FallingNote = {
      // AAAA KIDS MODE — Gentler speed ramp + slow mode. Was 1.2 + notesIdx*0.05 cap +2.0.
      // Now: 1.0 + notesIdx*0.03 cap +1.2, multiplied by timeMultiplier().
      lane, word, y: this.SPAWN_Y, speed: (1.0 + Math.min(1.2, this.notesIdx * 0.03)) * this.timeMultiplier(),
      hit: false, missed: false, text, bg,
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
      // Missed? (passed the hit line by more than 30px)
      if (note.y > this.HIT_LINE_Y + 30) {
        note.missed = true;
        this._registerMiss(note);
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

    // Find the closest un-hit note in this lane near the hit line
    let best: FallingNote | null = null;
    let bestDist = Infinity;
    for (const note of this.notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const dist = Math.abs(note.y - this.HIT_LINE_Y);
      if (dist < bestDist && dist < 80) {
        bestDist = dist;
        best = note;
      }
    }

    if (!best) {
      // Wrong-lane tap (no note in this lane near the hit line)
      this._registerMiss({ word: '—', lane, hit: false, missed: true } as FallingNote, true);
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
      // Squash the note before destroying
      this.tweens.add({
        targets: [note.text, note.bg],
        scale: 1.4, alpha: 0, duration: 200, ease: 'Back.out',
        onComplete: () => { try { note.text.destroy(); note.bg.destroy(); } catch {} },
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

    if (!wrongLane) {
      // Squash the missed note
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
    const total = this.perfects + this.goods + this.oks + this.misses;
    const win = total > 0 && (this.perfects + this.goods) / total >= 0.5;
    this.finishGame(win);
  }
}
