import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// TOWER DEFENSE — Real-time strategy with vocabulary (AAA 2029 edition)
// ============================================================================
// Premium tower defense:
//   • 2 lanes — enemies can march down either lane
//   • 3 tower types: Arrow (fast, weak), Cannon (slow, strong), Frost (slows)
//   • Tower placement: tap an empty slot to build (costs coins)
//   • Auto-fire projectiles at enemies in range
//   • Tower upgrades: tap existing tower to upgrade (Level 1 → 2 → 3)
//   • 3 waves of escalating difficulty
//   • Coin economy: defeat enemies → earn coins → build/upgrade towers
//   • Castle HP bar with hearts, screen shake on hit
//   • Mobile-friendly 50px+ tap targets
// ============================================================================

type TowerType = 'arrow' | 'cannon' | 'frost';
type Lane = 0 | 1;

interface Enemy {
  word: string; lane: Lane; progress: number; reached: boolean; defeated: boolean;
  text: Phaser.GameObjects.Text; hp: number; maxHp: number; speed: number; slowed: number;
}
interface Tower {
  type: TowerType; level: 1 | 2 | 3; lane: Lane; x: number; y: number;
  range: number; cooldown: number; container: Phaser.GameObjects.Container;
}
interface Projectile {
  sprite: Phaser.GameObjects.Text; target: Enemy; speed: number; damage: number;
  slowEffect: number; x: number; y: number;
}

const TOWER_DEFS: Record<TowerType, { name: string; emoji: string; cost: number; range: number; fireRate: number; damage: number; slow?: number; color: number }> = {
  arrow:  { name: 'Arrow',  emoji: '🏹', cost: 15, range: 200, fireRate: 800,  damage: 1, color: 0x22c55e },
  cannon: { name: 'Cannon', emoji: '💣', cost: 30, range: 160, fireRate: 1500, damage: 3, color: 0xef4444 },
  frost:  { name: 'Frost',  emoji: '❄️', cost: 25, range: 180, fireRate: 1000, damage: 1, slow: 0.5, color: 0x60a5fa },
};

export default class TowerDefenseScene extends BaseEngine {
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private castleHp = 8;
  private maxCastleHp = 8;
  private coins = 40;
  private currentWave = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private towerSlots: { x: number; y: number; lane: Lane; tower?: Tower }[] = [];
  private gameLoop?: Phaser.Time.TimerEvent;
  private towerButtons: { type: TowerType; container: Phaser.GameObjects.Container }[] = [];
  private selectedTowerType: TowerType | null = null;
  private canAct = true;
  private feedbackText!: Phaser.GameObjects.Text;

  protected maxQuestions() { return Math.min(this.terms.length, 15); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 30, '🏰 Tower Defense', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.promptBg = this.add.rectangle(this.scale.width / 2, 60, 620, 28, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.5).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 60, 'Build towers to defend the castle! Tap a slot to build.', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Stats row
    this.waveText = this.add.text(20, 85, 'Wave 1/3', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);
    this.coinsText = this.add.text(this.scale.width / 2, 85, '💰 40', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.hpText = this.add.text(this.scale.width - 20, 85, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Castle (right side)
    this.add.text(this.scale.width - 50, 240, '🏰', { fontSize: '48px' }).setOrigin(0.5).setDepth(30);
    this.add.text(this.scale.width - 50, 280, 'Castle', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);

    // Two lanes (paths from left to castle)
    const laneY1 = 220;
    const laneY2 = 300;
    this.add.rectangle(this.scale.width / 2 - 30, laneY1, this.scale.width - 160, 4, this.theme.accent, 0.25).setDepth(5);
    this.add.rectangle(this.scale.width / 2 - 30, laneY2, this.scale.width - 160, 4, this.theme.accent, 0.25).setDepth(5);
    this.add.text(40, laneY1, 'Lane 1 ▶', { fontFamily: 'Inter, sans-serif', fontSize: '10px', color: this.hex(this.theme.textMuted) }).setOrigin(0.5).setDepth(6);
    this.add.text(40, laneY2, 'Lane 2 ▶', { fontFamily: 'Inter, sans-serif', fontSize: '10px', color: this.hex(this.theme.textMuted) }).setOrigin(0.5).setDepth(6);

    // Tower slots — 4 per lane (3 lanes worth of buildable slots, simplified to 2 lanes × 2 slots)
    const slotXs = [180, 380];
    slotXs.forEach((x, idx) => {
      this.towerSlots.push({ x, y: laneY1 - 30, lane: 0 });
      this.towerSlots.push({ x, y: laneY2 + 30, lane: 1 });
      // Draw slot indicator
      const slotIdx = this.towerSlots.length - 1;
      const slot = this.towerSlots[slotIdx - 1]; // previous (we just pushed 2)
      // (Skipping detailed slot rendering — tower placement visualizes via empty circle)
    });
    // Draw slot indicators properly
    this.towerSlots.forEach((slot, i) => {
      const circle = this.add.circle(slot.x, slot.y, 22, this.theme.cardAlt, 0.4)
        .setStrokeStyle(2, this.theme.accent, 0.4).setDepth(8);
      circle.setData('slotIdx', i);
      const plus = this.add.text(slot.x, slot.y, '+', {
        fontFamily: 'Inter, sans-serif', fontSize: '20px',
        color: this.hex(this.theme.textMuted),
      }).setOrigin(0.5).setDepth(9);
      plus.setData('slotIdx', i);
    });

    // Build tower-type buttons (bottom)
    this._buildTowerButtons();

    this.feedbackText = this.add.text(this.scale.width / 2, 410, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(60);

    this._startWave();
    this._updateHp();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct || this.isFinished) return;
      // Tower type buttons
      for (const tb of this.towerButtons) {
        if (Math.abs(x - tb.container.x) < 60 && Math.abs(y - tb.container.y) < 28) {
          this._selectTowerType(tb.type);
          return;
        }
      }
      // Tower slots (build / upgrade)
      for (let i = 0; i < this.towerSlots.length; i++) {
        const slot = this.towerSlots[i];
        if (Math.abs(x - slot.x) < 28 && Math.abs(y - slot.y) < 28) {
          if (slot.tower) {
            this._upgradeTower(i);
          } else {
            this._buildTower(i);
          }
          return;
        }
      }
    });

    // Game loop
    this.gameLoop = this.time.addEvent({
      delay: 50, loop: true, callback: () => this._tick(),
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildTowerButtons() {
    const types: TowerType[] = ['arrow', 'cannon', 'frost'];
    const startX = this.scale.width / 2 - 200;
    types.forEach((t, i) => {
      const def = TOWER_DEFS[t];
      const x = startX + i * 200;
      const bg = this.add.rectangle(0, 0, 180, 50, this.theme.card, 0.92)
        .setStrokeStyle(2, def.color, 0.7);
      const txt = this.add.text(0, 0, `${def.emoji} ${def.name}\n💰${def.cost}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: '#ffffff', fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5);
      const container = this.add.container(x, 530, [bg, txt]).setSize(180, 50).setDepth(40);
      this.towerButtons.push({ type: t, container });
    });
  }

  private _selectTowerType(t: TowerType) {
    this.selectedTowerType = t;
    audioBus.play('tap');
    audioBus.speak(TOWER_DEFS[t].name);
    this.promptText.setText(`Selected: ${TOWER_DEFS[t].emoji} ${TOWER_DEFS[t].name} (${TOWER_DEFS[t].cost}💰) — tap a slot!`);
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Selected: ${TOWER_DEFS[t].name}. Tap a slot!`);
    // Highlight selected button
    this.towerButtons.forEach(tb => {
      const bg = tb.container.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(this.theme.card, 0.92);
      bg.setStrokeStyle(2, TOWER_DEFS[tb.type].color, 0.7);
      if (tb.type === t) {
        bg.setFillStyle(TOWER_DEFS[t].color, 0.4);
      }
    });
  }

  private _buildTower(slotIdx: number) {
    const slot = this.towerSlots[slotIdx];
    if (slot.tower) return;
    if (!this.selectedTowerType) {
      this.feedbackText.setText('Pick a tower type first!');
      audioBus.play('incorrect');
      return;
    }
    const def = TOWER_DEFS[this.selectedTowerType];
    if (this.coins < def.cost) {
      this.feedbackText.setText(`Need ${def.cost}💰 — you have ${this.coins}!`);
      audioBus.play('incorrect');
      return;
    }
    this.coins -= def.cost;
    this.coinsText.setText(`💰 ${this.coins}`);

    // Build tower
    const bg = this.add.rectangle(0, 0, 44, 44, def.color, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.5);
    const emoji = this.add.text(0, 0, def.emoji, { fontSize: '24px' }).setOrigin(0.5);
    const lvlText = this.add.text(0, 16, 'Lv1', {
      fontFamily: 'Inter, sans-serif', fontSize: '9px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const container = this.add.container(slot.x, slot.y, [bg, emoji, lvlText])
      .setSize(44, 44).setDepth(20);

    const tower: Tower = {
      type: this.selectedTowerType, level: 1, lane: slot.lane,
      x: slot.x, y: slot.y, range: def.range, cooldown: 0, container,
    };
    slot.tower = tower;
    this.towers.push(tower);

    audioBus.play('correct');
    audioBus.speak(`${def.name} built!`);
    this.juice.burst(slot.x, slot.y, 'correct');
    this.tweens.add({
      targets: container, scale: 1.3, duration: 200, yoyo: true, ease: 'Back.out',
    });
  }

  private _upgradeTower(slotIdx: number) {
    const slot = this.towerSlots[slotIdx];
    if (!slot.tower) return;
    if (slot.tower.level >= 3) {
      this.feedbackText.setText('Already max level!');
      audioBus.play('incorrect');
      return;
    }
    const cost = 20 * slot.tower.level;
    if (this.coins < cost) {
      this.feedbackText.setText(`Upgrade needs ${cost}💰 — you have ${this.coins}!`);
      audioBus.play('incorrect');
      return;
    }
    this.coins -= cost;
    this.coinsText.setText(`💰 ${this.coins}`);
    slot.tower.level = (slot.tower.level + 1) as 1 | 2 | 3;
    slot.tower.range += 30;
    (slot.tower.container.getAt(2) as Phaser.GameObjects.Text).setText(`Lv${slot.tower.level}`);
    audioBus.play('correct');
    audioBus.speak(`Upgraded to level ${slot.tower.level}!`);
    this.juice.burst(slot.x, slot.y, 'correct');
    this.tweens.add({
      targets: slot.tower.container, scale: 1.2, duration: 200, yoyo: true, ease: 'Back.out',
    });
  }

  private _startWave() {
    if (this.currentWave >= 3) { this.finishGame(true); return; }
    this.currentWave++;
    this.waveText.setText(`Wave ${this.currentWave}/3`);
    this.enemies = [];
    this.canAct = true;

    const waveSize = 2 + this.currentWave * 2;
    // AAAA KIDS MODE — Gentler wave speed ramp. Was 0.004 + wave*0.002 (50% jump/wave).
    // Now: 0.003 + wave*0.0015 (33% jump/wave).
    const waveSpeed = 0.003 + this.currentWave * 0.0015;
    const enemyHp = 1 + Math.floor(this.currentWave / 2);
    const pool = [...this.terms];
    Phaser.Utils.Array.Shuffle(pool);

    for (let i = 0; i < waveSize; i++) {
      const term = pool[i % pool.length];
      const lane = (i % 2) as Lane;
      const laneY = lane === 0 ? 220 : 300;
      const text = this.add.text(40, laneY, `👾 ${term.term}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '14px',
        color: '#ffffff', fontStyle: 'bold',
        backgroundColor: '#' + this.theme.danger.toString(16).padStart(6, '0'),
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0.5).setDepth(15);
      this.enemies.push({
        word: term.term, lane, progress: -i * 0.18, reached: false, defeated: false,
        text, hp: enemyHp, maxHp: enemyHp, speed: waveSpeed, slowed: 0,
      });
    }
    this.feedbackText.setText(`Wave ${this.currentWave}! ${waveSize} enemies incoming!`);
    audioBus.speak(`Wave ${this.currentWave}!`);
  }

  private _tick() {
    if (this.isFinished) { if (this.gameLoop) this.gameLoop.remove(); return; }

    // Move enemies
    let allDone = true;
    this.enemies.forEach(e => {
      if (!e.reached && !e.defeated) {
        allDone = false;
        const speed = e.slowed > 0 ? e.speed * 0.4 : e.speed;
        e.progress += speed;
        e.text.x = 40 + e.progress * (this.scale.width - 120);
        if (e.slowed > 0) e.slowed -= 0.05;
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

    // Tower firing
    const now = this.time.now;
    this.towers.forEach(tower => {
      if (tower.cooldown > 0) { tower.cooldown -= 50; return; }
      // Find closest enemy in this lane within range
      let target: Enemy | null = null;
      let bestDist = Infinity;
      for (const e of this.enemies) {
        if (e.reached || e.defeated || e.lane !== tower.lane) continue;
        const dist = Math.abs(e.text.x - tower.x);
        if (dist < tower.range && dist < bestDist) {
          bestDist = dist;
          target = e;
        }
      }
      if (target) {
        const def = TOWER_DEFS[tower.type];
        const damage = def.damage * tower.level;
        this._fireProjectile(tower, target as Enemy, damage, def.slow);
        tower.cooldown = def.fireRate / tower.level;
      }
    });

    // Move projectiles
    this.projectiles = this.projectiles.filter(p => {
      if (p.target.defeated || p.target.reached) {
        try { p.sprite.destroy(); } catch {}
        return false;
      }
      const dx = p.target.text.x - p.x;
      const dy = p.target.text.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        // Hit
        p.target.hp -= p.damage;
        if (p.slowEffect) p.target.slowed = 1;
        this.juice.burst(p.target.text.x, p.target.text.y, 'incorrect');
        try { p.sprite.destroy(); } catch {}
        if (p.target.hp <= 0) {
          p.target.defeated = true;
          p.target.text.setVisible(false);
          this.coins += 5;
          this.coinsText.setText(`💰 ${this.coins}`);
          audioBus.play('correct');
          audioBus.speak(p.target.word);
          this.recordAnswer({
            term: p.target.word, response: 'shot', success: true,
            coordinate: { x: p.target.text.x, y: p.target.text.y, t: this.time.now },
          });
          this.checkWin();
        }
        return false;
      }
      // Move toward target
      const step = p.speed;
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.sprite.x = p.x;
      p.sprite.y = p.y;
      return true;
    });

    // Wave complete?
    if (allDone) {
      this.feedbackText.setText(`Wave ${this.currentWave} cleared! +10💰 bonus`);
      this.coins += 10;
      this.coinsText.setText(`💰 ${this.coins}`);
      this.time.delayedCall(2000, () => { if (!this.isFinished) this._startWave(); });
      // Prevent re-entry
      this.canAct = false;
      this.time.delayedCall(2100, () => { this.canAct = true; });
    }
  }

  private _fireProjectile(tower: Tower, target: Enemy, damage: number, slow?: number) {
    const def = TOWER_DEFS[tower.type];
    const projEmoji = tower.type === 'arrow' ? '➶' : tower.type === 'cannon' ? '●' : '❄';
    const sprite = this.add.text(tower.x, tower.y, projEmoji, {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: '#' + def.color.toString(16).padStart(6, '0'), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25);
    this.projectiles.push({
      sprite, target, speed: 6, damage, slowEffect: slow ?? 0,
      x: tower.x, y: tower.y,
    });
  }

  private _updateHp() {
    const hearts = '🟩'.repeat(Math.max(0, this.castleHp)) + '⬜'.repeat(Math.max(0, this.maxCastleHp - this.castleHp));
    this.hpText.setText(`🏰 ${hearts}`);
  }
}
