import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// TOWER DEFENSE — Real-time enemy waves. Tap correct word to shoot enemies.
// Castle HP = lives. 3 waves of increasing difficulty.

interface Enemy { word: string; emoji: string; progress: number; reached: boolean; defeated: boolean; text: Phaser.GameObjects.Text; }

export default class TowerDefenseScene extends BaseEngine {
  private enemies: Enemy[] = [];
  private castleHp = 5;
  private maxCastleHp = 5;
  private currentWave = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private castleText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private gameLoop?: Phaser.Time.TimerEvent;
  private canAct = true;

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 55, '🏰 Tower Defense', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 90, 600, 40, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 90, 'Tap the matching word to shoot enemies!', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this.waveText = this.add.text(20, 115, 'Wave 1/3', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.hpText = this.add.text(this.scale.width - 20, 115, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Castle at right side
    this.castleText = this.add.text(this.scale.width - 60, 300, '🏰', { fontSize: '48px' }).setOrigin(0.5).setDepth(30);

    // Enemy path line
    const pathLine = this.add.rectangle(this.scale.width / 2 - 30, 300, this.scale.width - 120, 4, this.theme.accent, 0.2).setDepth(5);

    this._startWave();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      for (let i = 0; i < this.optionButtons.length; i++) {
        const btn = this.optionButtons[i];
        if (Math.abs(x - btn.x) < 110 && Math.abs(y - btn.y) < 25) {
          this._shootWord(i);
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _startWave() {
    if (this.currentWave >= 3) { this.finishGame(true); return; }
    this.currentWave++;
    this.waveText.setText(`Wave ${this.currentWave}/3`);
    this.enemies = [];
    this.canAct = true;

    const waveSize = 2 + this.currentWave;
    const waveSpeed = 0.005 + this.currentWave * 0.003;
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);

    for (let i = 0; i < waveSize; i++) {
      const term = pool[i % pool.length];
      const text = this.add.text(40, 300, `👾 ${term.term}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        backgroundColor: '#' + this.theme.danger.toString(16).padStart(6, '0'), padding: { x: 8, y: 4 },
      }).setOrigin(0.5, 0.5).setDepth(20);
      this.enemies.push({ word: term.term, emoji: '👾', progress: -i * 0.15, reached: false, defeated: false, text });
    }

    this._renderOptions();
    this._updateHp();

    // Game loop — enemies advance
    this.gameLoop = this.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.gameLoop) this.gameLoop.remove(); return; }
        let allDone = true;
        this.enemies.forEach(e => {
          if (!e.reached && !e.defeated) {
            allDone = false;
            e.progress += waveSpeed;
            e.text.x = 40 + e.progress * (this.scale.width - 120);
            if (e.progress >= 1) {
              e.reached = true;
              this.castleHp--;
              this._updateHp();
              audioBus.play('incorrect');
              this.juice.shake('light');
              e.text.setVisible(false);
              if (this.castleHp <= 0) {
                if (this.gameLoop) this.gameLoop.remove();
                this.finishGame(false);
                return;
              }
            }
          }
        });
        if (allDone) {
          if (this.gameLoop) this.gameLoop.remove();
          this.time.delayedCall(1500, () => { if (!this.isFinished) this._startWave(); });
        }
      },
    });
  }

  private _renderOptions() {
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];
    const activeEnemies = this.enemies.filter(e => !e.reached && !e.defeated);
    const words = activeEnemies.map(e => e.word);
    // Add wrong options
    const wrong = this.terms.filter(t => words.indexOf(t.term) === -1).slice(0, 2).map(t => t.term);
    const allOptions = Phaser.Utils.Array.Shuffle([...words, ...wrong]).slice(0, Math.min(5, words.length + 2));

    const startY = 420;
    allOptions.forEach((word, i) => {
      const y = startY + Math.floor(i / 2) * 55;
      const x = this.scale.width / 2 + (i % 2 === 0 ? -130 : 130);
      const bg = this.add.rectangle(0, 0, 240, 44, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, word, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(240, 44).setDepth(40);
      this.makeSpeakable(txt, word);
      this.optionButtons.push(container);
    });
  }

  private _shootWord(idx: number) {
    const btn = this.optionButtons[idx];
    const word = (btn.getAt(1) as Phaser.GameObjects.Text).text;
    // Find closest enemy with this word
    let target: Enemy | null = null;
    let maxProgress = -1;
    for (const e of this.enemies) {
      if (!e.reached && !e.defeated && e.word === word && e.progress > maxProgress) {
        maxProgress = e.progress;
        target = e;
      }
    }

    if (target) {
      const t: Enemy = target;
      t.defeated = true;
      t.text.setVisible(false);
      this.juice.burst(t.text.x, t.text.y, 'correct');
      audioBus.play('correct');
      audioBus.speak(word);
      this.recordAnswer({
        term: word, response: 'shot', success: true,
        coordinate: { x: t.text.x, y: t.text.y, t: this.time.now },
      });
      this.checkWin();
      this._renderOptions();
    } else {
      audioBus.play('incorrect');
    }
  }

  private _updateHp() {
    const hearts = '🟩'.repeat(Math.max(0, this.castleHp)) + '⬜'.repeat(Math.max(0, this.maxCastleHp - this.castleHp));
    this.hpText.setText(`🏰 ${hearts}`);
  }
}
