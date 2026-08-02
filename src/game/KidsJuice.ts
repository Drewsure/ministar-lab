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
}
