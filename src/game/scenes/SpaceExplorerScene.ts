import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// SPACE EXPLORER — Planet Hunters inspired (AAA 2029 edition)
// ============================================================================
// Premium space sim:
//   • Animated star system with orbiting planets (real orbital mechanics)
//   • Rocket ship flies between planets (tap destination to travel)
//   • Gravity well — rocket curves toward star (visual orbit drift)
//   • Fuel system: each travel costs fuel, scan reveals planet info
//   • Planet discovery: tap unknown planet → multiple-choice scan → reveal
//   • Asteroid hazard: random asteroid drifts through, dodge for bonus
//   • Telescope zoom effect on selected planet
//   • Discovery log: each found planet adds to the log with vocab word
// ============================================================================

interface Planet {
  name: string; emoji: string; orbitR: number; angle: number; speed: number;
  discovered: boolean; sprite: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Arc;
}
interface Asteroid { sprite: Phaser.GameObjects.Text; vx: number; vy: number; alive: boolean; }

const PLANET_DEFS = [
  { name: 'Mercury', emoji: '☿️', color: 0xa0a0a0 },
  { name: 'Venus',   emoji: '♀️', color: 0xf5deb3 },
  { name: 'Earth',   emoji: '🌍', color: 0x60a5fa },
  { name: 'Mars',    emoji: '♂️', color: 0xff6b6b },
  { name: 'Jupiter', emoji: '🪐', color: 0xffd93d },
  { name: 'Saturn',  emoji: '🪐', color: 0xffd700 },
];

const VOCAB_HINTS: Record<string, string> = {
  star: 'A giant ball of burning gas',
  planet: 'A large body orbiting a star',
  moon: 'A natural satellite of a planet',
  comet: 'An icy object with a tail',
  galaxy: 'A huge group of stars',
  orbit: 'The path of one object around another',
  rocket: 'A vehicle that travels to space',
  astronaut: 'A person who travels to space',
  telescope: 'A tool for viewing distant objects',
  universe: 'Everything that exists',
};

export default class SpaceExplorerScene extends BaseEngine {
  private currentRound = 0;
  private fuel = 100;
  private planetsDiscovered = 0;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private fuelText!: Phaser.GameObjects.Text;
  private discoveryText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private canAct = true;
  private planets: Planet[] = [];
  private rocket!: Phaser.GameObjects.Text;
  private rocketTarget: { x: number; y: number } | null = null;
  private gameLoop?: Phaser.Time.TimerEvent;
  private asteroids: Asteroid[] = [];
  private starCenterX = 0;
  private starCenterY = 0;
  private asteroidSpawnTimer?: Phaser.Time.TimerEvent;
  private discoveryLog: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private selectedPlanet: Planet | null = null;
  private scanCircles: Phaser.GameObjects.Arc[] = [];

  protected maxQuestions() { return Math.min(this.terms.length, 10); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 30, '🚀 Space Explorer', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Fuel + discovery stats
    this.fuelText = this.add.text(20, 60, '⛽ 100%', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.success), fontStyle: 'bold',
    }).setDepth(50);
    this.discoveryText = this.add.text(this.scale.width - 20, 60, '🪐 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Build solar system
    this.starCenterX = this.scale.width / 2;
    this.starCenterY = 200;
    this._buildSolarSystem();

    // Rocket
    this.rocket = this.add.text(this.scale.width / 2, 360, '🚀', { fontSize: '28px' })
      .setOrigin(0.5).setDepth(35).setRotation(Math.PI / 2);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 320, 600, 32, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.6).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 320, 'Tap a planet to fly there and scan it!', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    // Discovery log (bottom-left, hidden behind options)
    this.logText = this.add.text(20, 410, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px',
      color: this.hex(this.theme.textMuted),
    }).setDepth(50);

    this._renderRound();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      // Tap a planet
      for (const p of this.planets) {
        if (Math.abs(x - p.sprite.x) < 24 && Math.abs(y - p.sprite.y) < 24) {
          this._selectPlanet(p);
          return;
        }
      }
      // Tap an option button (scan answer)
      for (let i = 0; i < this.optionButtons.length; i++) {
        const btn = this.optionButtons[i];
        if (Math.abs(x - btn.x) < 110 && Math.abs(y - btn.y) < 25) {
          this._handleScanAnswer(i);
          return;
        }
      }
    });

    // Game loop — orbit planets, move rocket, spawn asteroids
    this.gameLoop = this.time.addEvent({
      delay: 30, loop: true, callback: () => this._tick(),
    });

    // Asteroid spawn — every 12-18s
    this.asteroidSpawnTimer = this.time.addEvent({
      delay: 14000, loop: true, callback: () => this._spawnAsteroid(),
    });
  }

  protected onTick(_remainingMs: number) {}

  private _buildSolarSystem() {
    // Starfield
    for (let i = 0; i < 30; i++) {
      this.add.circle(
        Math.random() * this.scale.width, Math.random() * 320,
        1 + Math.random() * 1.5, 0xffffff, 0.3 + Math.random() * 0.5
      ).setDepth(1);
    }

    // Central star
    this.add.text(this.starCenterX, this.starCenterY, '☀️', { fontSize: '40px' })
      .setOrigin(0.5).setDepth(20);
    // Star glow rings
    this.add.circle(this.starCenterX, this.starCenterY, 35, 0xffd700, 0.15).setDepth(15);
    this.add.circle(this.starCenterX, this.starCenterY, 50, 0xffd700, 0.08).setDepth(14);

    // 4-6 planets at varying orbital radii (only as many as maxScore)
    const planetCount = Math.min(this.maxScore, PLANET_DEFS.length);
    for (let i = 0; i < planetCount; i++) {
      const def = PLANET_DEFS[i];
      const orbitR = 70 + i * 35;
      // Orbit ring
      this.add.circle(this.starCenterX, this.starCenterY, orbitR, 0xffffff, 0).setStrokeStyle(1, 0xffffff, 0.12).setDepth(2);
      const angle = Math.random() * Math.PI * 2;
      const px = this.starCenterX + Math.cos(angle) * orbitR;
      const py = this.starCenterY + Math.sin(angle) * orbitR;

      // Planet glow (revealed on discovery)
      const glow = this.add.circle(px, py, 24, def.color, 0).setDepth(18);

      // Planet sprite — starts as "?" until discovered
      const sprite = this.add.text(px, py, '?', {
        fontFamily: 'Inter, sans-serif', fontSize: '22px',
        color: '#' + this.theme.textMuted.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);

      this.planets.push({
        name: def.name, emoji: def.emoji, orbitR, angle,
        speed: 0.003 + i * 0.0005,
        discovered: false, sprite, glow,
      });
    }
  }

  private _renderRound() {
    // (Re-render options is per-planet; nothing to do here until planet selected)
  }

  private _selectPlanet(planet: Planet) {
    if (planet.discovered) {
      this.promptText.setText(`${planet.emoji} ${planet.name} — already discovered!`);
      audioBus.speak(planet.name);
      return;
    }
    this.selectedPlanet = planet;
    this.rocketTarget = { x: planet.sprite.x, y: planet.sprite.y };
    this.fuel = Math.max(0, this.fuel - 5);
    this._updateFuel();
    audioBus.play('flip');
    audioBus.speak('Traveling to planet!');
    this.promptText.setText(`🚀 Scanning planet...`);

    // Scan circles (telescope zoom effect)
    this.scanCircles.forEach(c => { try { c.destroy(); } catch {} });
    this.scanCircles = [];
    for (let i = 0; i < 3; i++) {
      const c = this.add.circle(planet.sprite.x, planet.sprite.y, 24 + i * 8, 0xffffff, 0)
        .setStrokeStyle(2, 0x60a5fa, 0.6 - i * 0.2).setDepth(40);
      this.scanCircles.push(c);
      this.tweens.add({
        targets: c, scale: 1.5, alpha: 0,
        duration: 800, delay: i * 200, ease: 'Quad.out',
      });
    }

    // After travel, show multiple-choice scan
    this.time.delayedCall(900, () => {
      if (this.isFinished) return;
      this._showScanOptions(planet);
    });
  }

  private _showScanOptions(planet: Planet) {
    // Clear old option buttons
    this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.optionButtons = [];

    // Use vocab word from terms list (cycle through)
    const term = this.terms[this.currentRound % this.terms.length];
    const hint = VOCAB_HINTS[term.term.toLowerCase()] || term.definition || 'A space object';
    this.promptText.setText(`📡 Scan complete! What is "${hint}"?`);
    // AAAA KIDS MODE — Speak the prompt with karaoke highlight.
    this.speakPromptWithHighlight(this.promptText, `Scan complete! What is ${hint}?`, { isQuestion: true });

    // Generate 4 options
    const allTerms = [...this.terms];
    Phaser.Utils.Array.Shuffle(allTerms);
    const options = [term, ...allTerms.filter(t => t.id !== term.id).slice(0, 3)];
    Phaser.Utils.Array.Shuffle(options);

    const startY = 380;
    options.forEach((t, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = this.scale.width / 2 + (col === 0 ? -130 : 130);
      const y = startY + row * 50;
      const emoji = VOCAB_HINTS[t.term.toLowerCase()] ? '✨' : '⭐';
      const bg = this.add.rectangle(0, 0, 240, 40, this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, `${emoji} ${t.term}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '14px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [bg, txt]).setSize(240, 40).setDepth(40);
      this.makeSpeakable(txt, t.term);
      this.optionButtons.push(container);
    });
  }

  private _handleScanAnswer(idx: number) {
    if (!this.canAct || !this.selectedPlanet || this.isFinished) return;
    this.canAct = false;
    const term = this.terms[this.currentRound % this.terms.length];
    const btn = this.optionButtons[idx];
    const selectedText = (btn.getAt(1) as Phaser.GameObjects.Text).text;
    const selectedWord = selectedText.replace(/^[^\s]+ /, '').trim();
    const isCorrect = selectedWord === term.term;

    this.recordAnswer({
      term: term.term, response: selectedWord, success: isCorrect,
      coordinate: { x: btn.x, y: btn.y, t: this.time.now },
    });

    if (isCorrect) {
      // Discover the planet!
      const planet = this.selectedPlanet;
      planet.discovered = true;
      planet.sprite.setText(planet.emoji);
      planet.sprite.setColor('#ffffff');
      planet.glow.setFillStyle(0x60a5fa, 0.3);
      this.planetsDiscovered++;
      this.discoveryText.setText(`🪐 ${this.planetsDiscovered}`);
      this.fuel = Math.max(0, this.fuel - 5);
      this._updateFuel();

      audioBus.play('correct');
      audioBus.speak(`${planet.name} discovered! ${term.term}!`);
      this.juice.burst(planet.sprite.x, planet.sprite.y, 'win');
      this.juice.scorePopup(planet.sprite.x, planet.sprite.y - 30,
        `${planet.emoji} ${planet.name}!`, this.theme.success);

      this.discoveryLog.push(`${planet.emoji} ${planet.name} = ${term.term}`);
      this._updateLog();
    } else {
      this.fuel = Math.max(0, this.fuel - 12);
      this._updateFuel();
      audioBus.play('incorrect');
      this.juice.shake('light');
      this.promptText.setText(`❌ Wrong! It was "${term.term}".`);
    }

    if (this.fuel <= 0) {
      this.finishGame(false);
      return;
    }

    this.time.delayedCall(1500, () => {
      if (this.isFinished) return;
      this.canAct = true;
      this.currentRound++;
      // Clear options
      this.optionButtons.forEach(b => { try { b.destroy(); } catch {} });
      this.optionButtons = [];
      this.promptText.setText('Tap another planet to scan!');
    });
  }

  private _updateLog() {
    this.logText.setText(this.discoveryLog.slice(-5).join('\n'));
  }

  private _updateFuel() {
    this.fuelText.setText(`⛽ ${this.fuel}%`);
    if (this.fuel <= 30) this.fuelText.setColor(this.hex(this.theme.danger));
    else if (this.fuel <= 60) this.fuelText.setColor(this.hex(this.theme.warning));
    else this.fuelText.setColor(this.hex(this.theme.success));
  }

  private _spawnAsteroid() {
    if (this.isFinished) return;
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0, vx = 0, vy = 0;
    const speed = 1.5;
    if (side === 0) { x = -30; y = Math.random() * 350; vx = speed; vy = (Math.random() - 0.5) * 1; }
    else if (side === 1) { x = this.scale.width + 30; y = Math.random() * 350; vx = -speed; vy = (Math.random() - 0.5) * 1; }
    else if (side === 2) { x = Math.random() * this.scale.width; y = -30; vx = (Math.random() - 0.5) * 1; vy = speed; }
    else { x = Math.random() * this.scale.width; y = 380; vx = (Math.random() - 0.5) * 1; vy = -speed; }
    const sprite = this.add.text(x, y, '☄️', { fontSize: '24px' }).setOrigin(0.5).setDepth(33);
    this.asteroids.push({ sprite, vx, vy, alive: true });
  }

  private _tick() {
    if (this.isFinished) { if (this.gameLoop) this.gameLoop.remove(); return; }

    // Orbit planets
    for (const p of this.planets) {
      p.angle += p.speed;
      const px = this.starCenterX + Math.cos(p.angle) * p.orbitR;
      const py = this.starCenterY + Math.sin(p.angle) * p.orbitR;
      p.sprite.x = px; p.sprite.y = py;
      p.glow.x = px; p.glow.y = py;
    }

    // Move rocket toward target
    if (this.rocketTarget) {
      const dx = this.rocketTarget.x - this.rocket.x;
      const dy = this.rocketTarget.y - this.rocket.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 4) {
        this.rocketTarget = null;
      } else {
        this.rocket.x += (dx / dist) * 4;
        this.rocket.y += (dy / dist) * 4;
        this.rocket.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      }
    }

    // Move asteroids + collision with rocket
    this.asteroids = this.asteroids.filter(a => {
      if (!a.alive) return false;
      a.sprite.x += a.vx;
      a.sprite.y += a.vy;
      if (a.sprite.x < -50 || a.sprite.x > this.scale.width + 50 ||
          a.sprite.y < -50 || a.sprite.y > 400) {
        try { a.sprite.destroy(); } catch {}
        return false;
      }
      // Collision with rocket
      const dx = a.sprite.x - this.rocket.x;
      const dy = a.sprite.y - this.rocket.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        // Hit! Lose fuel
        this.fuel = Math.max(0, this.fuel - 8);
        this._updateFuel();
        audioBus.play('incorrect');
        this.juice.shake('light');
        this.juice.burst(a.sprite.x, a.sprite.y, 'incorrect');
        try { a.sprite.destroy(); } catch {}
        if (this.fuel <= 0) this.finishGame(false);
        return false;
      }
      return true;
    });
  }
}
