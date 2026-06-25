// LOD (Level of Detail) hardware detector.
// Runs once on boot. Phaser scenes query `getLod()` to decide
// whether to enable high-end particle blending, drop shadows,
// dynamic lighting, and ambient particle count.

export type LodTier = 'ultra' | 'high' | 'medium' | 'low';

export interface LodProfile {
  tier: LodTier;
  // Particle tuning
  particleMultiplier: number; // 0..1
  blendAdd: boolean; // additive blend is expensive on low-end GPUs
  shadow: boolean;
  dynamicLight: boolean;
  ambientParticles: number;
  maxFpsTarget: 60;
  motionBlur: boolean;
  // Mobile safe-area
  isMobile: boolean;
  // Memory budget (MB rough estimate)
  memBudget: number;
}

let cachedProfile: LodProfile | null = null;

export function detectLod(): LodProfile {
  if (cachedProfile) return cachedProfile;
  if (typeof window === 'undefined') {
    cachedProfile = {
      tier: 'high', particleMultiplier: 1, blendAdd: true, shadow: true,
      dynamicLight: true, ambientParticles: 30, maxFpsTarget: 60, motionBlur: true,
      isMobile: false, memBudget: 512,
    };
    return cachedProfile;
  }

  const nav = navigator as any;
  const ua = nav.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
  const isLowEndMobile = isMobile && /Android 7|Android 8|iPhone OS 1[0-4]/i.test(ua);

  // Hardware concurrency
  const cores = nav.hardwareConcurrency ?? 4;
  // Device memory (Chrome only)
  const deviceMem = (nav as any).deviceMemory ?? 4; // GB
  // Screen size
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pixels = w * h;

  // WebGL probe
  let glContextOK = true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) glContextOK = false;
  } catch {
    glContextOK = false;
  }

  let tier: LodTier;
  if (!glContextOK || isLowEndMobile || cores <= 2 || deviceMem <= 2) {
    tier = 'low';
  } else if (isMobile || cores <= 4 || deviceMem <= 4) {
    tier = 'medium';
  } else if (cores <= 8 && deviceMem <= 8 && pixels < 2_500_000) {
    tier = 'high';
  } else {
    tier = 'ultra';
  }

  const profiles: Record<LodTier, LodProfile> = {
    ultra: {
      tier: 'ultra', particleMultiplier: 1.4, blendAdd: true, shadow: true,
      dynamicLight: true, ambientParticles: 60, maxFpsTarget: 60, motionBlur: true,
      isMobile, memBudget: 1024,
    },
    high: {
      tier: 'high', particleMultiplier: 1.0, blendAdd: true, shadow: true,
      dynamicLight: true, ambientParticles: 35, maxFpsTarget: 60, motionBlur: true,
      isMobile, memBudget: 512,
    },
    medium: {
      tier: 'medium', particleMultiplier: 0.7, blendAdd: true, shadow: false,
      dynamicLight: false, ambientParticles: 18, maxFpsTarget: 60, motionBlur: false,
      isMobile, memBudget: 256,
    },
    low: {
      tier: 'low', particleMultiplier: 0.4, blendAdd: false, shadow: false,
      dynamicLight: false, ambientParticles: 6, maxFpsTarget: 30, motionBlur: false,
      isMobile, memBudget: 128,
    },
  };

  cachedProfile = profiles[tier];
  return cachedProfile;
}

export function getLod(): LodProfile {
  return cachedProfile ?? detectLod();
}
