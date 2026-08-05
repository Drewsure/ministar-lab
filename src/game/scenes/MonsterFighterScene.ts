import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MONSTER FIGHTER — Turn-based RPG battle (AAA 2029 edition)
// ============================================================================
// Premium combat:
//   • Floating damage numbers (red on hit, gold on crit, green on heal)
//   • Spell cooldown indicators (3-tier spells have longer cooldowns)
//   • Player XP bar — level up mid-battle to restore HP and unlock ult
//   • Particle bursts on hit + screen shake on big damage
//   • Monster idle bobbing + angry flash on low HP
//   • Combo system: consecutive effective spells build a damage multiplier
//   • "ULT" spell unlocked at level 3 — deals 5x damage, once per battle
// ============================================================================

interface Monster {
  name: string; emoji: string; hp: number; maxHp: number;
  weakness: string; vocab: string; attackPower: number;
}
interface Spell {
  name: string; emoji: string; element: string; power: number;
  cooldown: number; tier: 1 | 2 | 3;
}

const MONSTERS: Monster[] = [
  { name: 'Slime', emoji: '🟢', hp: 4, maxHp: 4, weakness: 'fire',  vocab: 'fire',   attackPower: 1 },
  { name: 'Bat',   emoji: '🦇', hp: 4, maxHp: 4, weakness: 'light', vocab: 'light',  attackPower: 1 },
  { name: 'Golem', emoji: '🪨', hp: 6, maxHp: 6, weakness: 'water', vocab: 'water',  attackPower: 2 },
  { name: 'Ghost', emoji: '👻', hp: 5, maxHp: 5, weakness: 'light', vocab: 'shadow', attackPower: 2 },
  { name: 'Wolf',  emoji: '🐺', hp: 6, maxHp: 6, weakness: 'frost', vocab: 'wind',   attackPower: 2 },
  { name: 'Dragon',emoji: '🐉', hp: 9, maxHp: 9, weakness: 'thunder',vocab: 'dragon', attackPower: 3 },
];

const SPELLS: Spell[] = [
  { name: 'Fire Ball',   emoji: '🔥', element: 'fire',    power: 2, cooldown: 0, tier: 1 },
  { name: 'Water Wave',  emoji: '🌊', element: 'water',   power: 2, cooldown: 0, tier: 1 },
  { name: 'Earth Quake', emoji: '🌍', element: 'earth',   power: 2, cooldown: 0, tier: 1 },
  { name: 'Wind Slash',  emoji: '🌪️', element: 'wind',   power: 2, cooldown: 0, tier: 1 },
  { name: 'Frost Bite',  emoji: '❄️', element: 'frost',  power: 2, cooldown: 0, tier: 1 },
  { name: 'Light Beam',  emoji: '✨', element: 'light',   power: 3, cooldown: 2, tier: 2 },
  { name: 'Thunder Bolt',emoji: '⚡', element: 'thunder', power: 3, cooldown: 2, tier: 2 },
  { name: '🌟 ULTIMA',    emoji: '🌟', element: 'ult',     power: 8, cooldown: 99, tier: 3 },
];

interface FloatingDmg {
  text: Phaser.GameObjects.Text;
  born: number;
}

export default class MonsterFighterScene extends BaseEngine {
  private monsterIdx = 0;
  private currentMonster!: Monster;
  private monsterHp = 0;
  private playerHp = 6;
  private maxPlayerHp = 6;
  private playerXp = 0;
  private playerLevel = 1;
  private ultUsed = false;
  private comboMultiplier = 1;
  private consecutiveEffective = 0;

  private monsterEmoji!: Phaser.GameObjects.Text;
  private monsterNameText!: Phaser.GameObjects.Text;
  private monsterHpBarBg!: Phaser.GameObjects.Rectangle;
  private monsterHpBar!: Phaser.GameObjects.Rectangle;
  private monsterHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private playerXpBar!: Phaser.GameObjects.Rectangle;
  private playerLevelText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private spellButtons: Phaser.GameObjects.Container[] = [];
  private spellCooldowns: number[] = [];
  private canAct = true;
  private feedbackText!: Phaser.GameObjects.Text;
  private floatingTexts: FloatingDmg[] = [];
  private ultBanner!: Phaser.GameObjects.Text;

  protected maxQuestions() { return MONSTERS.length; }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 35, '⚔️ Monster Fighter', {
      fontFamily: 'Inter, sans-serif', fontSize: '24px',
      color: this.hex(this.theme.danger), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 65, 620, 28, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.danger, 0.5).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 65, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeHoverSpeakable(this.promptText);

    // Monster emoji (large, with idle bob)
    this.monsterEmoji = this.add.text(this.scale.width / 2, 165, '', { fontSize: '80px' })
      .setOrigin(0.5).setDepth(30);
    this.monsterNameText = this.add.text(this.scale.width / 2, 230, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.makeHoverSpeakable(this.monsterNameText);

    // Monster HP bar (background + fill)
    this.monsterHpBarBg = this.add.rectangle(this.scale.width / 2, 265, 220, 18, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff, 0.3).setDepth(29);
    this.monsterHpBar = this.add.rectangle(this.scale.width / 2 - 110, 265, 220, 18, this.theme.danger, 1)
      .setOrigin(0, 0.5).setDepth(30);
    this.monsterHpText = this.add.text(this.scale.width / 2, 285, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(30);

    // Player stats
    this.playerLevelText = this.add.text(20, 90, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.playerHpText = this.add.text(20, 110, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setDepth(50);
    // XP bar
    this.add.text(20, 132, 'XP', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px',
      color: this.hex(this.theme.textMuted),
    }).setDepth(50);
    this.add.rectangle(45, 138, 100, 6, 0x000000, 0.4).setDepth(49);
    this.playerXpBar = this.add.rectangle(-5, 138, 0, 6, this.theme.warning, 1)
      .setOrigin(0, 0.5).setDepth(50);

    // Combo indicator
    this.ultBanner = this.add.text(this.scale.width - 20, 90, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    this.feedbackText = this.add.text(this.scale.width / 2, 360, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '17px',
      color: '#ffffff', fontStyle: 'bold', align: 'center',
      wordWrap: { width: 540 },
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

    // Floating-text cleanup loop
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        const now = this.time.now;
        this.floatingTexts = this.floatingTexts.filter(ft => {
          if (now - ft.born > 1200) {
            try { ft.text.destroy(); } catch {}
            return false;
          }
          return true;
        });
      },
    });
  }

  protected onTick(_remainingMs: number) {
    // Idle bob for monster
    if (this.monsterEmoji && this.currentMonster) {
      this.monsterEmoji.y = 165 + Math.sin(this.time.now / 400) * 4;
    }
  }

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
      const bg = this.add.rectangle(0, 0, btnW, btnH, this.theme.card, 0.92)
        .setStrokeStyle(2, spell.tier === 3 ? this.theme.warning : this.theme.danger, 0.6);
      const txt = this.add.text(0, 0, `${spell.emoji} ${spell.name}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '13px',
        color: spell.tier === 3 ? '#' + this.theme.warning.toString(16).padStart(6, '0') : '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(btnW, btnH).setDepth(40);
      this.spellButtons.push(container);
      this.spellCooldowns.push(0);
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
    this.makeHoverSpeakable(this.promptText,
      `Battle ${this.monsterIdx + 1}. The ${this.currentMonster.name} is weak against ${this.currentMonster.weakness}!`);
    this.feedbackText.setText('');
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `${this.currentMonster.name} appears! It is weak against ${this.currentMonster.weakness}!`, { isQuestion: true });

    // Monster entrance animation
    this.monsterEmoji.setScale(0.3).setAlpha(0);
    this.tweens.add({
      targets: this.monsterEmoji,
      scale: 1, alpha: 1, duration: 400, ease: 'Back.out',
    });
    this._updateUltBanner();
  }

  private _updateHpBars() {
    if (!this.currentMonster) return;
    const pct = Math.max(0, this.monsterHp / this.currentMonster.maxHp);
    this.monsterHpBar.width = 220 * pct;
    // Color shift on low HP
    if (pct < 0.3) this.monsterHpBar.setFillStyle(this.theme.warning, 1);
    else this.monsterHpBar.setFillStyle(this.theme.danger, 1);
    this.monsterHpText.setText(`HP: ${Math.max(0, this.monsterHp)}/${this.currentMonster.maxHp}`);
    this.playerHpText.setText(`❤️ HP: ${this.playerHp}/${this.maxPlayerHp}`);
    this.playerLevelText.setText(`⭐ Lv ${this.playerLevel}`);
    this.playerXpBar.width = 100 * (this.playerXp / 100);
  }

  private _updateUltBanner() {
    if (this.ultUsed) {
      this.ultBanner.setText('🌟 ULT: used');
      this.ultBanner.setColor('#' + this.theme.textMuted.toString(16).padStart(6, '0'));
    } else if (this.playerLevel >= 3) {
      this.ultBanner.setText('🌟 ULT: READY!');
      this.ultBanner.setColor('#' + this.theme.warning.toString(16).padStart(6, '0'));
    } else {
      this.ultBanner.setText(`🌟 ULT: locks at Lv3 (${this.playerLevel}/3)`);
      this.ultBanner.setColor('#' + this.theme.textMuted.toString(16).padStart(6, '0'));
    }
  }

  private _castSpell(idx: number) {
    if (!this.canAct) return;
    if (this.spellCooldowns[idx] > 0) {
      this.feedbackText.setText('⏳ Spell on cooldown!');
      audioBus.play('incorrect');
      return;
    }
    const spell = SPELLS[idx];
    // ULT gate
    if (spell.tier === 3) {
      if (this.ultUsed) { this.feedbackText.setText('ULT already used!'); return; }
      if (this.playerLevel < 3) { this.feedbackText.setText('Need Level 3 to cast ULT!'); audioBus.play('incorrect'); return; }
      this.ultUsed = true;
    }
    this.canAct = false;
    this.spellCooldowns[idx] = spell.cooldown;

    const isEffective = spell.element === this.currentMonster.weakness;
    const isUlt = spell.tier === 3;
    let damage = spell.power;
    if (isEffective) damage *= 2;
    if (isUlt) damage = Math.max(damage, this.currentMonster.hp); // ULT one-shots
    if (isEffective) damage *= this.comboMultiplier;

    this.monsterHp -= damage;

    // Floating damage number
    this._spawnFloatingText(`-${damage}`,
      isUlt ? this.theme.warning : isEffective ? this.theme.success : 0xffffff,
      this.monsterEmoji.x + (Math.random() - 0.5) * 60,
      this.monsterEmoji.y - 20 + (Math.random() - 0.5) * 20);

    // Particles
    if (isUlt) {
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'win');
      this.juice.shake('heavy');
      this.juice.flash(this.theme.warning, 0.4, 300);
    } else if (isEffective) {
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'correct');
      this.juice.shake('light');
    } else {
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'incorrect');
    }

    // Monster hit flash + scale punch
    this.monsterEmoji.setTintFill(0xffffff);
    this.time.delayedCall(80, () => { if (this.monsterEmoji) this.monsterEmoji.clearTint(); });
    this.tweens.add({
      targets: this.monsterEmoji, scale: 1.15, duration: 80, yoyo: true, ease: 'Quad.out',
    });

    this.recordAnswer({
      term: spell.name,
      response: this.currentMonster.name,
      success: isEffective,
      coordinate: { x: this.monsterEmoji.x, y: this.monsterEmoji.y, t: this.time.now },
    });

    if (isUlt) {
      this.feedbackText.setText(`🌟 ULTIMA! ${this.currentMonster.name} takes ${damage} damage!`);
      audioBus.speak(`Ultima! ${damage} damage!`);
    } else if (isEffective) {
      this.consecutiveEffective++;
      this.comboMultiplier = Math.min(4, 1 + Math.floor(this.consecutiveEffective / 2));
      this.feedbackText.setText(`✨ SUPER EFFECTIVE! ${spell.name} deals ${damage} damage! (x${this.comboMultiplier} combo)`);
      audioBus.speak(`Super effective! ${spell.name}!`);
    } else {
      this.consecutiveEffective = 0;
      this.comboMultiplier = 1;
      this.feedbackText.setText(`${spell.emoji} ${spell.name} deals ${damage} damage.`);
      audioBus.speak(spell.name);
    }
    this._updateHpBars();
    this._updateUltBanner();

    if (this.monsterHp <= 0) {
      // Monster defeated — XP + maybe level up
      const xpGain = 30 + this.monsterIdx * 10;
      this.playerXp += xpGain;
      this._spawnFloatingText(`+${xpGain} XP`, this.theme.warning,
        this.playerXpBar.x + 50, 120);
      this.feedbackText.setText(`🎉 ${this.currentMonster.name} defeated! +${xpGain} XP — learned: ${this.currentMonster.vocab}!`);
      audioBus.speak(`${this.currentMonster.name} defeated! You learned the word: ${this.currentMonster.vocab}!`);
      this.juice.burst(this.monsterEmoji.x, this.monsterEmoji.y, 'win');

      // Level up?
      while (this.playerXp >= 100) {
        this.playerXp -= 100;
        this.playerLevel++;
        this.maxPlayerHp += 1;
        this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + 2);
        this._spawnFloatingText(`LEVEL UP! → Lv ${this.playerLevel}`, this.theme.warning,
          this.scale.width / 2, 200);
        audioBus.speak(`Level up! You are now level ${this.playerLevel}!`);
        this.juice.flash(this.theme.warning, 0.3, 250);
        this.juice.scorePopup(this.scale.width / 2, 180,
          `LEVEL ${this.playerLevel}!`, this.theme.warning);
      }
      this._updateUltBanner();

      this.time.delayedCall(2000, () => {
        if (this.isFinished) return;
        this.monsterIdx++;
        this._startBattle();
      });
    } else {
      // Monster counter-attacks
      this.time.delayedCall(900, () => {
        if (this.isFinished) return;
        const dmg = this.currentMonster.attackPower;
        this.playerHp -= dmg;
        this._spawnFloatingText(`-${dmg}`, this.theme.danger, 50, 110);
        this.feedbackText.setText(`💥 ${this.currentMonster.name} attacks! -${dmg} HP`);
        audioBus.play('incorrect');
        this.juice.shake('light');
        this._updateHpBars();
        if (this.playerHp <= 0) {
          this.finishGame(false);
          return;
        }
        // Tick down cooldowns
        for (let i = 0; i < this.spellCooldowns.length; i++) {
          if (this.spellCooldowns[i] > 0) this.spellCooldowns[i]--;
        }
        this.time.delayedCall(800, () => {
          if (this.isFinished) return;
          this.feedbackText.setText('');
          this.canAct = true;
        });
      });
    }
  }

  private _spawnFloatingText(msg: string, color: number, x: number, y: number) {
    const txt = this.add.text(x, y, msg, {
      fontFamily: 'Inter, sans-serif', fontSize: '20px',
      color: '#' + (color ?? 0xffffff).toString(16).padStart(6, '0'),
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);
    this.floatingTexts.push({ text: txt, born: this.time.now });
    this.tweens.add({
      targets: txt, y: y - 50, alpha: 0,
      duration: 1200, ease: 'Cubic.out',
    });
  }
}
