import * as Phaser from 'phaser';
import type { ThemeManifest, TermItem, GameLaunchConfig, XapiEvent } from '../lib/types';
import { ThemeAtlas, Juice, Hud } from './Juice';
import { audioBus } from '../lib/audio';
import { getLod } from '../lib/lod';
import { makeAnsweredEvent, makeCompletedEvent, pushEvent, getActor, verifyTelemetry } from '../lib/telemetry';

export abstract class BaseEngine extends Phaser.Scene {
  protected theme!: ThemeManifest;
  protected terms!: TermItem[];
  protected unit = 'unit-1';
  protected qrSlug?: string;
  protected tenantId?: string;
  protected studentId?: string;
  protected juice!: Juice;
  protected hud!: Hud;
  protected startTime = 0;
  protected score = 0;
  protected streak = 0;
  protected maxScore = 0;
  protected answeredEvents: XapiEvent[] = [];
  protected isFinished = false;
  protected lod = getLod();
  protected level = 1;
  protected levelBadge?: Phaser.GameObjects.Text;
  protected levelBg?: Phaser.GameObjects.Rectangle;
  protected termsPerLevel = 3;
  protected urgencyVignette?: Phaser.GameObjects.Graphics;
  protected urgencyActive = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private _lastSfxTime = 0;

  protected abstract buildWorld(): void;
  protected abstract onTick(_remainingMs: number): void;
  protected abstract maxQuestions(): number;

  init(data: { config?: GameLaunchConfig }) {
    const cfg = data?.config ?? (this.registry.get('launchConfig') as GameLaunchConfig | undefined);
    if (!cfg) { console.error('[MiniStar] No launch config'); return; }
    this.registry.set('launchConfig', cfg);
    this.theme = cfg.theme as unknown as ThemeManifest;
    this.terms = cfg.terms ?? [];
    this.unit = cfg.unit || 'unit-1';
    this.qrSlug = cfg.qrSlug;
    this.tenantId = cfg.tenantId;
    this.studentId = cfg.studentId;
    this.score = 0; this.streak = 0; this.isFinished = false;
    this.answeredEvents = []; this.level = 1;
    this.maxScore = this.maxQuestions();
  }

  create() {
    ThemeAtlas.build(this, this.theme);
    this.cameras.main.setBackgroundColor(this.theme.bg);
    const bgKey = 'bg-' + this.theme.id;
    if (this.textures.exists(bgKey)) {
      try { this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(this.scale.width, this.scale.height).setDepth(-10); } catch {}
    }
    if (this.lod.ambientParticles > 0) {
      const sfKey = 'starfield-' + this.theme.id;
      if (this.textures.exists(sfKey)) {
        for (let i = 0; i < Math.min(3, Math.ceil(this.lod.ambientParticles / 20)); i++) {
          const tile = this.add.tileSprite(Math.random() * this.scale.width, Math.random() * this.scale.height, 200, 200, sfKey).setAlpha(0.4).setDepth(-1);
        }
      }
    }
    this.juice = new Juice(this, this.theme);
    this.hud = new Hud(this, this.theme, (state) => this.onHudUpdate(state));
    this.startTime = Date.now();

    // Level badge
    this.levelBg = this.add.rectangle(this.scale.width / 2, 45, 140, 44, 0x000000, 0.7).setStrokeStyle(2, this.theme.warning, 0.8).setDepth(250);
    this.levelBadge = this.add.text(this.scale.width / 2, 45, `LEVEL ${this.level}`, { fontFamily: 'Inter, sans-serif', fontSize: '22px', color: this.hex(this.theme.warning), fontStyle: 'bold' }).setOrigin(0.5).setDepth(251);

    // Urgency vignette
    this.urgencyVignette = this.add.graphics();
    this.urgencyVignette.setDepth(400).setVisible(false);
    this.urgencyActive = false;

    // Pause button
    this._createPauseButton();

    // Pause key
    this.input.keyboard?.on('keydown-P', () => { if (this.scene.isPaused()) this.scene.resume(); else this.scene.pause(); });

    this.buildWorld();

    // Spoken instructions on entry
    this.time.delayedCall(800, () => { if (!this.isFinished) this.speakGameInstructions(); });

    // HUD loop
    this.events.on('update', () => {
      try {
        if (this.isFinished) return;
        const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
        this.onTick(remainingMs);
        if (remainingMs <= 0) this.finishGame(false);
      } catch (e) { console.error('[MiniStar] Update loop error:', e); }
    });

    // CRITICAL: Shutdown/destroy cleanup
    this.events.once('shutdown', () => { try { this.tweens.killAll(); } catch {} try { this.time.removeAllEvents(); } catch {} });
    this.events.once('destroy', () => { try { this.tweens.killAll(); } catch {} try { this.time.removeAllEvents(); } catch {} });

    // NOTE: The periodic `tweens.killAll()` every 8s was REMOVED — it was the
    // ROOT CAUSE of the "stuck cards" bug in Memory Match. When it fired during
    // a card-flip animation (scaleX 1→0→1), the tween's onComplete never ran,
    // leaving the card permanently stuck in a half-flip state (scaleX=0,
    // isFlipped=true, back still visible, unclickable). Phaser's tween manager
    // auto-GCs completed tweens, so this carpet-bomb was unnecessary.
    // The shutdown/destroy handlers above + GameObject.destroy override below
    // are sufficient for cleanup.

    // GameObject.destroy override
    const PhaserNS = Phaser as any;
    if (PhaserNS.GameObjects?.GameObject?.prototype && !PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched) {
      PhaserNS.GameObjects.GameObject.prototype.__ltb_destroy_patched = true;
      const origDestroy = PhaserNS.GameObjects.GameObject.prototype.destroy;
      PhaserNS.GameObjects.GameObject.prototype.destroy = function (fromScene?: boolean) {
        if (this.scene?.tweens) { try { this.scene.tweens.killTweensOf(this); } catch {} }
        return origDestroy.call(this, fromScene);
      };
    }
  }

  protected speakGameInstructions() {
    const instructions: Record<string, string> = {
      'MazeChaseScene': 'Welcome to Maze Chase! Move through the maze, collect the correct words, and dodge the ghosts! Use arrow keys or tap to move.',
      'QuizScene': 'Welcome to Quiz! Read each question, tap to hear it, then tap the correct answer!',
      'AirplaneScene': 'Welcome to Airplane! Steer your rocket left and right to catch the correct banners! Watch out for storm clouds!',
      'GameshowScene': 'Welcome to the Gameshow! Answer each question before time runs out!',
      'MemoryMatchScene': 'Welcome to Memory Match! Flip cards to find matching pairs! Tap any card to hear it!',
      'MatchUpScene': 'Welcome to Match Up! Drag the words on the left to their meanings on the right! Tap any text to hear it!',
      'BalloonPopScene': 'Welcome to Balloon Pop! Pop the balloon carrying the correct word!',
      'WhackAMoleScene': 'Welcome to Whack a Mole! Bonk the mole showing the correct answer! They pop up fast!',
      'AnagramScene': 'Welcome to Anagram! Tap the letters in the correct order to spell the word!',
      'WordsearchScene': 'Welcome to Word Search! Drag across letters to find the hidden words!',
      'BridgeBuilderScene': 'Welcome to Bridge Builder! Guess letters to spell the word!',
      'CrosswordScene': 'Welcome to Crossword! Tap a cell, then type letters to fill in the grid!',
      'FlashCardsScene': 'Welcome to Flash Cards! Tap a card to flip it and hear the word!',
      'SpinWheelScene': 'Welcome to Spin Wheel! Spin the wheel, then match the term to its definition!',
      'GroupSortScene': 'Welcome to Group Sort! Drag each word into the correct category box!',
      'TypeAnswerScene': 'Welcome to Type Answer! Read the meaning, then type the correct word!',
      'SpotItScene': 'Welcome to Spot It! Find the one symbol that appears on both cards! Tap it fast!',
      'EndlessRunnerScene': 'Welcome to Endless Runner! Switch lanes to catch the correct word! Tap left or right side of screen!',
      'PhysicsPuzzlerScene': 'Welcome to Physics Puzzler! Aim your cannon and fire at the correct word block!',
      'SnakingScene': 'Welcome to Word Snake! Guide the snake to eat the correct word! Use arrow keys or tap to steer!',
      'SpeakItScene': 'Welcome to Speak It! Listen to the word, then tap the matching word below!',
      'TrainingAcademyScene': 'Welcome to Training Academy! Say the action command to make the mascot move!',
      'RescueQuestScene': 'Welcome to Rescue Quest! Say the verb to clear each obstacle and rescue the friend!',
      'LabelItScene': 'Welcome to Label It! Tap the word that matches the definition!',
      'StarFarmScene': 'Welcome to Star Farm! A complete farming adventure! Tap the hoe, then tap a tile to till soil. Water it, plant seeds, and harvest crops! Visit the shop to buy seeds and sell crops. Sleep to restore energy. Your farm saves automatically!',
    };
    const instruction = instructions[this.scene.key] ?? 'Welcome! Tap to play!';
    audioBus.speak(instruction);
  }

  protected onHudUpdate(state: { score: number; streak: number; remainingMs: number }) {
    if (state.remainingMs < 60000 && !this.urgencyActive && !this.isFinished) {
      this.urgencyActive = true;
      if (this.urgencyVignette) { this.urgencyVignette.setVisible(true); }
      audioBus.play('countdown');
    }
    if (this.urgencyActive && this.urgencyVignette) {
      const w = this.scale.width, h = this.scale.height, bw = 20;
      this.urgencyVignette.clear();
      this.urgencyVignette.fillStyle(this.theme.danger, 0.5);
      this.urgencyVignette.fillRect(0, 0, w, bw);
      this.urgencyVignette.fillRect(0, h - bw, w, bw);
      this.urgencyVignette.fillRect(0, 0, bw, h);
      this.urgencyVignette.fillRect(w - bw, 0, bw, h);
    }
  }

  protected recordAnswer(opts: { term: string; response: string; success: boolean; coordinate?: { x: number; y: number; t: number } }) {
    if (!this.juice || !this.hud) return;
    const actor = getActor();
    const ev = makeAnsweredEvent({ actor, gameMode: this.scene.key, unit: this.unit, term: opts.term, response: opts.response, success: opts.success, score: this.score, maxScore: this.maxScore, durationMs: Date.now() - this.startTime, coordinate: opts.coordinate, streak: this.streak, tenantId: this.tenantId });
    this.answeredEvents.push(ev); pushEvent(ev);

    if (opts.success) {
      this.score++; this.streak++;
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, this.streak >= 3 ? 'streak' : 'correct');
        this.juice.scorePopup(opts.coordinate?.x ?? this.scale.width / 2, opts.coordinate?.y ?? this.scale.height / 2, this.streak >= 3 ? `STREAK x${this.streak}!` : '+1', this.streak >= 3 ? this.theme.warning : this.theme.success);
      } catch {}
      audioBus.speak(opts.term);
      const baseFreq = 660;
      const streakFreq = baseFreq * Math.pow(2, Math.min(this.streak, 6) / 12);
      const now = Date.now();
      if (now - this._lastSfxTime > 300) { audioBus.play('correct', { freq: streakFreq }); this._lastSfxTime = now; }
      this.checkLevelUp();
    } else {
      this.streak = 0;
      try {
        this.juice.burst(opts.coordinate?.x ?? 400, opts.coordinate?.y ?? 300, 'incorrect');
        this.juice.scorePopup(opts.coordinate?.x ?? this.scale.width / 2, opts.coordinate?.y ?? this.scale.height / 2, 'X', this.theme.danger);
      } catch {}
      audioBus.play('incorrect');
    }
    this.hud.tick(this.score, this.streak, this.maxScore);
  }

  protected finishGame(won: boolean) {
    if (this.isFinished) return;
    this.isFinished = true;
    try { this.tweens.killAll(); } catch {}
    if (this.urgencyVignette) { try { this.urgencyVignette.destroy(); } catch {} this.urgencyVignette = undefined; }
    this.urgencyActive = false;

    const durationMs = Date.now() - this.startTime;
    const actor = getActor();
    const completed = makeCompletedEvent({ actor, gameMode: this.scene.key, unit: this.unit, totalCorrect: this.score, totalQuestions: this.maxScore, durationMs, streak: this.streak, tenantId: this.tenantId });
    pushEvent(completed);
    const verify = verifyTelemetry({ events: [...this.answeredEvents, completed], totalQuestions: this.maxScore, durationMs });

    try { this.physics.world.pause(); } catch {}
    const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.65).setDepth(500);

    const isQuarantined = verify.status === 'quarantine';
    const isReview = verify.status === 'review';
    const statusColor = isQuarantined ? this.theme.danger : isReview ? this.theme.warning : won ? this.theme.success : this.theme.danger;

    if (isQuarantined) { audioBus.play('quarantine'); try { this.juice.shake('heavy'); } catch {} }
    else if (won) { try { this.hud.celebrate(); } catch {} try { this.juice.burst(this.scale.width / 2, this.scale.height / 2, 'win'); } catch {} }
    else { try { this.hud.sad(); } catch {} }

    const title = isQuarantined ? '⚠ SCORE QUARANTINED' : isReview ? '⎯ FLAGGED FOR REVIEW' : won ? (this.score === this.maxScore ? 'PERFECT! 3 STARS!' : this.score >= this.maxScore * 0.7 ? 'GREAT JOB! 2 STARS!' : 'GOOD! 1 STAR!') : '⏱ TIME UP';
    const subtitle = isQuarantined ? verify.anomalyReason ?? 'anomaly detected' : isReview ? verify.anomalyReason ?? 'review required' : `Score: ${this.score} / ${this.maxScore}`;

    const titleText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 80, title, { fontFamily: 'Inter, sans-serif', fontSize: '36px', color: '#' + statusColor.toString(16).padStart(6, '0'), fontStyle: 'bold' }).setOrigin(0.5).setDepth(501);

    if (won) {
      const stars = this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1;
      const starY = this.scale.height / 2 - 30;
      for (let i = 0; i < 3; i++) {
        const filled = i < stars;
        this.add.text(this.scale.width / 2 + (i - 1) * 50, starY, filled ? '⭐' : '☆', { fontFamily: 'Inter, sans-serif', fontSize: '36px' }).setOrigin(0.5).setDepth(501);
      }
    }

    const subText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, subtitle, { fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(501);

    const accuracy = this.maxScore > 0 ? Math.round((this.score / this.maxScore) * 100) : 0;
    const timeSec = (durationMs / 1000).toFixed(1);
    const xpEarned = this.score * 10 + (this.score === this.maxScore ? 50 : 0);
    const tokensEarned = this.score * 5;
    const starsWon = won ? (this.score === this.maxScore ? 3 : this.score >= this.maxScore * 0.7 ? 2 : 1) : 0;
    const bestKey = `best-score-${this.scene.key}`;
    const prevBest = (this.registry.get(bestKey) as number) || 0;
    const isNewBest = this.score > prevBest;
    if (isNewBest) this.registry.set(bestKey, this.score);
    const bestText = isNewBest ? '🏆 NEW BEST!' : `Best: ${prevBest}/${this.maxScore}`;

    const statsText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, `Accuracy: ${accuracy}%  ·  Streak: ${this.streak}  ·  Time: ${timeSec}s\n⭐ ${starsWon}/3  ·  +${xpEarned} XP  ·  +${tokensEarned} tokens  ·  ${bestText}`, { fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(501).setAlpha(0.8);

    // Achievement badges
    const badges: string[] = [];
    if (this.score === this.maxScore) badges.push('🏆 PERFECT GAME');
    if (this.streak >= 5) badges.push('🔥 ON FIRE');
    if (this.streak >= 10) badges.push('💎 UNSTOPPABLE');
    if (this.level >= 3) badges.push('⭐ LEVEL 3+');
    if (this.level >= 5) badges.push('👑 LEVEL 5 MASTER');
    if (durationMs < 30000 && this.score >= this.maxScore * 0.5) badges.push('⚡ SPEED DEMON');
    if (this.score === 0 && !won) badges.push('🌱 KEEP TRYING');
    if (badges.length > 0) {
      this.add.text(this.scale.width / 2, this.scale.height / 2 + 110, badges.join('  ·  '), { fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#' + this.theme.warning.toString(16).padStart(6, '0'), fontStyle: 'bold', align: 'center', wordWrap: { width: 500 } }).setOrigin(0.5).setDepth(501);
    }

    // Play Again button (restart from level 1)
    const btnBg = this.add.rectangle(this.scale.width / 2 - 130, this.scale.height / 2 + 80, 160, 44, statusColor, 0.9).setDepth(501);
    const btn = this.add.text(this.scale.width / 2 - 130, this.scale.height / 2 + 80, '🔄 Play Again', { fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(502).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => { audioBus.play('tap'); this.scene.restart({ config: this.registry.get('launchConfig') }); });

    // New Game button (exit to library)
    const btnBg2 = this.add.rectangle(this.scale.width / 2, this.scale.height / 2 + 80, 160, 44, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.8).setDepth(501);
    const btn2 = this.add.text(this.scale.width / 2, this.scale.height / 2 + 80, '🎮 New Game', { fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(502).setInteractive({ useHandCursor: true });
    btn2.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });

    // Game Complete button (exit to library — fixes Level 3 "freeze" where
    // the user finished all levels but had no clear exit affordance)
    const btnBg3 = this.add.rectangle(this.scale.width / 2 + 130, this.scale.height / 2 + 80, 160, 44, this.theme.success, 0.9).setDepth(501);
    const btn3 = this.add.text(this.scale.width / 2 + 130, this.scale.height / 2 + 80, '✓ Complete', { fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(502).setInteractive({ useHandCursor: true });
    btn3.on('pointerdown', () => { audioBus.play('tap'); try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ministar-exit-game')); } catch {} try { this.game.destroy(true); } catch {} });

    // Animate overlay in
    overlay.setAlpha(0); titleText.setAlpha(0); subText.setAlpha(0); statsText.setAlpha(0); btnBg.setAlpha(0); btn.setAlpha(0); btnBg2.setAlpha(0); btn2.setAlpha(0); btnBg3.setAlpha(0); btn3.setAlpha(0);
    this.tweens.add({ targets: [overlay, titleText, subText, statsText, btnBg, btn, btnBg2, btn2, btnBg3, btn3], alpha: { from: 0, to: 1 }, duration: 400, ease: 'Cubic.out' });
  }

  protected checkWin() { if (this.score >= this.maxScore && !this.isFinished) { this.time.delayedCall(400, () => this.finishGame(true)); } }

  protected pickTerms(n: number): TermItem[] { const copy = [...this.terms]; Phaser.Utils.Array.Shuffle(copy); return copy.slice(0, Math.min(n, copy.length)); }

  protected hex(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }

  protected hitTest(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle, px: number, py: number): boolean {
    const x = obj.x, y = obj.y; let w = 100, h = 50;
    if ('width' in obj && obj.width) w = obj.width as number;
    if ('height' in obj && obj.height) h = obj.height as number;
    return px >= x - w / 2 && px <= x + w / 2 && py >= y - h / 2 && py <= y + h / 2;
  }

  protected setupGlobalPointer(handler: (x: number, y: number) => void) {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { handler(p.x, p.y); });
  }

  protected checkLevelUp() {
    const newLevel = Math.floor(this.score / this.termsPerLevel) + 1;
    if (newLevel > this.level) { this.level = newLevel; this.showLevelUp(); }
  }

  protected getDifficultyMultiplier(): number { return 1.0 + (this.level - 1) * 0.2; }

  protected getSpeedBonus(roundStartTime: number): number {
    const rt = Date.now() - roundStartTime;
    if (rt < 2000) return 5; if (rt < 4000) return 3; if (rt < 6000) return 1; return 0;
  }

  protected showLevelUp() {
    if (!this.levelBadge || !this.juice) return;
    try {
      this.levelBadge.setText(`LEVEL ${this.level}`);
      const levelColors = [0x3b82f6, 0x22c55e, 0xfbbf24, 0xf97316, 0xef4444];
      const badgeColor = levelColors[Math.min(this.level - 1, 4)];
      this.levelBadge.setColor('#' + badgeColor.toString(16).padStart(6, '0'));
      if (this.levelBg) this.levelBg.setStrokeStyle(2, badgeColor, 0.8);
      audioBus.speak(`Level ${this.level}!`);
      this.juice.scorePopup(this.scale.width / 2, this.scale.height / 2 - 50, `LEVEL ${this.level}!`, badgeColor);
      this.tweens.add({ targets: [this.levelBadge, this.levelBg], scale: { from: 1, to: 1.3 }, duration: 200, yoyo: true, repeat: 2, ease: 'Back.out' });
      if (this.level >= 3) audioBus.play('countdown');
    } catch (e) { console.error('[MiniStar] showLevelUp error:', e); }
  }

  protected speakPrompt(term: string, definition?: string) { audioBus.speakTerm(term, definition); }

  protected makeSpeakable(text: Phaser.GameObjects.Text, speechText?: string) {
    const speak = speechText ?? text.text;
    text.setData('speakText', speak);
    text.setInteractive({ useHandCursor: true });
    // Read from data at tap time (not capture time) so the speakable text
    // updates when the text content changes (e.g., prompt text changes per round).
    text.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      if (event) event.stopPropagation();
      const current = (text.getData('speakText') as string) ?? speak ?? text.text;
      audioBus.speak(current);
    });
  }

  private _createPauseButton() {
    const btn = this.add.text(15, 95, '⏸', { fontFamily: 'Inter, sans-serif', fontSize: '22px' }).setDepth(300).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      if (this.isFinished) return;
      if (this.scene.isPaused()) { this.scene.resume(); if (this.pauseOverlay) this.pauseOverlay.setVisible(false); }
      else { this.scene.pause(); this._showPauseOverlay(); }
    });
  }

  private _showPauseOverlay() {
    if (this.pauseOverlay) { this.pauseOverlay.setVisible(true); return; }
    const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7).setDepth(450);
    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, '⏸ Paused', { fontFamily: 'Inter, sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(451);
    const resumeBtn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 10, '▶ Resume', { fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#22c55e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(451).setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => { this.scene.resume(); if (this.pauseOverlay) this.pauseOverlay.setVisible(false); });
    const quitBtn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, '✗ Quit to Library', { fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#ef4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(451).setInteractive({ useHandCursor: true });
    quitBtn.on('pointerdown', () => { try { this.game.destroy(true); } catch {} });
    this.pauseOverlay = this.add.container(0, 0, [overlay, title, resumeBtn, quitBtn]).setDepth(450);
  }
}
