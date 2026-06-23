import * as Phaser from 'phaser';
import type { ThemeManifest, ThemeId } from '../lib/types';
import { audioBus } from '../lib/audio';

// ============================================================================
// WorldEffects — Each theme world has UNIQUE gameplay effects, not just skins
// ============================================================================
// This is what makes MiniStar different from Wordwall: choosing a world
// actually CHANGES how the game plays, not just how it looks.
//
// 10 worlds, each with:
// - Ambient particle effect (snow, bubbles, leaves, confetti, etc.)
// - Theatrical intro animation (plays when game starts)
// - Unique gameplay modifier (low gravity, double XP, slower timer, etc.)
// - World-specific win celebration
// - World-specific mascot phrases
// ============================================================================

export interface WorldConfig {
  id: ThemeId;
  ambientEmoji: string;        // emoji used for ambient particles
  ambientCount: number;        // how many ambient particles
  ambientSpeed: number;        // fall speed (px/sec)
  ambientSize: number;         // particle size
  introText: string;           // spoken during theatrical intro
  introEmoji: string;          // big emoji shown during intro
  gameplayModifier: GameplayModifier;
  winCelebration: string;      // emoji rain on win
  mascotPhrases: MascotPhrases;
}

export interface GameplayModifier {
  name: string;
  description: string;
  scoreMultiplier: number;     // e.g. 2.0 = double points
  timerMultiplier: number;     // e.g. 1.5 = 50% more time
  gravityMultiplier: number;   // e.g. 0.5 = low gravity (for physics games)
  hintFrequency: number;       // 0-1, chance of hint appearing
}

export interface MascotPhrases {
  greeting: string;
  correct: string[];
  wrong: string[];
  streak: string[];
  levelUp: string[];
  win: string[];
  urgent: string[];
}

export const WORLD_CONFIGS: Record<ThemeId, WorldConfig> = {
  space: {
    id: 'space',
    ambientEmoji: '⭐',
    ambientCount: 30,
    ambientSpeed: 20,
    ambientSize: 14,
    introText: 'Welcome to Space Academy! Stars grant bonus points here!',
    introEmoji: '🚀',
    gameplayModifier: {
      name: 'Star Power',
      description: 'Stars align — double points on all answers!',
      scoreMultiplier: 2.0,
      timerMultiplier: 1.0,
      gravityMultiplier: 0.3,
      hintFrequency: 0.15,
    },
    winCelebration: '🚀⭐🪐',
    mascotPhrases: {
      greeting: 'Blast off! Let\'s learn some space words!',
      correct: ['Stellar!', 'Out of this world!', 'Cosmic!', 'Houston, we have a winner!'],
      wrong: ['Lost in space...', 'Try again, astronaut!', 'Black hole got that one!'],
      streak: ['You\'re on fire like a comet!', 'Galactic streak!', 'Supernova streak!'],
      levelUp: ['Promotion! You\'re a Space Captain now!', 'New galaxy unlocked!'],
      win: ['Mission accomplished! You\'re a space hero!', 'Universe conquered!'],
      urgent: ['Hurry! The meteor is coming!', 'Time running out, captain!'],
    },
  },
  jungle: {
    id: 'jungle',
    ambientEmoji: '🍃',
    ambientCount: 20,
    ambientSpeed: 30,
    ambientSize: 16,
    introText: 'Welcome to the Jungle! Vines give you extra time!',
    introEmoji: '🌴',
    gameplayModifier: {
      name: 'Vine Power',
      description: 'Jungle vines grant 50% more time per question!',
      scoreMultiplier: 1.0,
      timerMultiplier: 1.5,
      gravityMultiplier: 1.0,
      hintFrequency: 0.2,
    },
    winCelebration: '🌴🍃🦜',
    mascotPhrases: {
      greeting: 'Let\'s trek through the jungle of words!',
      correct: ['Roar-some!', 'Wildly correct!', 'Tiger-tastic!', 'You\'re a jungle pro!'],
      wrong: ['Even lions miss sometimes...', 'Try again, explorer!', 'Watch out for that vine!'],
      streak: ['You\'re on a safari streak!', 'King of the jungle streak!', 'Wild streak!'],
      levelUp: ['You\'ve discovered a new trail!', 'Jungle guide promoted!'],
      win: ['You\'ve conquered the jungle!', 'Tarzan-level achievement!'],
      urgent: ['The sun is setting!', 'Hurry before the jaguar catches up!'],
    },
  },
  festival: {
    id: 'festival',
    ambientEmoji: '🎊',
    ambientCount: 25,
    ambientSpeed: 40,
    ambientSize: 14,
    introText: 'Welcome to the Festival! Every correct answer rains confetti!',
    introEmoji: '🎆',
    gameplayModifier: {
      name: 'Festival Joy',
      description: 'Confetti everywhere! Hints appear 25% more often!',
      scoreMultiplier: 1.5,
      timerMultiplier: 1.0,
      gravityMultiplier: 1.0,
      hintFrequency: 0.25,
    },
    winCelebration: '🎆🎊🎉',
    mascotPhrases: {
      greeting: 'Let\'s party with words!',
      correct: ['Fantastic!', 'Bravo!', 'Encore!', 'Show-stopping!'],
      wrong: ['Even performers miss a note...', 'Try again, superstar!', 'The show must go on!'],
      streak: ['You\'re on fire like fireworks!', 'Standing ovation streak!', 'Encore streak!'],
      levelUp: ['You\'re the headliner now!', 'Main stage unlocked!'],
      win: ['What a performance! Standing ovation!', 'Festival champion!'],
      urgent: ['The festival is ending soon!', 'Last song, hurry!'],
    },
  },
  cityscape: {
    id: 'cityscape',
    ambientEmoji: '🏙️',
    ambientCount: 15,
    ambientSpeed: 15,
    ambientSize: 18,
    introText: 'Welcome to the City! Green lights give you bonus time!',
    introEmoji: '🌆',
    gameplayModifier: {
      name: 'Traffic Light',
      description: 'Green lights grant bonus time. Red lights drain it!',
      scoreMultiplier: 1.0,
      timerMultiplier: 1.0,
      gravityMultiplier: 1.0,
      hintFrequency: 0.1,
    },
    winCelebration: '🏙️🌃✨',
    mascotPhrases: {
      greeting: 'City lights and city words!',
      correct: ['Urban excellent!', 'City slicker!', 'Downtown correct!', 'Metropolitan!'],
      wrong: ['Traffic jam on that one...', 'Try again, city kid!', 'Wrong turn!'],
      streak: ['You\'re on a city streak!', 'Skyline streak!', 'Empire State streak!'],
      levelUp: ['You\'ve unlocked a new borough!', 'City mayor promoted!'],
      win: ['You\'ve conquered the city!', 'Mayor of Vocabulary City!'],
      urgent: ['The light is turning red!', 'Hurry, the bus is leaving!'],
    },
  },
  ocean: {
    id: 'ocean',
    ambientEmoji: '🫧',
    ambientCount: 30,
    ambientSpeed: -25,  // bubbles float UP
    ambientSize: 12,
    introText: 'Welcome to the Ocean! Bubbles slow down the timer!',
    introEmoji: '🌊',
    gameplayModifier: {
      name: 'Ocean Calm',
      description: 'Underwater serenity — timer drains 30% slower!',
      scoreMultiplier: 1.0,
      timerMultiplier: 1.3,
      gravityMultiplier: 0.5,
      hintFrequency: 0.15,
    },
    winCelebration: '🌊🫧🐠',
    mascotPhrases: {
      greeting: 'Dive into the ocean of words!',
      correct: ['Fin-tastic!', 'Whale of a job!', 'Splash hit!', 'Reef-tastic!'],
      wrong: ['Even sharks miss sometimes...', 'Try again, diver!', 'That one sank!'],
      streak: ['You\'re on a tidal wave streak!', 'Tsunami streak!', 'Ocean current streak!'],
      levelUp: ['You\'ve discovered a new reef!', 'Deep sea diver promoted!'],
      win: ['You\'ve conquered the seven seas!', 'Poseidon-level achievement!'],
      urgent: ['The tide is going out!', 'Air running low, surface soon!'],
    },
  },
  candy: {
    id: 'candy',
    ambientEmoji: '🧁',
    ambientCount: 20,
    ambientSpeed: 25,
    ambientSize: 16,
    introText: 'Welcome to Candy Land! Sugar rush = faster points!',
    introEmoji: '🍭',
    gameplayModifier: {
      name: 'Sugar Rush',
      description: 'Sugar rush! 50% more points but 20% less time!',
      scoreMultiplier: 1.5,
      timerMultiplier: 0.8,
      gravityMultiplier: 1.0,
      hintFrequency: 0.2,
    },
    winCelebration: '🍭🧁🍬',
    mascotPhrases: {
      greeting: 'Sweet! Let\'s learn some candy words!',
      correct: ['Sweet!', 'Sugar rush!', 'Delicious!', 'Candy-licious!'],
      wrong: ['Even candy melts sometimes...', 'Try again, sweet tooth!', 'That one was sour!'],
      streak: ['You\'re on a sugar streak!', 'Candy cane streak!', 'Lollipop streak!'],
      levelUp: ['You\'ve unlocked a new flavor!', 'Candy chef promoted!'],
      win: ['You\'ve conquered Candy Land!', 'Willy Wonka-level achievement!'],
      urgent: ['The candy is melting!', 'Hurry, the sugar crash is coming!'],
    },
  },
  haunted: {
    id: 'haunted',
    ambientEmoji: '🦇',
    ambientCount: 15,
    ambientSpeed: 35,
    ambientSize: 16,
    introText: 'Welcome to the Haunted Hall! Ghosts hide answers... but reveal hints!',
    introEmoji: '👻',
    gameplayModifier: {
      name: 'Spooky Surprises',
      description: 'Ghosts reveal hints 30% more often — but jump scares cost time!',
      scoreMultiplier: 1.3,
      timerMultiplier: 0.9,
      gravityMultiplier: 1.0,
      hintFrequency: 0.3,
    },
    winCelebration: '👻🦇🕸️',
    mascotPhrases: {
      greeting: 'Boo! Let\'s learn some spooky words!',
      correct: ['Boo-tiful!', 'Spook-tacular!', 'Ghostly good!', 'Haunted hit!'],
      wrong: ['Even ghosts get scared sometimes...', 'Try again, brave one!', 'That vanished!'],
      streak: ['You\'re on a haunted streak!', 'Ghost chain streak!', 'Poltergeist streak!'],
      levelUp: ['You\'ve unlocked a new room!', 'Ghost hunter promoted!'],
      win: ['You\'ve conquered the haunted hall!', 'Ghostbuster-level achievement!'],
      urgent: ['The ghosts are waking up!', 'Midnight is approaching!'],
    },
  },
  sports: {
    id: 'sports',
    ambientEmoji: '⚽',
    ambientCount: 12,
    ambientSpeed: 50,
    ambientSize: 18,
    introText: 'Welcome to the Stadium! Whistles grant extra turns!',
    introEmoji: '🏟️',
    gameplayModifier: {
      name: 'Whistle Power',
      description: 'Referee whistles grant bonus turns on streak milestones!',
      scoreMultiplier: 1.2,
      timerMultiplier: 1.0,
      gravityMultiplier: 1.0,
      hintFrequency: 0.1,
    },
    winCelebration: '⚽🏀🏆',
    mascotPhrases: {
      greeting: 'Game on! Let\'s score some words!',
      correct: ['Home run!', 'Touchdown!', 'Goal!', 'Slam dunk!'],
      wrong: ['Even pros strike out...', 'Try again, champ!', 'Foul ball!'],
      streak: ['You\'re on a winning streak!', 'Hat trick streak!', 'MVP streak!'],
      levelUp: ['You\'ve made the all-star team!', 'Team captain promoted!'],
      win: ['You\'ve won the championship!', 'Hall of Fame achievement!'],
      urgent: ['Final seconds on the clock!', 'Hurry, the whistle is about to blow!'],
    },
  },
  christmas: {
    id: 'christmas',
    ambientEmoji: '❄️',
    ambientCount: 40,
    ambientSpeed: 30,
    ambientSize: 14,
    introText: 'Welcome to Christmas Eve! Snowflakes reveal gift boxes with bonus points!',
    introEmoji: '🎄',
    gameplayModifier: {
      name: 'Gift Boxes',
      description: 'Random gift boxes appear with bonus points — catch them!',
      scoreMultiplier: 1.0,
      timerMultiplier: 1.2,
      gravityMultiplier: 0.8,
      hintFrequency: 0.2,
    },
    winCelebration: '🎄🎁❄️',
    mascotPhrases: {
      greeting: 'Ho ho ho! Let\'s learn some Christmas words!',
      correct: ['Ho ho ho!', 'Merry and bright!', 'Jolly good!', 'Festive!'],
      wrong: ['Even elves make mistakes...', 'Try again, helper!', 'On the naughty list!'],
      streak: ['You\'re on a sleigh ride streak!', 'Reindeer streak!', 'Jingle bell streak!'],
      levelUp: ['You\'ve unlocked a new present!', 'Head elf promoted!'],
      win: ['You\'ve saved Christmas!', 'Santa-level achievement!'],
      urgent: ['Santa is coming down the chimney!', 'Hurry, Christmas morning is here!'],
    },
  },
  easter: {
    id: 'easter',
    ambientEmoji: '🦋',
    ambientCount: 20,
    ambientSpeed: 20,
    ambientSize: 16,
    introText: 'Welcome to Easter Garden! Hidden eggs reveal secret bonus points!',
    introEmoji: '🐰',
    gameplayModifier: {
      name: 'Egg Hunt',
      description: 'Hidden eggs appear randomly — find them for bonus points!',
      scoreMultiplier: 1.1,
      timerMultiplier: 1.1,
      gravityMultiplier: 1.0,
      hintFrequency: 0.25,
    },
    winCelebration: '🐰🥚🦋',
    mascotPhrases: {
      greeting: 'Hoppy learning! Let\'s find some Easter words!',
      correct: ['Hop-tastic!', 'Egg-cellent!', 'Bunny-licious!', 'Spring-tacular!'],
      wrong: ['Even bunnies trip sometimes...', 'Try again, hopper!', 'That egg was empty!'],
      streak: ['You\'re on a bunny hop streak!', 'Egg hunt streak!', 'Spring bloom streak!'],
      levelUp: ['You\'ve found a new egg!', 'Master bunny promoted!'],
      win: ['You\'ve found the golden egg!', 'Easter Bunny-level achievement!'],
      urgent: ['The eggs are hiding!', 'Hurry, spring is ending!'],
    },
  },
};

// ============================================================================
// WorldEffectsManager — applies world-specific ambient + gameplay effects
// ============================================================================

export class WorldEffectsManager {
  private scene: Phaser.Scene;
  private theme: ThemeManifest;
  private config: WorldConfig;
  private ambientParticles: Phaser.GameObjects.Text[] = [];
  private giftBoxes: Phaser.GameObjects.Text[] = [];
  private hintTimer?: number;
  private introPlayed = false;

  constructor(scene: Phaser.Scene, theme: ThemeManifest) {
    this.scene = scene;
    this.theme = theme;
    this.config = WORLD_CONFIGS[theme.id] ?? WORLD_CONFIGS.space;
    // AAAA — Set the world on the audio bus so ambient music uses the
    // correct musical key for this world
    audioBus.setWorld(theme.id);
  }

  // ===========================================================================
  // THEATRICAL INTRO — plays once when game starts
  // ===========================================================================
  playIntro(onComplete: () => void) {
    if (this.introPlayed) { onComplete(); return; }
    this.introPlayed = true;

    try {
      const w = this.scene.scale.width;
      const h = this.scene.scale.height;

      // Full-screen overlay
      const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
        .setDepth(900).setAlpha(0);

      // Big world emoji
      const emoji = this.scene.add.text(w / 2, h / 2 - 40, this.config.introEmoji, {
        fontSize: '96px',
      }).setOrigin(0.5).setDepth(901).setAlpha(0).setScale(0.3);

      // World name
      const name = this.scene.add.text(w / 2, h / 2 + 50, this.theme.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: '#' + this.theme.accent.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(901).setAlpha(0);

      // Gameplay modifier badge
      const modBadge = this.scene.add.text(w / 2, h / 2 + 90, this.config.gameplayModifier.description, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(901).setAlpha(0);

      // Animate in
      this.scene.tweens.add({
        targets: [overlay, emoji, name, modBadge],
        alpha: { from: 0, to: 1 },
        duration: 400,
        ease: 'Cubic.out',
      });

      // Emoji pop animation
      this.scene.tweens.add({
        targets: emoji,
        scale: 1,
        duration: 500,
        ease: 'Back.out',
      });

      // Speak the intro
      audioBus.speak(this.config.introText);

      // After 2.5s, fade out + complete
      setTimeout(() => {
        this.scene.tweens.add({
          targets: [overlay, emoji, name, modBadge],
          alpha: 0,
          duration: 300,
          ease: 'Cubic.in',
          onComplete: () => {
            overlay.destroy();
            emoji.destroy();
            name.destroy();
            modBadge.destroy();
            onComplete();
          },
        });
      }, 2500);
    } catch (e) {
      // If anything fails, just continue
      onComplete();
    }
  }

  // ===========================================================================
  // AMBIENT PARTICLES — world-specific background effects
  // ===========================================================================
  startAmbient() {
    try {
      for (let i = 0; i < this.config.ambientCount; i++) {
        const x = Math.random() * this.scene.scale.width;
        const startY = this.config.ambientSpeed > 0
          ? -20 - Math.random() * 200  // fall from top
          : this.scene.scale.height + 20 + Math.random() * 200;  // float from bottom
        const particle = this.scene.add.text(x, startY, this.config.ambientEmoji, {
          fontSize: `${this.config.ambientSize}px`,
        }).setOrigin(0.5).setDepth(5).setAlpha(0.3 + Math.random() * 0.4);

        // Animate falling/floating
        const duration = (this.scene.scale.height + 400) / Math.abs(this.config.ambientSpeed) * 1000;
        const driftX = (Math.random() - 0.5) * 60;

        this.scene.tweens.add({
          targets: particle,
          y: this.config.ambientSpeed > 0
            ? this.scene.scale.height + 50
            : -50,
          x: `+=${driftX}`,
          duration: duration,
          delay: Math.random() * 3000,
          repeat: -1,
          ease: 'Sine.inOut',
          onRepeat: () => {
            particle.x = Math.random() * this.scene.scale.width;
            particle.y = this.config.ambientSpeed > 0 ? -20 : this.scene.scale.height + 20;
          },
        });

        // Subtle rotation for some particles
        if (Math.random() > 0.5) {
          this.scene.tweens.add({
            targets: particle,
            angle: 360,
            duration: 3000 + Math.random() * 2000,
            repeat: -1,
          });
        }

        this.ambientParticles.push(particle);
      }
    } catch {}
  }

  stopAmbient() {
    this.ambientParticles.forEach(p => {
      try { p.destroy(); } catch {}
    });
    this.ambientParticles = [];
  }

  // ===========================================================================
  // GAMEPLAY MODIFIER — get the active modifier
  // ===========================================================================
  getModifier(): GameplayModifier {
    return this.config.gameplayModifier;
  }

  // ===========================================================================
  // MASCOT PHRASES — world-specific speech
  // ===========================================================================
  getPhrase(category: keyof MascotPhrases): string {
    const phrases = this.config.mascotPhrases[category];
    if (Array.isArray(phrases)) {
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    return phrases;
  }

  // ===========================================================================
  // GIFT BOXES / EASTER EGGS — random bonus items
  // ===========================================================================
  spawnGiftBox(onCollect: () => void) {
    if (this.config.id !== 'christmas' && this.config.id !== 'easter') return;

    try {
      const x = 100 + Math.random() * (this.scene.scale.width - 200);
      const y = 150 + Math.random() * 200;
      const emoji = this.config.id === 'christmas' ? '🎁' : '🥚';

      const box = this.scene.add.text(x, y, emoji, {
        fontSize: '32px',
      }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });

      // Pulse animation
      this.scene.tweens.add({
        targets: box,
        scale: { from: 0.8, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });

      // Auto-disappear after 5s
      setTimeout(() => {
        if (box.active) {
          this.scene.tweens.add({
            targets: box,
            alpha: 0,
            scale: 0,
            duration: 300,
            onComplete: () => box.destroy(),
          });
        }
      }, 5000);

      box.on('pointerdown', () => {
        this.scene.tweens.add({
          targets: box,
          scale: 2,
          alpha: 0,
          duration: 300,
          ease: 'Back.out',
          onComplete: () => {
            box.destroy();
            onCollect();
          },
        });
        audioBus.play('correct');
      });

      this.giftBoxes.push(box);
    } catch {}
  }

  // ===========================================================================
  // WIN CELEBRATION — world-specific emoji rain
  // ===========================================================================
  playWinCelebration() {
    try {
      const emojis = this.config.winCelebration.split('');
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * this.scene.scale.width;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const particle = this.scene.add.text(x, -30, emoji, {
          fontSize: `${20 + Math.random() * 16}px`,
        }).setOrigin(0.5).setDepth(500);

        this.scene.tweens.add({
          targets: particle,
          y: this.scene.scale.height + 50,
          x: `+=${(Math.random() - 0.5) * 100}`,
          angle: Math.random() * 360,
          duration: 2000 + Math.random() * 1000,
          delay: Math.random() * 500,
          ease: 'Sine.in',
          onComplete: () => particle.destroy(),
        });
      }
    } catch {}
  }

  destroy() {
    this.stopAmbient();
    this.giftBoxes.forEach(b => { try { b.destroy(); } catch {} });
    this.giftBoxes = [];
  }
}
