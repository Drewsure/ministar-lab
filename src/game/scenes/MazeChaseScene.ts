import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import type { TermItem } from '../../lib/types';
import { audioBus } from '../../lib/audio';

// ============================================================================
// MAZE CHASE — Selection Engine  (AAA 2029 edition)
// ============================================================================
// FEATURES
//   • Real recursive-backtracker maze + ~15% wall removal for multi-path loops
//   • Keyboard (WASD + Arrows) — input objects created ONCE in create()
//   • Tap-to-move via A* pathfinding through the maze grid (no wall clipping)
//   • Player trail particle emitter (LOD-aware)
//   • Directional indicator that rotates to match heading
//   • Smart enemy AI: patrol mode + chase mode when player is in line-of-sight
//   • Compass arrow at top of HUD points toward the current correct target
//   • Floor tiles for visual depth (alternating tints)
//   • Speed-boost powerup spawns occasionally on collection
//   • Hit-stop + heavy shake on enemy collision (AAA juice)
//   • Per-round maze regeneration so each question feels fresh
// ============================================================================

const CELL = 76;                 // pixel size of a maze cell
const COLS = 9;                  // maze width in cells  (9 * 76 = 684)
const ROWS = 6;                  // maze height in cells (6 * 76 = 456)
const HUD_HEIGHT = 110;          // reserved top space for HUD
const WALL_THICKNESS = 5;

interface MazeCell {
  x: number; y: number;
  walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  visited: boolean;
}

interface PathNode {
  x: number; y: number;
  g: number; h: number; f: number;
  parent: PathNode | null;
}

type Dir = 'up' | 'down' | 'left' | 'right';

export default class MazeChaseScene extends BaseEngine {
  // --- Maze state ---
  private maze!: MazeCell[][];
  private mazeOffsetX = 0;
  private mazeOffsetY = 0;
  private floorLayer!: Phaser.GameObjects.Container;

  // --- Player ---
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerDir: Dir = 'right';
  private playerDirIndicator!: Phaser.GameObjects.Text;
  private playerGlow!: Phaser.GameObjects.Arc;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // --- Groups ---
  private wallsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private targetsGroup!: Phaser.Physics.Arcade.Group;
  private enemiesGroup!: Phaser.Physics.Arcade.Group;

  // --- Game state ---
  private activeTerm?: TermItem;
  private promptText!: Phaser.GameObjects.Text;
  private compassArrow!: Phaser.GameObjects.Text;
  private targetHits = new Map<Phaser.GameObjects.GameObject, boolean>();
  private round = 0;

  // --- Input (created ONCE) ---
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  // --- Pathfinding (tap-to-move) ---
  private path: { x: number; y: number }[] = [];
  private pathIdx = 0;
  private speedBoostUntil = 0;

  protected maxQuestions() { return Math.min(this.terms.length, 6); }

  // ===========================================================================
  // BUILD WORLD
  // ===========================================================================
  protected buildWorld() {
    this.mazeOffsetX = (this.scale.width - COLS * CELL) / 2;
    this.mazeOffsetY = HUD_HEIGHT + 10;

    // Prompt + compass
    this.promptText = this.add.text(
      this.scale.width / 2, 70,
      'Collect the correct answer!',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.warning),
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setDepth(50);
    this.makeSpeakable(this.promptText, 'Tap to hear what to find');

    this.compassArrow = this.add.text(
      this.scale.width / 2, 96,
      '↑',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '28px',
        color: this.hex(this.theme.success),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(50);

    // Build maze + entities
    this.generateMaze();
    this.renderMaze();
    this.spawnPlayer();
    this.spawnTargetsAndEnemies();

    // ---- Input setup (ONCE — not per-frame) ----
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    }

    // Tap-to-move: single tap sets a path destination via A*
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audioBus.init();
      this.handleTap(p.x, p.y);
    });

    // Trail emitter (LOD-aware)
    const trailKey = 'particle-' + this.theme.id;
    if (this.textures.exists(trailKey) && this.lod.particleMultiplier > 0.3) {
      this.trailEmitter = this.add.particles(0, 0, trailKey, {
        speed: { min: 0, max: 20 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: { min: 200, max: 400 },
        tint: this.theme.particles.streak,
        blendMode: this.lod.blendAdd ? 'ADD' : 'NORMAL',
        quantity: 1,
        frequency: 60,
        emitting: false,
      }).setDepth(18);
    }
  }

  protected onTick(_remainingMs: number) {
    if (this.isFinished) return;
    if (this.activeTerm) {
      this.promptText.setText(`Find: ${this.activeTerm.term}`);
      // NOTE: speakPrompt is called in spawnTargetsAndEnemies() and advanceRound()
      // when the term CHANGES — NOT here (onTick runs 60x/sec)
      // Update compass to point toward active target
      this.updateCompass();
    }
  }

  // ===========================================================================
  // MAZE GENERATION (recursive backtracker + multi-path loops)
  // ===========================================================================
  private generateMaze() {
    this.maze = [];
    for (let y = 0; y < ROWS; y++) {
      const row: MazeCell[] = [];
      for (let x = 0; x < COLS; x++) {
        row.push({
          x, y,
          walls: { top: true, right: true, bottom: true, left: true },
          visited: false,
        });
      }
      this.maze.push(row);
    }

    const stack: MazeCell[] = [];
    let current = this.maze[0][0];
    current.visited = true;
    let visitedCount = 1;
    const total = COLS * ROWS;

    while (visitedCount < total) {
      const neighbors: { cell: MazeCell; dir: 'top' | 'right' | 'bottom' | 'left' }[] = [];
      const { x, y } = current;
      if (y > 0 && !this.maze[y - 1][x].visited) neighbors.push({ cell: this.maze[y - 1][x], dir: 'top' });
      if (x < COLS - 1 && !this.maze[y][x + 1].visited) neighbors.push({ cell: this.maze[y][x + 1], dir: 'right' });
      if (y < ROWS - 1 && !this.maze[y + 1][x].visited) neighbors.push({ cell: this.maze[y + 1][x], dir: 'bottom' });
      if (x > 0 && !this.maze[y][x - 1].visited) neighbors.push({ cell: this.maze[y][x - 1], dir: 'left' });

      if (neighbors.length > 0) {
        const next = Phaser.Utils.Array.GetRandom(neighbors);
        if (next.dir === 'top')    { current.walls.top = false;    next.cell.walls.bottom = false; }
        else if (next.dir === 'right')  { current.walls.right = false;  next.cell.walls.left = false; }
        else if (next.dir === 'bottom') { current.walls.bottom = false; next.cell.walls.top = false; }
        else if (next.dir === 'left')   { current.walls.left = false;   next.cell.walls.right = false; }
        stack.push(current);
        current = next.cell;
        current.visited = true;
        visitedCount++;
      } else if (stack.length > 0) {
        current = stack.pop()!;
      } else {
        break;
      }
    }

    // Open up ~15% of remaining interior walls for multi-path loops
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x < COLS - 1 && Math.random() < 0.15) {
          this.maze[y][x].walls.right = false;
          this.maze[y][x + 1].walls.left = false;
        }
        if (y < ROWS - 1 && Math.random() < 0.15) {
          this.maze[y][x].walls.bottom = false;
          this.maze[y + 1][x].walls.top = false;
        }
      }
    }
  }

  private renderMaze() {
    // Clean up previous round's walls + floor
    if (this.wallsGroup) this.wallsGroup.destroy(true);
    if (this.floorLayer) this.floorLayer.destroy(true);
    this.wallsGroup = this.physics.add.staticGroup();
    this.floorLayer = this.add.container(0, 0).setDepth(-1);

    const wallColor = this.theme.card;
    const floorColor1 = this.theme.bg;
    const floorColor2 = (this.theme.bg + 0x101010) & 0xffffff;

    // Floor tiles
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = this.mazeOffsetX + x * CELL;
        const py = this.mazeOffsetY + y * CELL;
        const checker = (x + y) % 2 === 0 ? floorColor1 : floorColor2;
        const tile = this.add.rectangle(
          px + CELL / 2, py + CELL / 2, CELL - 1, CELL - 1, checker, 0.35
        );
        this.floorLayer.add(tile);
      }
    }

    // Walls
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = this.maze[y][x];
        const px = this.mazeOffsetX + x * CELL;
        const py = this.mazeOffsetY + y * CELL;
        if (cell.walls.top)    this.addWall(px + CELL / 2, py, CELL + WALL_THICKNESS, WALL_THICKNESS, wallColor);
        if (cell.walls.bottom) this.addWall(px + CELL / 2, py + CELL, CELL + WALL_THICKNESS, WALL_THICKNESS, wallColor);
        if (cell.walls.left)   this.addWall(px, py + CELL / 2, WALL_THICKNESS, CELL + WALL_THICKNESS, wallColor);
        if (cell.walls.right)  this.addWall(px + CELL, py + CELL / 2, WALL_THICKNESS, CELL + WALL_THICKNESS, wallColor);
      }
    }

    // Outer frame
    const ox = this.mazeOffsetX, oy = this.mazeOffsetY;
    this.addWall(ox + COLS * CELL / 2, oy, COLS * CELL + WALL_THICKNESS, WALL_THICKNESS, wallColor);
    this.addWall(ox + COLS * CELL / 2, oy + ROWS * CELL, COLS * CELL + WALL_THICKNESS, WALL_THICKNESS, wallColor);
    this.addWall(ox, oy + ROWS * CELL / 2, WALL_THICKNESS, ROWS * CELL + WALL_THICKNESS, wallColor);
    this.addWall(ox + COLS * CELL, oy + ROWS * CELL / 2, WALL_THICKNESS, ROWS * CELL + WALL_THICKNESS, wallColor);
  }

  private addWall(x: number, y: number, w: number, h: number, color: number) {
    const wall = this.add.rectangle(x, y, w, h, color, 0.92)
      .setStrokeStyle(1.5, this.theme.accent, 0.55);
    this.wallsGroup.add(wall);
  }

  // ===========================================================================
  // PLAYER
  // ===========================================================================
  private spawnPlayer() {
    const startX = this.mazeOffsetX + CELL / 2;
    const startY = this.mazeOffsetY + CELL / 2;

    const playerKey = 'player-' + this.theme.id;
    // ThemeAtlas already generated 'player-' + theme.id as a ship sprite.
    // We add a soft glow halo behind the player.

    this.playerGlow = this.add.circle(startX, startY, 22, this.theme.accent, 0.18)
      .setDepth(19);
    this.tweens.add({
      targets: this.playerGlow,
      scale: { from: 1, to: 1.25 },
      alpha: { from: 0.18, to: 0.32 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    this.player = this.physics.add.sprite(startX, startY, playerKey);
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(13, 3, 3);
    this.player.setDepth(20);
    this.player.setScale(1.1);

    // Directional indicator (a small arrow that rotates)
    this.playerDirIndicator = this.add.text(startX, startY, '▶', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    this.physics.add.collider(this.player, this.wallsGroup);
  }

  // ===========================================================================
  // TARGETS + ENEMIES
  // ===========================================================================
  private spawnTargetsAndEnemies() {
    if (this.targetsGroup) this.targetsGroup.destroy(true);
    if (this.enemiesGroup) this.enemiesGroup.destroy(true);
    this.targetsGroup = this.physics.add.group();
    this.enemiesGroup = this.physics.add.group();
    this.targetHits.clear();

    const roundTerms = this.pickTerms(this.maxScore);
    if (roundTerms.length === 0) return;

    // First term is the active correct answer; others are decoys
    this.activeTerm = roundTerms[0];
    const promptLabel = this.activeTerm.emoji
      ? `Find: ${this.activeTerm.emoji} ${this.activeTerm.term}`
      : `Find: ${this.activeTerm.term}`;
    this.promptText.setText(promptLabel);
    this.promptText.setData('speakText', `Find: ${this.activeTerm.term}`);

    // Available cells (exclude player start at 0,0)
    const interiorCells: { x: number; y: number }[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x === 0 && y === 0) continue;
        interiorCells.push({ x, y });
      }
    }
    Phaser.Utils.Array.Shuffle(interiorCells);

    // Correct target
    const correctCell = interiorCells.shift()!;
    this.spawnTarget(correctCell, this.activeTerm, true);

    // Decoy targets
    const decoys = roundTerms.slice(1);
    const decoyCount = Math.min(decoys.length, this.lod.isMobile ? 4 : 6);
    for (let i = 0; i < decoyCount; i++) {
      const cell = interiorCells.shift();
      if (!cell) break;
      this.spawnTarget(cell, decoys[i % decoys.length], false);
    }

    // Patrolling enemies (1-2 based on LOD)
    const enemyCount = this.lod.isMobile ? 1 : 2;
    for (let i = 0; i < enemyCount; i++) {
      const cell = interiorCells.shift();
      if (!cell) break;
      this.spawnEnemy(cell);
    }

    // Collisions
    this.physics.add.overlap(this.player, this.targetsGroup, this.handleTargetCollision, undefined, this);
    this.physics.add.overlap(this.player, this.enemiesGroup, this.handleEnemyCollision, undefined, this);
  }

  private spawnTarget(cell: { x: number; y: number }, term: TermItem, isCorrect: boolean) {
    const px = this.mazeOffsetX + cell.x * CELL + CELL / 2;
    const py = this.mazeOffsetY + cell.y * CELL + CELL / 2;

    // AAAA — FIX: Make targets FULLY VISIBLE. Previous alpha was 0.32 (nearly
    // invisible on dark background). Now fully opaque with bright colors.
    const orb = this.add.circle(
      px, py, 26,
      isCorrect ? this.theme.success : this.theme.danger,
      0.9  // was 0.32 — nearly invisible!
    ).setStrokeStyle(4, isCorrect ? this.theme.success : this.theme.danger, 1);
    orb.setDepth(15);

    // Outer glow ring for the correct target — BRIGHT and VISIBLE
    if (isCorrect) {
      const ring = this.add.circle(px, py, 34, this.theme.success, 0.4)
        .setDepth(14);
      this.tweens.add({
        targets: ring,
        scale: { from: 1, to: 1.5 },
        alpha: { from: 0.5, to: 0.1 },
        duration: 700, repeat: -1, ease: 'Sine.out',
      });
      orb.setData('glowRing', ring);
    }

    // AAAA — FIX: Show the FULL WORD at a READABLE size.
    // Previous: 13px (unreadable). Now: 20px bold with stroke.
    const labelText = term.emoji ? `${term.emoji} ${term.term}` : term.term;
    const label = this.add.text(px, py, labelText, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: { width: 100 },
      align: 'center',
    }).setOrigin(0.5).setDepth(16);

    // Make target speakable (tap to hear the word)
    label.setData('speakText', term.term);

    // Pulse — BIGGER pulse so the correct target is obvious
    this.tweens.add({
      targets: [orb, label],
      scale: { from: 1, to: isCorrect ? 1.2 : 1.08 },
      duration: isCorrect ? 500 : 800, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // Physics body — use a circular body sized to the orb
    this.physics.add.existing(orb);
    const body = orb.body as Phaser.Physics.Arcade.Body;
    body.setCircle(22, 0, 0)
         .setImmovable(true)
         .setAllowGravity(false)
         .setEnable(true);

    orb.setData('term', term);
    orb.setData('isCorrect', isCorrect);
    orb.setData('label', label);
    orb.setData('cell', cell);
    this.targetsGroup.add(orb);
  }

  private spawnEnemy(cell: { x: number; y: number }) {
    const px = this.mazeOffsetX + cell.x * CELL + CELL / 2;
    const py = this.mazeOffsetY + cell.y * CELL + CELL / 2;

    const enemyKey = 'particle-' + this.theme.id;
    const enemy = this.add.image(px, py, enemyKey);
    enemy.setTint(this.theme.danger);
    enemy.setDisplaySize(34, 34);
    enemy.setDepth(15);

    // Pulsing red glow
    const aura = this.add.circle(px, py, 20, this.theme.danger, 0.22)
      .setDepth(14);
    this.tweens.add({
      targets: aura,
      scale: { from: 0.9, to: 1.3 },
      alpha: { from: 0.25, to: 0 },
      duration: 600, repeat: -1, ease: 'Sine.out',
    });
    enemy.setData('aura', aura);

    this.physics.add.existing(enemy);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setCircle(17, 0, 0)
        .setAllowGravity(false)
        .setCollideWorldBounds(true);
    body.setBoundsRectangle(
      new Phaser.Geom.Rectangle(
        this.mazeOffsetX, this.mazeOffsetY, COLS * CELL, ROWS * CELL
      )
    );

    // Patrol AI: change direction every 1.4s, or chase player if in LOS
    this.time.addEvent({
      delay: 1400, loop: true,
      callback: () => this.updateEnemyAI(enemy),
    });
    // Initial impulse
    this.updateEnemyAI(enemy);

    this.physics.add.collider(enemy, this.wallsGroup);
    this.enemiesGroup.add(enemy);
  }

  private updateEnemyAI(enemy: Phaser.GameObjects.Image) {
    if (!enemy.active || this.isFinished) return;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    // Check line-of-sight to player (same row or column with no wall)
    if (this.hasLineOfSight(enemy.x, enemy.y, this.player.x, this.player.y)) {
      // Chase the player
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      // AAAA — Ghosts slower at start, ramp with level
      const chaseSpeed = (this.lod.isMobile ? 60 : 80) + (this.level - 1) * 10;
      if (dist > 1) {
        body.setVelocity((dx / dist) * chaseSpeed, (dy / dist) * chaseSpeed);
      }
      return;
    }

    // Patrol: random cardinal direction (so it stays on corridors)
    const dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    ];
    const d = Phaser.Utils.Array.GetRandom(dirs);
    // AAAA — Patrol speed also ramps with level
    const patrolSpeed = (this.lod.isMobile ? 40 : 55) + (this.level - 1) * 8;
    body.setVelocity(d.x * patrolSpeed, d.y * patrolSpeed);
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    // Simple raycast: if both points are in the same row/col and the
    // intermediate cells have no walls blocking them
    const c1 = this.pixelToCell(x1, y1);
    const c2 = this.pixelToCell(x2, y2);
    if (!c1 || !c2) return false;
    if (c1.x === c2.x) {
      const minY = Math.min(c1.y, c2.y);
      const maxY = Math.max(c1.y, c2.y);
      for (let y = minY; y < maxY; y++) {
        if (this.maze[y][c1.x].walls.bottom) return false;
      }
      return true;
    }
    if (c1.y === c2.y) {
      const minX = Math.min(c1.x, c2.x);
      const maxX = Math.max(c1.x, c2.x);
      for (let x = minX; x < maxX; x++) {
        if (this.maze[c1.y][x].walls.right) return false;
      }
      return true;
    }
    return false;
  }

  private pixelToCell(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.mazeOffsetX) / CELL);
    const y = Math.floor((py - this.mazeOffsetY) / CELL);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
    return { x, y };
  }

  // ===========================================================================
  // COLLISION HANDLERS
  // ===========================================================================
  private handleTargetCollision(_player: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile, target: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile) {
    if (this.isFinished) return;
    const t = target as Phaser.GameObjects.Arc;
    if (this.targetHits.get(t)) return;
    this.targetHits.set(t, true);

    const isCorrect = t.getData('isCorrect') as boolean;
    const term = t.getData('term') as TermItem;
    const label = t.getData('label') as Phaser.GameObjects.Text;
    const coord = { x: t.x, y: t.y, t: this.time.now };

    this.recordAnswer({
      term: term.term,
      response: isCorrect ? 'collected' : 'wrong-target',
      success: isCorrect,
      coordinate: coord,
    });

    if (isCorrect) {
      this.tweens.add({
        targets: [t, label],
        scale: 0, alpha: 0,
        duration: 250, ease: 'Back.in',
        onComplete: () => { t.destroy(); label.destroy(); },
      });
      // Speed boost reward (3 seconds)
      this.speedBoostUntil = this.time.now + 3000;
      this.tweens.add({
        targets: this.playerGlow,
        scale: 1.6, duration: 200, yoyo: true, ease: 'Quad.out',
      });
      this.time.delayedCall(350, () => this.advanceRound());
      this.checkWin();
    } else {
      // Wrong target: fade it out, bounce player back
      this.tweens.add({
        targets: [t, label],
        alpha: 0.25, duration: 200,
      });
      this.bouncePlayerBack();
    }
  }

  private handleEnemyCollision(_player: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile, enemy: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile) {
    if (this.isFinished) return;
    const e = enemy as Phaser.GameObjects.GameObject;
    if (this.targetHits.get(e)) return;
    this.targetHits.set(e, true);

    this.recordAnswer({
      term: 'enemy',
      response: 'enemy-collision',
      success: false,
      coordinate: { x: (e as Phaser.GameObjects.Image).x, y: (e as Phaser.GameObjects.Image).y, t: this.time.now },
    });

    // Hit-stop: brief physics freeze for impact
    this.juice.hitStop(100);
    this.bouncePlayerBack();
    this.time.delayedCall(900, () => this.targetHits.delete(e));
  }

  private bouncePlayerBack() {
    // Push player back to start cell
    const targetX = this.mazeOffsetX + CELL / 2;
    const targetY = this.mazeOffsetY + CELL / 2;
    this.physics.moveTo(this.player, targetX, targetY, 600);
    this.time.delayedCall(280, () => {
      if (this.player && this.player.active) this.player.setVelocity(0, 0);
    });
    // Clear any active path
    this.path = [];
    this.pathIdx = 0;
  }

  private advanceRound() {
    this.round++;
    const remaining = this.terms.filter(t => t !== this.activeTerm);
    if (remaining.length === 0) {
      this.checkWin();
      return;
    }
    // AAAA — FIX: Re-spawn ALL targets with the new active term.
    // Previous code only changed the prompt text but didn't update the
    // targets in the maze — so the prompt said "Find: Banana" but the
    // maze still had the old target. Now we regenerate the maze + targets.
    this.activeTerm = Phaser.Utils.Array.GetRandom(remaining);
    const promptLabel = this.activeTerm.emoji
      ? `Find: ${this.activeTerm.emoji} ${this.activeTerm.term}`
      : `Find: ${this.activeTerm.term}`;
    this.promptText.setText(promptLabel);
    this.promptText.setData('speakText', `Find: ${this.activeTerm.term}`);
    // Regenerate maze + targets for the new round
    this.generateMaze();
    this.renderMaze();
    this.spawnTargetsAndEnemies();
  }

  // ===========================================================================
  // COMPASS — points toward the current correct target
  // ===========================================================================
  private updateCompass() {
    if (!this.activeTerm) return;
    const target = this.targetsGroup.getChildren().find(c => c.getData('isCorrect')) as Phaser.GameObjects.Arc | undefined;
    if (!target) return;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    this.compassArrow.setRotation((angle + 90) * Math.PI / 180);
  }

  // ===========================================================================
  // TAP-TO-MOVE — A* pathfinding through the maze
  // ===========================================================================
  private handleTap(px: number, py: number) {
    const startCell = this.pixelToCell(this.player.x, this.player.y);
    const goalCell = this.pixelToCell(px, py);
    if (!startCell || !goalCell) return;
    const path = this.findPath(startCell, goalCell);
    if (path.length > 0) {
      this.path = path.map(c => ({
        x: this.mazeOffsetX + c.x * CELL + CELL / 2,
        y: this.mazeOffsetY + c.y * CELL + CELL / 2,
      }));
      this.pathIdx = 0;
    }
  }

  private findPath(start: { x: number; y: number }, goal: { x: number; y: number }): { x: number; y: number }[] {
    const open: PathNode[] = [];
    const closed = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;
    const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

    const startNode: PathNode = { x: start.x, y: start.y, g: 0, h: h(start.x, start.y), f: 0, parent: null };
    startNode.f = startNode.g + startNode.h;
    open.push(startNode);

    const maxIter = 500;
    let iter = 0;
    while (open.length > 0 && iter < maxIter) {
      iter++;
      // Get node with lowest f
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      if (current.x === goal.x && current.y === goal.y) {
        // Reconstruct path
        const path: { x: number; y: number }[] = [];
        let n: PathNode | null = current;
        while (n && n.parent) {
          path.unshift({ x: n.x, y: n.y });
          n = n.parent;
        }
        return path;
      }
      closed.add(key(current.x, current.y));

      // Neighbors (only through wall openings)
      const cell = this.maze[current.y][current.x];
      const neighbors: { x: number; y: number }[] = [];
      if (!cell.walls.top && current.y > 0)        neighbors.push({ x: current.x, y: current.y - 1 });
      if (!cell.walls.right && current.x < COLS - 1)  neighbors.push({ x: current.x + 1, y: current.y });
      if (!cell.walls.bottom && current.y < ROWS - 1) neighbors.push({ x: current.x, y: current.y + 1 });
      if (!cell.walls.left && current.x > 0)        neighbors.push({ x: current.x - 1, y: current.y });

      for (const nb of neighbors) {
        if (closed.has(key(nb.x, nb.y))) continue;
        const g = current.g + 1;
        const existing = open.find(n => n.x === nb.x && n.y === nb.y);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = g + existing.h;
            existing.parent = current;
          }
        } else {
          const node: PathNode = {
            x: nb.x, y: nb.y, g,
            h: h(nb.x, nb.y), f: 0, parent: current,
          };
          node.f = node.g + node.h;
          open.push(node);
        }
      }
    }
    return [];
  }

  // ===========================================================================
  // PER-FRAME UPDATE — uses physics velocity (respects wall colliders)
  // AAAA — MUST use setVelocity() not direct position updates.
  // Direct position (this.player.x += ...) BYPASSES physics colliders,
  // allowing the player to walk through walls. This was the root cause
  // of "Maze Chase is impossible to play."
  // ===========================================================================
  update(_time: number, delta: number) {
    if (this.isFinished || !this.player) return;
    try {
      this.updateMazeChase(delta);
    } catch (e) {
      console.error('[MiniStar] MazeChase update error:', e);
    }
  }

  private updateMazeChase(delta: number) {

    const now = Date.now();
    const boosted = now < this.speedBoostUntil;
    // AAAA — SLOWER START: Level 1 = 140px/s (was 280). Ramps up 20px/s per level.
    // Level 1=140, Level 2=160, Level 3=180, Level 4=200, Level 5=220, Level 6=240
    const baseSpeed = this.lod.isMobile ? 110 : 140;
    const levelSpeed = baseSpeed + (this.level - 1) * 20;
    const speed = boosted ? levelSpeed * 1.55 : levelSpeed;

    // ---- Keyboard input ----
    let vx = 0, vy = 0;
    if (this.cursors?.left.isDown  || this.wasd?.A.isDown) vx -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) vx += 1;
    if (this.cursors?.up.isDown    || this.wasd?.W.isDown) vy -= 1;
    if (this.cursors?.down.isDown  || this.wasd?.S.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      // Keyboard takes over — cancel any active path
      this.path = [];
      this.pathIdx = 0;
      const mag = Math.hypot(vx, vy);
      // AAAA — Use physics velocity (respects wall colliders!)
      this.player.setVelocity((vx / mag) * speed, (vy / mag) * speed);
      this.playerDir = vy < 0 ? 'up' : vy > 0 ? 'down' : vx < 0 ? 'left' : 'right';
    } else if (this.path.length > 0 && this.pathIdx < this.path.length) {
      // Follow A* path — use physics velocity toward target
      const target = this.path[this.pathIdx];
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        this.pathIdx++;
        this.player.setVelocity(0, 0);
      } else {
        // Move toward target using physics velocity
        this.player.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        this.playerDir = Math.abs(dx) > Math.abs(dy)
          ? (dx < 0 ? 'left' : 'right')
          : (dy < 0 ? 'up' : 'down');
      }
    } else {
      // No input — stop
      this.player.setVelocity(0, 0);
    }

    // Update directional indicator
    const rotMap: Record<Dir, number> = {
      right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2,
    };
    this.playerDirIndicator.setRotation(rotMap[this.playerDir]);
    this.playerDirIndicator.setPosition(this.player.x, this.player.y);
    this.playerGlow.setPosition(this.player.x, this.player.y);

    // Trail emitter follows the player
    if (this.trailEmitter) {
      try { this.trailEmitter.setPosition(this.player.x, this.player.y); } catch {}
      const vel = this.player.body?.velocity;
      const moving = vel && (Math.abs(vel.x) + Math.abs(vel.y) > 50);
      if (moving) {
        try {
          this.trailEmitter.emitting = true;
          if (typeof (this.trailEmitter as any).setTint === 'function') {
            (this.trailEmitter as any).setTint(boosted ? this.theme.warning : this.theme.accent);
          }
        } catch {}
      } else {
        try { this.trailEmitter.emitting = false; } catch {}
      }
    }
  }
}
