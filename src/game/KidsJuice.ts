import * as Phaser from 'phaser';
import { audioBus } from '../lib/audio';

// ============================================================================
// KidsJuice — Shared Kid-Mode Helper (AAAA KIDS MODE STANDARD)
// ============================================================================
// Provides reusable karaoke-style audio-text sync highlighting.
// Per-scene state stored via Symbol-keyed fields to avoid name collisions.
// ============================================================================

export const HIGHLIGHT_COLORS = ['#ff6b9d', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffaaa5', '#c7ceea'];

export const CELEBRATION_PHRASES = [
  'You got it!', 'Yes! Superstar!', 'Brilliant!', 'Amazing work!',
  'Fantastic!', 'You are so smart!', 'Wonderful!', 'Perfect match!',
];

export const PRAISE_PHRASES = [
  'Wow!', "You're super smart!", 'Fantastic!', 'Amazing!',
  'Brilliant!', 'You got it!', 'Wonderful!', 'Incredible!',
  'Great job!', 'Way to go!', 'Awesome!', 'Stellar!',
];

export const STICKER_EMOJIS = ['⭐', '🌟', '💫', '✨', '🎯', '🌈', '🏆', '🎀', '🎈', '🦄'];

export const CONFETTI_EMOJIS = ['🎉', '🎊', '⭐', '🌟', '💫', '✨', '🎈', '🏆'];

const HIGHLIGHT_TIMERS = Symbol('kidsJuiceHighlightTimers');
const HIGHLIGHT_TARGETS = Symbol('kidsJuiceHighlightTargets');

type SceneWithKidsJuice = Phaser.Scene & {
  [HIGHLIGHT_TIMERS]?: Phaser.Time.TimerEvent[];
  [HIGHLIGHT_TARGETS]?: Phaser.GameObjects.Text[];
};

export class KidsJuice {
  // ===========================================================================
  // AUDIO-TEXT SYNC HIGHLIGHTING — karaoke-style animated highlight
  // ===========================================================================
  static speakWithHighlight(
    scene: SceneWithKidsJuice,
    textObj: Phaser.GameObjects.Text,
    text: string,
    opts: { rate?: number; pitch?: number; volume?: number; isQuestion?: boolean; onEnd?: () => void } = {}
  ) {
    if (!scene[HIGHLIGHT_TIMERS]) scene[HIGHLIGHT_TIMERS] = [];
    if (!scene[HIGHLIGHT_TARGETS]) scene[HIGHLIGHT_TARGETS] = [];

    KidsJuice.clearHighlights(scene);
    scene[HIGHLIGHT_TARGETS]!.push(textObj);

    const origColor = textObj.style.color;
    const origStroke = (textObj.style as any).stroke ?? '#000000';
    const origStrokeThickness = (textObj.style as any).strokeThickness ?? 0;
    const origScale = textObj.scaleX ?? 1;

    const estMs = Math.max(1200, text.length * 65);

    const startHighlight = () => {
      try {
        textObj.setStyle({
          stroke: '#ffff00',
          strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 0, color: '#ffff00', blur: 12, fill: true, stroke: true },
        });
        try { scene.tweens.killTweensOf(textObj); } catch {}
        scene.tweens.add({
          targets: textObj,
          scale: { from: origScale, to: origScale * 1.1 },
          duration: 350, yoyo: true, repeat: 999, ease: 'Sine.inOut',
        });
        let colorIdx = 0;
        const colorTimer = scene.time.addEvent({
          delay: 200, repeat: 999,
          callback: () => {
            try {
              colorIdx = (colorIdx + 1) % HIGHLIGHT_COLORS.length;
              textObj.setColor(HIGHLIGHT_COLORS[colorIdx]);
            } catch {}
          },
        });
        scene[HIGHLIGHT_TIMERS]!.push(colorTimer);
      } catch (e) {
        console.error('[KidsJuice] startHighlight error:', e);
      }
    };

    const endHighlight = () => {
      try {
        textObj.setStyle({
          stroke: origStroke,
          strokeThickness: origStrokeThickness,
          shadow: { offsetX: 0, offsetY: 0, color: '#000000', blur: 0, fill: false, stroke: false },
        });
        textObj.setColor(origColor);
        try { scene.tweens.killTweensOf(textObj); } catch {}
        textObj.setScale(origScale);
      } catch (e) {
        console.error('[KidsJuice] endHighlight error:', e);
      }
      KidsJuice.clearHighlights(scene);
      try { opts.onEnd?.(); } catch {}
    };

    const fallbackTimer = scene.time.delayedCall(estMs + 500, () => {
      if (scene[HIGHLIGHT_TARGETS]?.includes(textObj)) {
        endHighlight();
      }
    });
    scene[HIGHLIGHT_TIMERS]!.push(fallbackTimer);

    audioBus.speak(text, {
      ...opts,
      onStart: startHighlight,
      onEnd: endHighlight,
    });
  }

  static clearHighlights(scene: SceneWithKidsJuice) {
    const timers = scene[HIGHLIGHT_TIMERS];
    if (timers) {
      timers.forEach(t => { try { t.remove(); } catch {} });
      timers.length = 0;
    }
    const targets = scene[HIGHLIGHT_TARGETS];
    if (targets) targets.length = 0;
  }

  static randomPraise(): string {
    return PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
  }

  static randomCelebration(): string {
    return CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
  }

  static randomSticker(): string {
    return STICKER_EMOJIS[Math.floor(Math.random() * STICKER_EMOJIS.length)];
  }

  // ===========================================================================
  // CELEBRATE CORRECT — massive layered fanfare + confetti rain + "You got it!"
  // ===========================================================================
  // Audio cascade (7 layers, staggered 120ms):
  //   t=0ms → 'win' (523→1046 sweep)
  //   t=120ms → 'correct' @ 523Hz (C4)
  //   t=240ms → 'correct' @ 659Hz (E4)
  //   t=360ms → 'correct' @ 784Hz (G4)
  //   t=480ms → 'correct' @ 1046Hz (C5)
  //   t=600ms → 'streak' (880→1320 sparkle)
  //   t=750ms → 'pop' (final sparkle)
  //   t=300ms → spoken celebratory phrase
  // Visual: green flash + "🎉 YOU GOT IT! 🎉" popup + VFX explosion + confetti rain + glow rings
  // ===========================================================================
  static celebrateCorrect(
    scene: Phaser.Scene & { juice?: any; theme?: any; isFinished?: boolean },
    btn: Phaser.GameObjects.Container | { x: number; y: number }
  ) {
    try {
      const theme = scene.theme;
      const juice = scene.juice;
      if (!theme || !juice) return;
      const btnX = (btn as any).x ?? 0;
      const btnY = (btn as any).y ?? 0;

      // Visual: green flash + popup + explosion.
      juice.flash(theme.success, 0.4, 300);
      juice.scorePopup(scene.scale.width / 2, 200, '🎉 YOU GOT IT! 🎉', theme.warning);
      juice.burst(btnX, btnY, 'win');

      // Layered musical fanfare — C-E-G-C arpeggio + win sweep + streak sparkle + pop.
      audioBus.play('win');
      scene.time.delayedCall(120, () => { try { audioBus.play('correct', { freq: 523, duration: 0.25 }); } catch {} });
      scene.time.delayedCall(240, () => { try { audioBus.play('correct', { freq: 659, duration: 0.25 }); } catch {} });
      scene.time.delayedCall(360, () => { try { audioBus.play('correct', { freq: 784, duration: 0.25 }); } catch {} });
      scene.time.delayedCall(480, () => { try { audioBus.play('correct', { freq: 1046, duration: 0.3 }); } catch {} });
      scene.time.delayedCall(600, () => { try { audioBus.play('streak'); } catch {} });
      scene.time.delayedCall(750, () => { try { audioBus.play('pop'); } catch {} });

      // Spoken celebratory phrase.
      const phrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
      scene.time.delayedCall(300, () => {
        try { audioBus.speak(phrase, { pitch: 1.25, rate: 1.0 }); } catch {}
      });

      // VFX explosion + confetti rain.
      KidsJuice.vfxExplosion(scene, btnX, btnY);
      KidsJuice.confettiRain(scene);

      // Multiple glow rings on the correct button.
      for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(i * 150, () => {
          if ((scene as any).isFinished) return;
          try {
            const colorHex = HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length];
            const colorNum = parseInt(colorHex.slice(1), 16);
            juice.glowRing(btnX, btnY, colorNum, 60 + i * 30);
          } catch {}
        });
      }

      // Bouncing "🎉 YOU GOT IT! 🎉" text.
      const celebrateText = scene.add.text(scene.scale.width / 2, scene.scale.height / 2 - 50, '🎉 YOU GOT IT! 🎉', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '48px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }).setOrigin(0.5).setDepth(200).setScale(0);

      scene.tweens.add({
        targets: celebrateText,
        scale: { from: 0, to: 1.2 },
        duration: 400, ease: 'Back.out',
        onComplete: () => {
          scene.tweens.add({
            targets: celebrateText,
            scale: { from: 1.2, to: 1 },
            y: scene.scale.height / 2 - 80,
            duration: 300, ease: 'Quad.out',
            onComplete: () => {
              scene.time.delayedCall(1000, () => {
                scene.tweens.add({
                  targets: celebrateText,
                  alpha: 0, y: celebrateText.y - 30,
                  duration: 400, ease: 'Cubic.in',
                  onComplete: () => { try { celebrateText.destroy(); } catch {} },
                });
              });
            },
          });
        },
      });
    } catch (e) {
      console.error('[KidsJuice] celebrateCorrect error:', e);
    }
  }

  // ===========================================================================
  // VFX EXPLOSION — 50+ pooled confetti + expanding rings + floating stars
  // ===========================================================================
  static vfxExplosion(scene: Phaser.Scene & { juice?: any; isFinished?: boolean }, x: number, y: number) {
    try {
      const juice = scene.juice;
      if (!juice) return;

      for (let i = 0; i < 5; i++) {
        scene.time.delayedCall(i * 50, () => {
          if ((scene as any).isFinished) return;
          try {
            juice.burst(x, y, 'win');
            juice.burst(x + Phaser.Math.Between(-80, 80), y + Phaser.Math.Between(-80, 80), 'correct');
          } catch {}
        });
      }

      for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(i * 150, () => {
          if ((scene as any).isFinished) return;
          try { juice.glowRing(x, y, 0xffff00, 120 + i * 40); } catch {}
        });
      }

      for (let i = 0; i < 5; i++) {
        const star = scene.add.text(
          x + Phaser.Math.Between(-100, 100),
          y + Phaser.Math.Between(-50, 50),
          '⭐', { fontSize: '28px' }
        ).setOrigin(0.5).setDepth(60).setAlpha(0);
        scene.tweens.add({
          targets: star,
          y: star.y - 120,
          alpha: 0,
          scale: { from: 0.5, to: 1.5 },
          duration: 1500,
          delay: i * 100,
          ease: 'Back.out',
          onComplete: () => { try { star.destroy(); } catch {} },
        });
      }
    } catch (e) {
      console.error('[KidsJuice] vfxExplosion error:', e);
    }
  }

  // ===========================================================================
  // CONFETTI RAIN — drop 15 confetti emojis from the top across the screen.
  // ===========================================================================
  static confettiRain(scene: Phaser.Scene & { isFinished?: boolean }) {
    try {
      const count = 15;
      for (let i = 0; i < count; i++) {
        scene.time.delayedCall(i * 80, () => {
          if ((scene as any).isFinished) return;
          try {
            const x = Phaser.Math.Between(20, scene.scale.width - 20);
            const emoji = CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)];
            const piece = scene.add.text(x, -30, emoji, {
              fontFamily: 'Inter, sans-serif',
              fontSize: `${Phaser.Math.Between(24, 40)}px`,
            }).setOrigin(0.5).setDepth(150);

            const fallDuration = Phaser.Math.Between(1800, 2800);
            const drift = Phaser.Math.Between(-60, 60);
            const rotations = Phaser.Math.Between(2, 5);

            scene.tweens.add({
              targets: piece,
              y: scene.scale.height + 40,
              x: x + drift,
              angle: 360 * rotations,
              alpha: { from: 1, to: 0.8 },
              duration: fallDuration,
              ease: 'Cubic.in',
              onComplete: () => { try { piece.destroy(); } catch {} },
            });
          } catch {}
        });
      }
    } catch (e) {
      console.error('[KidsJuice] confettiRain error:', e);
    }
  }
}
