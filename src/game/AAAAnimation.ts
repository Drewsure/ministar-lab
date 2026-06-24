// ============================================================================
// AAA Animation System — cutting-edge motion design
// ============================================================================
// Replaces basic tweens with spring physics, cinematic easing, particle
// trails, depth shifts, and screen-space effects.
// ============================================================================

import * as Phaser from 'phaser';

// ===========================================================================
// EASING PRESETS — AAA-quality curves (not just linear/quad)
// ===========================================================================

export const EASING = {
  // Spring physics (overshoot + settle)
  spring: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Bounce out (ball drop)
  bounceOut: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  // Elastic (rubber band)
  elasticOut: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  // Back out (slight overshoot)
  backOut: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Expo out (fast start, slow end — dramatic)
  expoOut: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  // Circ out (smooth deceleration)
  circOut: (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  // Sine in-out (gentle)
  sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// ===========================================================================
// PARTICLE TRAIL — follows a moving object leaving a glowing trail
// ===========================================================================

export class ParticleTrail {
  private scene: Phaser.Scene;
  private target: Phaser.GameObjects.GameObject;
  private particles: Phaser.GameObjects.Text[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private color: string;
  private active = false;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, color: string = '✨') {
    this.scene = scene;
    this.target = target;
    this.color = color;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.interval = setInterval(() => {
      if (!this.active) return;
      const obj = this.target as any;
      if (!obj.active) { this.stop(); return; }
      const trail = this.scene.add.text(obj.x, obj.y, this.color, { fontSize: '16px' })
        .setOrigin(0.5).setDepth(99).setAlpha(0.8);
      this.particles.push(trail);
      this.scene.tweens.add({
        targets: trail,
        alpha: 0, scale: 0.3,
        duration: 400,
        ease: 'Cubic.out',
        onComplete: () => trail.destroy(),
      });
    }, 50);
  }

  stop() {
    this.active = false;
    if (this.interval) clearInterval(this.interval);
  }
}

// ===========================================================================
// SCREEN SHAKE — AAA-quality camera shake with decay
// ===========================================================================

export function screenShake(scene: Phaser.Scene, intensity: 'light' | 'medium' | 'heavy' | 'extreme' = 'light') {
  const map = { light: 0.004, medium: 0.01, heavy: 0.025, extreme: 0.05 };
  const cam = scene.cameras.main;
  try {
    cam.shake(300, map[intensity]);
    // Add slight zoom punch for impact
    if (intensity === 'heavy' || intensity === 'extreme') {
      cam.zoomTo(1.02, 100, 'Quad.out');
      setTimeout(() => { try { cam.zoomTo(1, 150, 'Quad.in'); } catch {} }, 100);
    }
  } catch {}
}

// ===========================================================================
// DEPTH SHIFT — object appears to move toward/away from camera (Z-axis fake)
// ===========================================================================

export function depthShift(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  direction: 'forward' | 'backward' = 'forward',
  duration: number = 400
) {
  const scale = direction === 'forward' ? 1.15 : 0.9;
  const alpha = direction === 'forward' ? 1 : 0.7;
  try {
    scene.tweens.add({
      targets: target,
      scale, alpha,
      duration,
      ease: EASING.backOut as any,
      yoyo: true,
    });
  } catch {}
}

// ===========================================================================
// CINEMATIC ENTRY — object flies in from offscreen with spring + trail
// ===========================================================================

export function cinematicEntry(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & { x: number; y: number },
  from: 'left' | 'right' | 'top' | 'bottom' | 'center',
  finalX: number,
  finalY: number,
  duration: number = 600,
  delay: number = 0
) {
  const startX = from === 'left' ? -200 : from === 'right' ? scene.scale.width + 200 : finalX;
  const startY = from === 'top' ? -200 : from === 'bottom' ? scene.scale.height + 200 : finalY;

  (target as any).setPosition(startX, startY);
  (target as any).setAlpha(0);
  (target as any).setScale(0.3);

  try {
    scene.tweens.add({
      targets: target,
      x: finalX, y: finalY,
      alpha: 1, scale: 1,
      duration, delay,
      ease: EASING.spring as any,
      onComplete: () => {
        // Small bounce settle
        scene.tweens.add({
          targets: target,
          scale: { from: 1.1, to: 1 },
          duration: 200,
          ease: EASING.bounceOut as any,
        });
      },
    });
  } catch {}
}

// ===========================================================================
// PULSE GLOW — object pulses with a glowing aura (infinite)
// ===========================================================================

export function pulseGlow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  color: number = 0xfbbf24,
  intensity: number = 1
) {
  try {
    // Create glow aura behind target
    const obj = target as any;
    const glow = scene.add.circle(obj.x, obj.y, 40, color, 0.3)
      .setDepth(obj.depth - 1).setBlendMode(Phaser.BlendModes.ADD);

    scene.tweens.add({
      targets: glow,
      scale: { from: 0.8, to: 1.3 * intensity },
      alpha: { from: 0.2, to: 0.5 * intensity },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: EASING.sineInOut as any,
    });

    // Keep glow following target
    scene.events.on('update', () => {
      if (!glow.active) return;
      glow.x = obj.x;
      glow.y = obj.y;
    });

    return glow;
  } catch { return null; }
}

// ===========================================================================
// SHIMMER — text shimmers with a light sweep (like AAA game UI)
// ===========================================================================

export function shimmer(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Text,
  color: number = 0xffffff
) {
  try {
    const shimmerText = scene.add.text(target.x, target.y, target.text, {
      ...target.style,
      color: '#' + color.toString(16).padStart(6, '0'),
    })
      .setOrigin(target.originX, target.originY)
      .setDepth(target.depth + 1)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Sweep across
    scene.tweens.add({
      targets: shimmerText,
      alpha: { from: 0, to: 0.6, to: 0 },
      duration: 1500,
      repeat: -1,
      repeatDelay: 2000,
      ease: EASING.sineInOut as any,
    });

    return shimmerText;
  } catch { return null; }
}

// ===========================================================================
// CONFETTI BURST — AAA celebration with multi-colored particles
// ===========================================================================

export function confettiBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number = 30,
  colors?: number[]
) {
  const palette = colors ?? [0xfbbf24, 0xa855f7, 0xec4899, 0x22d3ee, 0x22c55e];
  try {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 100 + Math.random() * 200;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const size = 4 + Math.random() * 6;

      const particle = scene.add.rectangle(x, y, size, size, color, 1)
        .setDepth(9999).setRotation(Math.random() * Math.PI);

      scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed * 2,
        y: y + Math.sin(angle) * speed * 2 + 200, // gravity
        alpha: 0,
        rotation: Math.random() * Math.PI * 4,
        scale: 0,
        duration: 800 + Math.random() * 400,
        ease: EASING.circOut as any,
        onComplete: () => particle.destroy(),
      });
    }
  } catch {}
}

// ===========================================================================
// SCREEN WIPE — cinematic transition between screens
// ===========================================================================

export function screenWipe(
  scene: Phaser.Scene,
  direction: 'left' | 'right' | 'up' | 'down' = 'left',
  color: number = 0x000000,
  duration: number = 400,
  onComplete?: () => void
) {
  try {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const wipe = scene.add.rectangle(
      direction === 'right' ? -w : direction === 'left' ? w : w / 2,
      direction === 'down' ? -h : direction === 'up' ? h : h / 2,
      w, h, color, 1
    ).setDepth(99999);

    scene.tweens.add({
      targets: wipe,
      x: w / 2, y: h / 2,
      duration: duration / 2,
      ease: EASING.expoOut as any,
      onComplete: () => {
        if (onComplete) onComplete();
        scene.tweens.add({
          targets: wipe,
          x: direction === 'right' ? w + w : direction === 'left' ? -w : w / 2,
          y: direction === 'down' ? h + h : direction === 'up' ? -h : h / 2,
          duration: duration / 2,
          ease: EASING.expoOut as any,
          onComplete: () => wipe.destroy(),
        });
      },
    });
  } catch {}
}

// ===========================================================================
// FLOATING TEXT — text floats up + fades (for score popups, Star Dust)
// ===========================================================================

export function floatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = '#fbbf24',
  fontSize: number = 24,
  duration: number = 800
) {
  try {
    const txt = scene.add.text(x, y, text, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
      .setOrigin(0.5)
      .setDepth(9998)
      .setScale(0.3)
      .setAlpha(0);

    scene.tweens.add({
      targets: txt,
      y: y - 80,
      alpha: { from: 0, to: 1, to: 0 },
      scale: { from: 0.3, to: 1.3, to: 1 },
      duration,
      ease: EASING.backOut as any,
      onComplete: () => txt.destroy(),
    });
  } catch {}
}

// ===========================================================================
// LIGHT RAY — rays emanating from a point (for dramatic reveals)
// ===========================================================================

export function lightRays(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = 0xfbbf24,
  rayCount: number = 8,
  duration: number = 800
) {
  try {
    for (let i = 0; i < rayCount; i++) {
      const angle = (Math.PI * 2 * i) / rayCount;
      const ray = scene.add.rectangle(x, y, 4, 300, color, 0.6)
        .setOrigin(0.5, 0)
        .setRotation(angle)
        .setDepth(9996)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: ray,
        alpha: { from: 0, to: 0.6, to: 0 },
        scaleY: { from: 0.3, to: 1.5 },
        duration,
        ease: EASING.expoOut as any,
        onComplete: () => ray.destroy(),
      });
    }
  } catch {}
}

// ===========================================================================
// RIPPLE — expanding circle ring (for tap feedback)
// ===========================================================================

export function ripple(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = 0xffffff,
  maxRadius: number = 60
) {
  try {
    const ring = scene.add.circle(x, y, 8, color, 0)
      .setStrokeStyle(3, color, 0.8)
      .setDepth(9997);

    scene.tweens.add({
      targets: ring,
      radius: maxRadius,
      alpha: { from: 0.8, to: 0 },
      duration: 500,
      ease: EASING.circOut as any,
      onUpdate: (_, target) => {
        const c = target as Phaser.GameObjects.Arc;
        try { c.setRadius((c as any).radius); } catch {}
      },
      onComplete: () => ring.destroy(),
    });
  } catch {}
}
