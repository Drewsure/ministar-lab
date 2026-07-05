import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// MONSTER FIGHTER — Turn-based RPG battle with vocabulary spells
// Cast spells (vocab words) to defeat monsters. Match weakness = double damage.

interface Monster { name: string; emoji: string; hp: number; maxHp: number; weakness: string; vocab: string; }
interface Spell { name: string; emoji: string; element: string; power: number; }

const MONSTERS: Monster[] = [
  { name: 'Slime', emoji: '🟢', hp: 3, maxHp: 3, weakness: 'fire', vocab: 'fire' },
  { name: 'Bat', emoji: '🦇', hp: 3, maxHp: 3, weakness: 'light', vocab: 'light' },
  { name: 'Golem', emoji: '🪨', hp: 4, maxHp: 4, weakness: 'water', vocab: 'water' },
  { name: 'Ghost', emoji: '👻', hp: 3, maxHp: 3, weakness: 'light', vocab: 'shadow' },
  { name: 'Wolf', emoji: '🐺', hp: 4, maxHp: 4, weakness: 'frost', vocab: 'wind' },
  { name: 'Dragon', emoji: '🐉', hp: 6, maxHp: 6, weakness: 'thunder', vocab: 'dragon' },
];

const SPELLS: Spell[] = [
  { name: 'Fire Ball', emoji: '🔥', element: 'fire', power: 2 },
  { name: 'Water Wave', emoji: '🌊', element: 'water', power: 2 },
  { name: 'Earth Quake', emoji: '🌍', element: 'earth', power: 2 },
  { name: 'Wind Slash', emoji: '🌪️', element: 'wind', power: 2 },
  { name: 'Light Beam', emoji: '✨', element: 'light', power: 3 },
  { name: 'Thunder Bolt', emoji: '⚡', element: 'thunder', power: 3 },
  { name: 'Frost Bite', emoji: '❄️', element: 'frost', power: 2 },
];

export default class MonsterFighterScene extends BaseEngine {
  private monsterIdx = 0;
  private currentMonster!: Monster;
  private monsterHp = 0;
  private playerHp = 5;
  private maxPlayerHp = 5;
  private monsterEmoji!: Phaser.GameObjects.Text;
  private monsterNameText!: Phaser.GameObjects.Text;
  private monsterHpBar!: Phaser.GameObjects.Rectangle;
  private monsterHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spellButtons: Phaser.GameObjects.Container[] = [];
  private canAct = true;
  private feedbackText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return MONSTERS.length; }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 55, '⚔️ Monster Fighter', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px', color: this.hex(this.theme.danger), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 90, 600, 40, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.danger, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 90, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Monster display
    this.monsterEmoji = this.add.text(this.scale.width / 2, 180, '', { fontSize: '72px' }).setOrigin(0.5).setDepth(30);
    this.monsterNameText = this.add.text(this.scale.width / 2, 240, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.makeSpeakable(this.monsterNameText);

    // Monster HP bar
    this.add.rectangle(this.scale.width / 2, 275, 200, 16, 0x000000, 0.5).setDepth(29);
    this.monsterHpBar = this.add.rectangle(this.scale.width / 2 - 100, 275, 200, 16, this.theme.danger, 1)
      .setOrigin(0, 0.5).setDepth(30);
    this.monsterHpText = this.add.text(this.scale.width / 2, 290, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(30);

    // Player HP
    this.playerHpText = this.add.text(this.scale.width / 2, 320, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);

    // Feedback text
    this.feedbackText = this.add.text(this.scale.width / 2, 360, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5).setDepth(30);

    this._buildSpellButtons();
    this._startBattle();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      for (let i = 0; i < this.spellButtons.length; i++) {
        const btn = this.spellButtons[i];
        if (Math.abs(x - btn.x) < 90 && Math.abs(y - btn.y) < 28) {
          this._castSpell(i);
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildSpellButtons() {
    const startY = 440;
    const cols = 4;
    const btnW = 170, btnH = 50, gap = 10;
    const totalW = cols * btnW + (cols - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + btnW / 2;

    SPELLS.forEach((spell, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnW + gap);
      const y = startY + row * (btnH + gap);
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.9).setStrokeStyle(2, this.theme.danger, 0.5);
      const txt = this.add.text(0, 0, `${spell.emoji} ${spell.name}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(btnW, btnH).setDepth(40);
      this.spellButtons.push(container);
    });
  }

  private _startBattle() {
    if (this.monsterIdx >= MONSTERS.length) { this.finishGame(true); return; }
    this.currentMonster = { ...MONSTERS[this.monsterIdx] };
    this.monsterHp = this.currentMonster.hp;
    this.canAct = true;
    this.monsterEmoji.setText(this.currentMonster.emoji);
    this.monsterNameText.setText(this.currentMonster.name);
    this._updateHpBars();
    this.promptText.setText(`Battle ${this.monsterIdx + 1}/${MONSTERS.length} — Weakness: ${this.currentMonster.weakness}`);
    this.makeSpeakable(this.promptText, `Battle ${this.monsterIdx + 1}. The ${this.currentMonster.name} is weak against ${this.currentMonster.weakness}!`);
    this.feedbackText.setText('');
    audioBus.speak(`${this.currentMonster.name} appears! It is weak against ${this.currentMonster.weakness}!`);
  }

  private _updateHpBars() {
    const pct = this.monsterHp / this.currentMonster.maxHp;
    this.monsterHpBar.width = 200 * pct;
    this.monsterHpText.setText(`HP: ${Math.max(0, this.monsterHp)}/${this.currentMonster.maxHp}`);
    this.playerHpText.setText(`❤️ Your HP: ${this.playerHp}/${this.maxPlayerHp}`);
  }

  private _castSpell(idx: number) {
    if (!this.canAct) return;
    this.canAct = false;
    const spell = SPELLS[idx];
    const isEffective = spell.element === this.currentMonster.weakness;
    const damage = isEffective ? spell.power * 2 : spell.power;
    this.monsterHp -= damage;

    this.recordAnswer({
      term: spell.name,
      response: this.currentMonster.name,
      success: isEffective,
      coordinate: { x: this.monsterEmoji.x, y: this.monsterEmoji.y, t: this.time.now },
    });

    if (isEffective) {
      this.feedbackText.setText(`✨ SUPER EFFECTIVE! ${spell.name} deals ${damage} damage!`);
      audioBus.speak(`Super effective! ${spell.name}!`);
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'correct');
    } else {
      this.feedbackText.setText(`${spell.emoji} ${spell.name} deals ${damage} damage.`);
      audioBus.speak(spell.name);
    }
    this._updateHpBars();

    if (this.monsterHp <= 0) {
      // Monster defeated
      this.feedbackText.setText(`🎉 ${this.currentMonster.name} defeated! You learned: ${this.currentMonster.vocab}!`);
      audioBus.speak(`${this.currentMonster.name} defeated! You learned the word: ${this.currentMonster.vocab}!`);
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'win');
      this.time.delayedCall(2000, () => {
        if (this.isFinished) return;
        this.monsterIdx++;
        this._startBattle();
      });
    } else {
      // Monster counter-attacks
      this.time.delayedCall(1000, () => {
        if (this.isFinished) return;
        this.playerHp--;
        this.feedbackText.setText(`💥 ${this.currentMonster.name} attacks! -1 HP`);
        audioBus.play('incorrect');
        this.juice.shake('light');
        this._updateHpBars();
        if (this.playerHp <= 0) {
          this.finishGame(false);
          return;
        }
        this.time.delayedCall(1000, () => {
          if (this.isFinished) return;
          this.feedbackText.setText('');
          this.canAct = true;
        });
      });
    }
  }
}
