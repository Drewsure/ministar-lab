import * as Phaser from 'phaser';
import type { ThemeManifest } from '../lib/types';
import { getLod } from '../lib/lod';
import { audioBus } from '../lib/audio';

// ============================================================================
// ThemeAtlas — Procedural Texture Atlas Generator
// Generates all sprite textures at boot using Phaser Graphics → generateTexture.
// In production this is replaced by loading WebP/AVIF atlases + JSON coords;
// here it provides the same single-image-sourced rendering pipeline.
// ============================================================================

export class ThemeAtlas {
  static build(scene: Phaser.Scene, theme: ThemeManifest) {
    const tag = 'atlas-' + theme.id;
    // Cache check: only build once per theme per scene lifecycle
    if (scene.textures.exists('particle-' + theme.id) &&
        scene.textures.exists('player-' + theme.id) &&
        scene.textures.exists('mascot-clouddog-' + theme.id)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Particle dot
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('particle-' + theme.id, 4, 4);
    g.clear();

    // 2. Particle streak
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 16, 3);
    g.generateTexture('streak-' + theme.id, 16, 3);
    g.clear();

    // 3. Player ship (AAA 2029 — proper spaceship with engine glow)
    g.clear();
    // Engine glow (back layer)
    g.fillStyle(theme.accent, 0.4);
    g.fillCircle(16, 26, 8);
    g.fillStyle(theme.warning, 0.6);
    g.fillCircle(16, 26, 5);
    // Main hull
    g.fillStyle(theme.accent, 1);
    g.beginPath();
    g.moveTo(16, 0); g.lineTo(28, 24); g.lineTo(20, 20); g.lineTo(12, 20); g.lineTo(4, 24); g.closePath();
    g.fillPath();
    // Cockpit
    g.fillStyle(theme.accent2, 1);
    g.fillCircle(16, 14, 5);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(15, 12, 2);
    // Wing accents
    g.fillStyle(theme.accent2, 0.8);
    g.fillRect(2, 22, 6, 3);
    g.fillRect(24, 22, 6, 3);
    g.generateTexture('player-' + theme.id, 32, 32);
    g.clear();

    // 4. Card back
    g.fillStyle(theme.card, 1);
    g.fillRoundedRect(0, 0, 80, 100, 12);
    g.lineStyle(2, theme.accent, 0.6);
    g.strokeRoundedRect(2, 2, 76, 96, 10);
    g.fillStyle(theme.accent2, 0.5);
    g.fillRoundedRect(8, 8, 64, 12, 6);
    g.generateTexture('card-back-' + theme.id, 80, 100);
    g.clear();

    // 5. Card front
    g.fillStyle(theme.cardAlt, 1);
    g.fillRoundedRect(0, 0, 80, 100, 12);
    g.lineStyle(2, theme.accent, 1);
    g.strokeRoundedRect(2, 2, 76, 96, 10);
    g.generateTexture('card-front-' + theme.id, 80, 100);
    g.clear();

    // 6. Balloon
    g.fillStyle(theme.accent, 1);
    g.fillCircle(20, 22, 18);
    g.fillStyle(theme.accent2, 0.7);
    g.fillCircle(14, 16, 6);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(15, 14, 3);
    g.fillStyle(theme.text, 1);
    g.fillRect(19, 40, 2, 8);
    g.generateTexture('balloon-' + theme.id, 40, 50);
    g.clear();

    // 7. Mole hill
    g.fillStyle(0x4b2e1a, 1);
    g.fillEllipse(24, 28, 40, 18);
    g.fillStyle(0x6b3e22, 1);
    g.fillEllipse(24, 24, 32, 14);
    g.fillStyle(0x2c1810, 1);
    g.fillEllipse(24, 22, 18, 8);
    g.generateTexture('mole-hill-' + theme.id, 48, 40);
    g.clear();

    // 8. Mole
    g.fillStyle(0x8b5a2b, 1);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xffd6a0, 1);
    g.fillCircle(16, 20, 10);
    g.fillStyle(0x000000, 1);
    g.fillCircle(11, 12, 2);
    g.fillCircle(21, 12, 2);
    g.fillStyle(0xff8da1, 1);
    g.fillCircle(16, 22, 2);
    g.generateTexture('mole-' + theme.id, 32, 32);
    g.clear();

    // 9. AAA 2029 — Rich illustrated background per theme
    const W = 800, H = 600;
    ThemeAtlas.drawIllustratedBackground(g, theme, W, H);
    g.generateTexture('bg-' + theme.id, W, H);
    g.clear();

    // 10. Star field / ambient texture (theme-specific)
    ThemeAtlas.drawAmbientTexture(g, theme);
    g.generateTexture('starfield-' + theme.id, 200, 200);
    g.clear();

    // 11. Mascot cloudDog
    g.fillStyle(0xffffff, 1);
    g.fillCircle(24, 22, 18);
    g.fillStyle(0xe0e7ff, 1);
    g.fillEllipse(24, 32, 28, 10);
    g.fillStyle(0x000000, 1);
    g.fillCircle(18, 18, 2.5);
    g.fillCircle(30, 18, 2.5);
    g.fillStyle(0x000000, 1);
    g.fillRect(22, 26, 4, 1.5);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(20, 34, 8, 2);
    g.generateTexture('mascot-clouddog-' + theme.id, 48, 48);
    g.clear();

    // 12. Mascot starKid
    g.fillStyle(theme.accent2, 1);
    g.beginPath();
    const cx = 24, cy = 24, R = 18, r = 8;
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(20, 22, 3);
    g.fillCircle(28, 22, 3);
    g.fillStyle(0x000000, 1);
    g.fillCircle(20, 22, 1.5);
    g.fillCircle(28, 22, 1.5);
    g.fillStyle(0x000000, 1);
    g.fillRect(22, 28, 4, 1.5);
    g.generateTexture('mascot-starkid-' + theme.id, 48, 48);
    g.clear();

    // Mark tag for debugging
    void tag;
  }

  // ===========================================================================
  // AAA 2029 — ILLUSTRATED BACKGROUNDS
  // Each theme gets a unique scene: stars+moon+planets, jungle trees+vines,
  // festival lanterns+confetti, city neon+buildings, etc.
  // ===========================================================================
  static drawIllustratedBackground(
    g: Phaser.GameObjects.Graphics,
    theme: ThemeManifest,
    W: number, H: number
  ) {
    // 1. Gradient base
    for (let y = 0; y < H; y += 4) {
      const t = y / H;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(theme.bgGradientTop),
        Phaser.Display.Color.IntegerToColor(theme.bgGradientBottom),
        100,
        Math.round(t * 100)
      );
      const int = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      g.fillStyle(int, 1);
      g.fillRect(0, y, W, 4);
    }

    // 2. Theme-specific scene elements
    switch (theme.id) {
      case 'space':       this.drawSpaceScene(g, W, H); break;
      case 'jungle':      this.drawJungleScene(g, W, H); break;
      case 'festival':    this.drawFestivalScene(g, W, H); break;
      case 'cityscape':   this.drawCityScene(g, W, H); break;
      case 'ocean':       this.drawOceanScene(g, W, H); break;
      case 'candy':       this.drawCandyScene(g, W, H); break;
      case 'haunted':     this.drawHauntedScene(g, W, H); break;
      case 'sports':      this.drawSportsScene(g, W, H); break;
      case 'christmas':   this.drawChristmasScene(g, W, H); break;
      case 'easter':      this.drawEasterScene(g, W, H); break;
    }

    // 3. Vignette (darker corners for cinematic feel)
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, 0, W, 80);  // top dark band
    g.fillStyle(0x000000, 0.2);
    g.fillRect(0, H - 80, W, 80); // bottom dark band
  }

  // ---- SPACE: stars, moon, planets, nebula ----
  private static drawSpaceScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Nebula clouds (purple/blue blobs)
    g.fillStyle(0x6d28d9, 0.15);
    g.fillCircle(150, 200, 120);
    g.fillStyle(0x2563eb, 0.12);
    g.fillCircle(650, 350, 100);
    g.fillStyle(0x9333ea, 0.1);
    g.fillCircle(400, 500, 150);

    // Stars (varied sizes)
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.8 + 0.3;
      g.fillStyle(0xffffff, Math.random() * 0.8 + 0.2);
      g.fillCircle(x, y, r);
    }
    // A few bigger sparkle stars (4-point cross)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.6;
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(x - 0.5, y - 4, 1, 8);
      g.fillRect(x - 4, y - 0.5, 8, 1);
    }

    // Moon (top-right)
    g.fillStyle(0xfef3c7, 0.95);
    g.fillCircle(W - 100, 100, 38);
    g.fillStyle(0xfde68a, 0.6);
    g.fillCircle(W - 100, 100, 42);
    // Moon craters
    g.fillStyle(0xfbbf24, 0.4);
    g.fillCircle(W - 110, 90, 6);
    g.fillCircle(W - 90, 110, 4);
    g.fillCircle(W - 100, 115, 3);

    // Saturn-like planet (bottom-left)
    g.fillStyle(0xfb923c, 0.7);
    g.fillCircle(100, H - 100, 28);
    // Ring
    g.lineStyle(3, 0xfde047, 0.5);
    g.strokeEllipse(100, H - 100, 80, 16);
    g.lineStyle(1, 0xfde047, 0.3);
    g.strokeEllipse(100, H - 100, 90, 20);
  }

  // ---- JUNGLE: trees, vines, leaves, sun rays ----
  private static drawJungleScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Sun rays from top
    g.fillStyle(0xfde047, 0.08);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI;
      g.fillRect(W / 2 + Math.cos(angle) * 50, 0, 4, H);
    }

    // Distant misty mountains
    g.fillStyle(0x166534, 0.3);
    g.fillTriangle(0, H - 150, 200, H - 280, 400, H - 150);
    g.fillTriangle(300, H - 150, 500, H - 320, 700, H - 150);
    g.fillTriangle(600, H - 150, 800, H - 260, 800, H - 150);

    // Big jungle trees (silhouettes)
    g.fillStyle(0x052e16, 0.8);
    for (let i = 0; i < 5; i++) {
      const x = i * 200 + 50;
      const trunkH = 180 + Math.random() * 60;
      // Trunk
      g.fillRect(x - 8, H - trunkH, 16, trunkH);
      // Canopy (layered circles)
      g.fillCircle(x, H - trunkH, 50);
      g.fillCircle(x - 30, H - trunkH + 10, 35);
      g.fillCircle(x + 30, H - trunkH + 10, 35);
      g.fillCircle(x, H - trunkH - 30, 40);
    }

    // Hanging vines
    g.lineStyle(2, 0x15803d, 0.6);
    for (let i = 0; i < 8; i++) {
      const x = i * 100 + 30;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 5, 60);
      g.lineTo(x - 3, 120);
      g.lineTo(x + 2, 180);
      g.strokePath();
      // Leaf at end
      g.fillStyle(0x22c55e, 0.7);
      g.fillEllipse(x + 2, 180, 8, 16);
    }

    // Floating leaves
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      g.fillStyle(0x84cc16, Math.random() * 0.4 + 0.2);
      g.fillEllipse(x, y, 10, 5);
    }
  }

  // ---- FESTIVAL: lanterns, bunting, confetti, stage ----
  private static drawFestivalScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Stage backdrop (warm gradient glow)
    g.fillStyle(0xfbbf24, 0.1);
    g.fillCircle(W / 2, H / 2, 300);

    // Bunting (string of flags across the top)
    g.lineStyle(2, 0xfbbf24, 0.6);
    g.beginPath();
    g.moveTo(0, 50);
    for (let x = 0; x <= W; x += 20) {
      g.lineTo(x, 50 + Math.sin(x / 40) * 20);
    }
    g.strokePath();
    // Flags
    const flagColors = [0xfb7185, 0xfbbf24, 0xc026d3, 0x34d399, 0x60a5fa];
    for (let i = 0; i < 16; i++) {
      const x = i * 50 + 25;
      const y = 50 + Math.sin(x / 40) * 20;
      const c = flagColors[i % flagColors.length];
      g.fillStyle(c, 0.85);
      g.fillTriangle(x - 8, y, x + 8, y, x, y + 18);
    }

    // Hanging lanterns (left and right)
    [80, W - 80].forEach((x, idx) => {
      // String
      g.lineStyle(1, 0xfde047, 0.5);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 60);
      g.strokePath();
      // Lantern body
      g.fillStyle(0xfb7185, 0.9);
      g.fillEllipse(x, 90, 36, 44);
      g.fillStyle(0xfda4af, 0.6);
      g.fillEllipse(x - 6, 80, 12, 16);
      // Top cap
      g.fillStyle(0xfbbf24, 0.9);
      g.fillRect(x - 12, 68, 24, 6);
      // Tassel
      g.fillStyle(0xfde047, 0.7);
      g.fillRect(x - 1, 112, 2, 12);
      void idx;
    });

    // Confetti scattered
    const confColors = [0xfbbf24, 0xfb7185, 0xc026d3, 0x34d399, 0x60a5fa, 0xfde047];
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const c = confColors[i % confColors.length];
      g.fillStyle(c, Math.random() * 0.6 + 0.3);
      g.fillRect(x, y, 4, 6);
    }

    // Stage floor
    g.fillStyle(0x4c1d95, 0.5);
    g.fillRect(0, H - 60, W, 60);
    g.fillStyle(0xfbbf24, 0.3);
    g.fillRect(0, H - 60, W, 3);
  }

  // ---- CITYSCAPE: neon buildings, grid, searchlights ----
  private static drawCityScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Distant buildings (dark silhouettes with windows)
    g.fillStyle(0x020617, 0.9);
    for (let i = 0; i < 12; i++) {
      const x = i * 70;
      const h = 100 + Math.random() * 180;
      g.fillRect(x, H - h, 65, h);
      // Windows (lit)
      for (let wy = H - h + 10; wy < H - 20; wy += 15) {
        for (let wx = x + 8; wx < x + 60; wx += 12) {
          if (Math.random() > 0.4) {
            g.fillStyle(Math.random() > 0.5 ? 0xfde047 : 0x22d3ee, Math.random() * 0.7 + 0.2);
            g.fillRect(wx, wy, 6, 8);
          }
        }
      }
      g.fillStyle(0x020617, 0.9);
    }

    // Neon grid floor (perspective lines)
    g.lineStyle(1, 0x22d3ee, 0.4);
    for (let i = 0; i < 10; i++) {
      const y = H - 60 + i * 8;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.strokePath();
    }
    // Vertical perspective lines
    for (let i = 0; i < 20; i++) {
      const x = (i / 19) * W;
      g.beginPath();
      g.moveTo(x, H - 60);
      g.lineTo(W / 2 + (x - W / 2) * 3, H);
      g.strokePath();
    }

    // Searchlight beams
    g.fillStyle(0xf472b6, 0.08);
    g.beginPath();
    g.moveTo(150, H - 60);
    g.lineTo(300, 0);
    g.lineTo(320, 0);
    g.lineTo(180, H - 60);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x22d3ee, 0.08);
    g.beginPath();
    g.moveTo(W - 150, H - 60);
    g.lineTo(W - 300, 0);
    g.lineTo(W - 320, 0);
    g.lineTo(W - 180, H - 60);
    g.closePath();
    g.fillPath();

    // Stars
    for (let i = 0; i < 30; i++) {
      g.fillStyle(0xffffff, Math.random() * 0.5 + 0.2);
      g.fillCircle(Math.random() * W, Math.random() * 200, 1);
    }
  }

  // ---- OCEAN: water gradient, bubbles, coral, light rays ----
  private static drawOceanScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Light rays from above
    g.fillStyle(0x90e0ef, 0.08);
    for (let i = 0; i < 5; i++) {
      const x = i * 160 + 50;
      g.beginPath();
      g.moveTo(x - 20, 0);
      g.lineTo(x + 20, 0);
      g.lineTo(x + 60, H);
      g.lineTo(x - 60, H);
      g.closePath();
      g.fillPath();
    }

    // Water surface shimmer
    g.fillStyle(0x90e0ef, 0.3);
    for (let x = 0; x < W; x += 30) {
      g.fillEllipse(x, 30, 24, 8);
    }

    // Bubbles rising
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 4 + 2;
      g.fillStyle(0xeaf6ff, Math.random() * 0.4 + 0.2);
      g.fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.3);
    }

    // Coral reef at bottom
    g.fillStyle(0xff6b6b, 0.7);
    for (let i = 0; i < 5; i++) {
      const x = i * 180 + 80;
      // Coral branches
      g.fillRect(x - 4, H - 80, 8, 80);
      g.fillCircle(x, H - 80, 12);
      g.fillCircle(x - 10, H - 100, 8);
      g.fillCircle(x + 10, H - 110, 9);
      g.fillCircle(x, H - 120, 7);
    }
    // Seaweed
    g.lineStyle(3, 0x2dd4bf, 0.6);
    for (let i = 0; i < 8; i++) {
      const x = i * 100 + 40;
      g.beginPath();
      g.moveTo(x, H);
      for (let y = H; y > H - 100; y -= 10) {
        g.lineTo(x + Math.sin(y / 20) * 8, y);
      }
      g.strokePath();
    }
  }

  // ---- CANDY: lollipop trees, gumdrops, sprinkles ----
  private static drawCandyScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Soft pink glow
    g.fillStyle(0xf472b6, 0.1);
    g.fillCircle(W / 2, H / 2, 350);

    // Lollipop trees
    for (let i = 0; i < 4; i++) {
      const x = i * 220 + 100;
      const y = H - 80;
      // Trunk (chocolate)
      g.fillStyle(0x92400e, 0.9);
      g.fillRect(x - 6, y - 60, 12, 60);
      // Lollipop top (spiral)
      g.fillStyle(0xfbbf24, 0.95);
      g.fillCircle(x, y - 70, 28);
      g.fillStyle(0xec4899, 0.9);
      g.fillCircle(x, y - 70, 22);
      g.fillStyle(0xfbbf24, 0.9);
      g.fillCircle(x, y - 70, 16);
      g.fillStyle(0xec4899, 0.9);
      g.fillCircle(x, y - 70, 10);
      // Stick
      g.fillStyle(0xfde047, 0.8);
      g.fillRect(x - 1, y - 70, 2, 30);
    }

    // Gumdrops on ground
    const gumColors = [0xa78bfa, 0x4ade80, 0xfb7185, 0xfde047, 0x60a5fa];
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * W;
      const y = H - 30 - Math.random() * 20;
      const c = gumColors[i % gumColors.length];
      g.fillStyle(c, 0.85);
      g.fillEllipse(x, y, 20, 14);
      g.fillStyle(0xffffff, 0.4);
      g.fillEllipse(x - 4, y - 3, 6, 4);
    }

    // Floating sprinkles
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * W;
      const y = Math.random() * (H - 100);
      const c = gumColors[i % gumColors.length];
      g.fillStyle(c, Math.random() * 0.6 + 0.3);
      g.fillRect(x, y, 6, 2);
    }
  }

  // ---- HAUNTED: moon, bats, tombstones, fog ----
  private static drawHauntedScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Eerie green glow
    g.fillStyle(0x84cc16, 0.08);
    g.fillCircle(W / 2, H / 2, 320);

    // Full moon (yellow-green)
    g.fillStyle(0xfacc15, 0.8);
    g.fillCircle(W - 120, 120, 50);
    g.fillStyle(0xa3e635, 0.4);
    g.fillCircle(W - 120, 120, 55);
    // Moon craters
    g.fillStyle(0x65a30d, 0.4);
    g.fillCircle(W - 130, 110, 8);
    g.fillCircle(W - 105, 130, 6);

    // Stars
    for (let i = 0; i < 50; i++) {
      g.fillStyle(0xe2e8f0, Math.random() * 0.6 + 0.2);
      g.fillCircle(Math.random() * W, Math.random() * 200, 1);
    }

    // Bats (silhouettes)
    g.fillStyle(0x000000, 0.7);
    for (let i = 0; i < 6; i++) {
      const x = 100 + i * 130 + Math.random() * 40;
      const y = 80 + Math.random() * 120;
      // Bat body + wings
      g.fillCircle(x, y, 4);
      g.fillTriangle(x - 4, y, x - 14, y - 6, x - 10, y + 2);
      g.fillTriangle(x + 4, y, x + 14, y - 6, x + 10, y + 2);
    }

    // Dead trees
    g.fillStyle(0x000000, 0.8);
    for (let i = 0; i < 3; i++) {
      const x = i * 300 + 80;
      // Trunk
      g.fillRect(x - 8, H - 200, 16, 200);
      // Bare branches
      g.fillRect(x - 8, H - 200, 30, 4);
      g.fillRect(x - 30, H - 210, 4, 20);
      g.fillRect(x - 20, H - 180, 4, 15);
      g.fillRect(x + 8, H - 220, 30, 4);
      g.fillRect(x + 30, H - 230, 4, 20);
      g.fillRect(x + 18, H - 200, 4, 15);
    }

    // Tombstones
    g.fillStyle(0x475569, 0.7);
    for (let i = 0; i < 4; i++) {
      const x = i * 200 + 100;
      const y = H - 50;
      g.fillRoundedRect(x - 24, y - 50, 48, 50, 8);
      // Cross
      g.fillStyle(0x1e293b, 0.6);
      g.fillRect(x - 2, y - 40, 4, 30);
      g.fillRect(x - 8, y - 30, 16, 4);
    }

    // Fog at bottom
    g.fillStyle(0xe2e8f0, 0.1);
    g.fillRect(0, H - 80, W, 80);
  }

  // ---- SPORTS: stadium, field lines, scoreboard ----
  private static drawSportsScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Stadium gradient (sky to field)
    g.fillStyle(0x0c1a0c, 0.5);
    g.fillRect(0, H - 200, W, 200);

    // Field stripes (mowed grass pattern)
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 === 0 ? 0x15803d : 0x166534, 0.4);
      g.fillRect(i * (W / 8), H - 200, W / 8, 200);
    }

    // Field lines
    g.lineStyle(3, 0xf0fdf4, 0.7);
    g.strokeRect(20, H - 180, W - 40, 160);
    g.beginPath();
    g.moveTo(W / 2, H - 180);
    g.lineTo(W / 2, H - 20);
    g.strokePath();
    g.strokeCircle(W / 2, H - 100, 50);
    g.strokeRect(20, H - 140, 80, 80);
    g.strokeRect(W - 100, H - 140, 80, 80);

    // Stadium stands (top half)
    g.fillStyle(0x052e16, 0.6);
    g.fillRect(0, 0, W, H - 200);
    // Crowd dots
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * W;
      const y = Math.random() * (H - 220);
      const colors = [0xfbbf24, 0xf97316, 0xef4444, 0x3b82f6, 0xe2e8f0];
      g.fillStyle(colors[i % colors.length], Math.random() * 0.5 + 0.3);
      g.fillCircle(x, y, 2);
    }

    // Floodlights
    g.fillStyle(0xfef3c7, 0.9);
    g.fillCircle(80, 40, 12);
    g.fillCircle(W - 80, 40, 12);
    g.fillStyle(0xfef3c7, 0.08);
    g.beginPath();
    g.moveTo(80, 40); g.lineTo(0, H - 200); g.lineTo(200, H - 200); g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(W - 80, 40); g.lineTo(W, H - 200); g.lineTo(W - 200, H - 200); g.closePath();
    g.fillPath();

    // Scoreboard banner
    g.fillStyle(0x000000, 0.7);
    g.fillRect(W / 2 - 80, 20, 160, 30);
    g.fillStyle(0xfbbf24, 0.9);
    g.fillRect(W / 2 - 80, 20, 160, 2);
    g.fillRect(W / 2 - 80, 48, 160, 2);
  }

  // ---- CHRISTMAS: snowy night, tree, presents, snowflakes ----
  private static drawChristmasScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Snow on ground
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(0, H - 60, W, 60);
    // Snow mounds
    for (let i = 0; i < 6; i++) {
      g.fillEllipse(i * 150 + 50, H - 50, 120, 30);
    }

    // Snowflakes (falling)
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      g.fillStyle(0xffffff, Math.random() * 0.7 + 0.3);
      g.fillCircle(x, y, Math.random() * 2 + 1);
    }

    // Christmas tree (center)
    const treeX = W / 2;
    const treeY = H - 80;
    // Tree layers (triangles)
    g.fillStyle(0x166534, 1);
    g.fillTriangle(treeX - 50, treeY - 40, treeX + 50, treeY - 40, treeX, treeY - 100);
    g.fillTriangle(treeX - 60, treeY - 80, treeX + 60, treeY - 80, treeX, treeY - 140);
    g.fillTriangle(treeX - 70, treeY - 120, treeX + 70, treeY - 120, treeX, treeY - 180);
    // Trunk
    g.fillStyle(0x92400e, 1);
    g.fillRect(treeX - 10, treeY - 40, 20, 40);
    // Star on top
    g.fillStyle(0xfde047, 1);
    g.fillCircle(treeX, treeY - 180, 10);
    // Ornaments
    const ornamentColors = [0xdc2626, 0xfbbf24, 0x3b82f6, 0xffffff];
    for (let i = 0; i < 12; i++) {
      g.fillStyle(ornamentColors[i % 4], 1);
      g.fillCircle(treeX + (Math.random() - 0.5) * 120, treeY - 60 - Math.random() * 120, 4);
    }

    // Presents under tree
    g.fillStyle(0xdc2626, 0.9);
    g.fillRect(treeX - 80, treeY - 25, 30, 25);
    g.fillStyle(0x22c55e, 0.9);
    g.fillRect(treeX + 50, treeY - 30, 35, 30);
    g.fillStyle(0x3b82f6, 0.9);
    g.fillRect(treeX - 40, treeY - 20, 25, 20);
    // Ribbons
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(treeX - 80, treeY - 15, 30, 3);
    g.fillRect(treeX + 50, treeY - 20, 35, 3);

    // String lights across top
    g.lineStyle(1, 0xfbbf24, 0.5);
    g.beginPath();
    g.moveTo(0, 60);
    for (let x = 0; x <= W; x += 30) {
      g.lineTo(x, 60 + Math.sin(x / 30) * 15);
    }
    g.strokePath();
    // Light bulbs
    for (let i = 0; i < 25; i++) {
      const x = i * 32 + 10;
      const y = 60 + Math.sin(x / 30) * 15;
      g.fillStyle([0xdc2626, 0x22c55e, 0xfbbf24, 0x3b82f6][i % 4], 1);
      g.fillCircle(x, y, 3);
    }
  }

  // ---- EASTER: garden, flowers, eggs, bunny ----
  private static drawEasterScene(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // Grass ground
    g.fillStyle(0x4ade80, 0.4);
    g.fillRect(0, H - 80, W, 80);
    // Grass blades
    for (let i = 0; i < 50; i++) {
      g.fillStyle(0x22c55e, 0.6);
      g.fillRect(i * 16 + Math.random() * 8, H - 30 - Math.random() * 10, 2, 8);
    }

    // Flowers
    const flowerColors = [0xf472b6, 0xfde047, 0xa78bfa, 0xfb7185, 0x60a5fa];
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * W;
      const y = H - 50 - Math.random() * 30;
      const c = flowerColors[i % flowerColors.length];
      // Petals
      g.fillStyle(c, 0.9);
      g.fillCircle(x - 4, y, 4);
      g.fillCircle(x + 4, y, 4);
      g.fillCircle(x, y - 4, 4);
      g.fillCircle(x, y + 4, 4);
      // Center
      g.fillStyle(0xfde047, 1);
      g.fillCircle(x, y, 3);
    }

    // Easter eggs (hidden in grass)
    const eggColors = [0xf472b6, 0x4ade80, 0xfde047, 0xa78bfa, 0x60a5fa];
    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 90 + Math.random() * 20;
      const y = H - 35;
      const c = eggColors[i % eggColors.length];
      // Egg body
      g.fillStyle(c, 0.95);
      g.fillEllipse(x, y, 18, 24);
      // Stripes
      g.fillStyle(0xffffff, 0.6);
      g.fillRect(x - 9, y - 4, 18, 2);
      g.fillRect(x - 8, y + 4, 16, 2);
      // Highlight
      g.fillStyle(0xffffff, 0.5);
      g.fillEllipse(x - 4, y - 6, 4, 6);
    }

    // Bunny (right side)
    const bx = W - 100, by = H - 90;
    // Body
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(bx, by, 40, 30);
    // Head
    g.fillCircle(bx, by - 25, 16);
    // Ears
    g.fillEllipse(bx - 8, by - 45, 8, 22);
    g.fillEllipse(bx + 8, by - 45, 8, 22);
    g.fillStyle(0xfbcfe8, 0.8);
    g.fillEllipse(bx - 8, by - 45, 4, 16);
    g.fillEllipse(bx + 8, by - 45, 4, 16);
    // Eye
    g.fillStyle(0x000000, 1);
    g.fillCircle(bx + 4, by - 27, 2);
    // Nose
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(bx + 8, by - 22, 2);

    // Sun
    g.fillStyle(0xfde047, 0.4);
    g.fillCircle(100, 100, 40);
    g.fillStyle(0xfde047, 0.2);
    g.fillCircle(100, 100, 55);
  }

  // ===========================================================================
  // AMBIENT TEXTURE — for parallax overlay (theme-specific particles)
  // ===========================================================================
  static drawAmbientTexture(g: Phaser.GameObjects.Graphics, theme: ThemeManifest) {
    g.clear();
    switch (theme.id) {
      case 'space':
      case 'haunted':
        // Stars
        for (let i = 0; i < 40; i++) {
          g.fillStyle(0xffffff, Math.random() * 0.7 + 0.2);
          g.fillCircle(Math.random() * 200, Math.random() * 200, Math.random() * 1.5 + 0.3);
        }
        break;
      case 'jungle':
        // Leaves
        for (let i = 0; i < 15; i++) {
          g.fillStyle(0x84cc16, Math.random() * 0.5 + 0.3);
          g.fillEllipse(Math.random() * 200, Math.random() * 200, 10, 5);
        }
        break;
      case 'festival':
      case 'candy':
        // Confetti / sprinkles
        const confColors = theme.id === 'candy'
          ? [0xfbbf24, 0xfb7185, 0xc026d3, 0x34d399, 0x60a5fa, 0xfde047]
          : [0xfbbf24, 0xfb7185, 0xc026d3, 0x34d399, 0x60a5fa, 0xfde047];
        for (let i = 0; i < 20; i++) {
          g.fillStyle(confColors[i % confColors.length], Math.random() * 0.6 + 0.3);
          g.fillRect(Math.random() * 200, Math.random() * 200, 4, 6);
        }
        break;
      case 'ocean':
        // Bubbles
        for (let i = 0; i < 20; i++) {
          g.fillStyle(0xeaf6ff, Math.random() * 0.4 + 0.2);
          g.fillCircle(Math.random() * 200, Math.random() * 200, Math.random() * 3 + 1);
        }
        break;
      case 'cityscape':
        // Digital sparks
        for (let i = 0; i < 25; i++) {
          g.fillStyle(Math.random() > 0.5 ? 0x22d3ee : 0xf472b6, Math.random() * 0.6 + 0.3);
          g.fillCircle(Math.random() * 200, Math.random() * 200, 1);
        }
        break;
      case 'sports':
        // Crowd sparkle
        for (let i = 0; i < 20; i++) {
          const c = [0xfbbf24, 0xf97316, 0xef4444, 0x3b82f6][i % 4];
          g.fillStyle(c, Math.random() * 0.5 + 0.3);
          g.fillCircle(Math.random() * 200, Math.random() * 200, 1.5);
        }
        break;
    }
  }
}

// ============================================================================
// JUICE — particle bursts, screen shake, hit-stop, flash, squash
// ============================================================================

export class Juice {
  private lod = getLod();
  constructor(private scene: Phaser.Scene, private theme: ThemeManifest) {}

  /** Safety guard — returns true if the scene is alive and safe to mutate. */
  private alive(): boolean {
    try {
      return !!(this.scene && this.scene.sys && this.scene.sys.isActive());
    } catch {
      return false;
    }
  }

  burst(x: number, y: number, kind: 'correct' | 'incorrect' | 'streak' | 'win' = 'correct') {
    if (!this.alive()) return;
    try {
      const palette = this.theme.particles[kind === 'win' ? 'streak' : kind];
      if (!palette || palette.length === 0) return;
      const count = Math.round((kind === 'win' ? 50 : 24) * this.lod.particleMultiplier);
      if (count <= 0) return;
      const key = 'particle-' + this.theme.id;
      if (!this.scene.textures.exists(key)) return;

      const emitter = this.scene.add.particles(x, y, key, {
        speed: { min: 120, max: 360 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 400, max: 900 },
        tint: palette,
        quantity: count,
        blendMode: this.lod.blendAdd ? 'ADD' : 'NORMAL',
        emitting: false,
      });
      emitter.explode(count);
      this.scene.time.delayedCall(1100, () => { try { emitter.destroy(); } catch {} });

      if ((kind === 'streak' || kind === 'win') && this.lod.blendAdd) {
        const streakKey = 'streak-' + this.theme.id;
        if (this.scene.textures.exists(streakKey)) {
          const ribbon = this.scene.add.particles(x, y, streakKey, {
            speed: { min: 200, max: 480 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 0.9, end: 0 },
            lifespan: 600,
            tint: palette,
            quantity: 12,
            blendMode: 'ADD',
            emitting: false,
          });
          ribbon.explode(12);
          this.scene.time.delayedCall(800, () => { try { ribbon.destroy(); } catch {} });
        }
      }
    } catch { /* ignore — juice is cosmetic, never crash the game */ }
  }

  shake(intensity: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.alive()) return;
    try {
      const map = { light: 0.004, medium: 0.01, heavy: 0.025 };
      this.scene.cameras.main.shake(220, map[intensity]);
    } catch {}
  }

  hitStop(ms = 80) {
    if (!this.alive()) return;
    try {
      this.scene.physics.world.pause();
      this.scene.time.delayedCall(ms, () => {
        try { if (this.alive()) this.scene.physics.world.resume(); } catch {}
      });
    } catch {}
  }

  flash(color = 0xffffff, alpha = 0.4, ms = 120) {
    if (!this.alive()) return;
    try {
      const r = this.scene.add.rectangle(
        this.scene.scale.width / 2,
        this.scene.scale.height / 2,
        this.scene.scale.width,
        this.scene.scale.height,
        color,
        alpha
      );
      r.setDepth(9999);
      this.scene.tweens.add({
        targets: r, alpha: 0, duration: ms, ease: 'Cubic.out',
        onComplete: () => { try { r.destroy(); } catch {} },
      });
    } catch {}
  }

  squash(target: Phaser.GameObjects.GameObject, scale = 1.25) {
    if (!this.alive()) return;
    try {
      this.scene.tweens.add({
        targets: target,
        scaleX: scale, scaleY: 1 / scale,
        duration: 90, yoyo: true, ease: 'Quad.out',
      });
    } catch {}
  }

  // ===========================================================================
  // AAA 2029 ADDITIONS — score popups, glow rings, combo flashes, vignette
  // ===========================================================================

  scorePopup(x: number, y: number, text: string, color: number = 0xffffff) {
    if (!this.alive()) return;
    try {
      const popup = this.scene.add.text(x, y, text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(9998);

      this.scene.tweens.add({
        targets: popup,
        y: y - 60,
        alpha: 0,
        scale: { from: 0.6, to: 1.3 },
        duration: 800,
        ease: 'Back.out',
        onComplete: () => { try { popup.destroy(); } catch {} },
      });
    } catch {}
  }

  glowRing(x: number, y: number, color: number = 0xffffff, maxRadius = 80) {
    if (!this.alive()) return;
    try {
      const ring = this.scene.add.circle(x, y, 8, color, 0)
        .setStrokeStyle(3, color, 1)
        .setDepth(9997);
      // Use scale tween (reliable on all Phaser versions) instead of radius tween
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 1, to: maxRadius / 8 },
        alpha: { from: 0.9, to: 0 },
        duration: 600,
        ease: 'Cubic.out',
        onComplete: () => { try { ring.destroy(); } catch {} },
      });
    } catch {}
  }

  zoomPunch(zoomIn = 1.08, duration = 200) {
    if (!this.alive()) return;
    try {
      const cam = this.scene.cameras.main;
      if (!cam) return;
      cam.zoomTo(zoomIn, duration * 0.4, 'Quad.out');
      this.scene.time.delayedCall(duration * 0.4, () => {
        try {
          if (this.alive() && cam) {
            cam.zoomTo(1, duration * 0.6, 'Quad.in');
          }
        } catch {}
      });
    } catch {}
  }

  vignetteFlash(color: number = 0xffffff, alpha = 0.5, ms = 200) {
    if (!this.alive()) return;
    try {
      const w = this.scene.scale.width;
      const h = this.scene.scale.height;
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(color, alpha);
      gfx.fillRect(0, 0, w, h);
      gfx.setDepth(9999);
      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: ms,
        ease: 'Cubic.out',
        onComplete: () => { try { gfx.destroy(); } catch {} },
      });
    } catch {}
  }

  confettiRain(durationMs = 2000) {
    if (!this.alive()) return;
    if (!this.lod.blendAdd) return; // skip on low-end
    try {
      const key = 'particle-' + this.theme.id;
      if (!this.scene.textures.exists(key)) return;
      const w = this.scene.scale.width;
      const palette = [
        ...this.theme.particles.correct,
        ...this.theme.particles.streak,
      ];
      if (!palette || palette.length === 0) return;
      const emitter = this.scene.add.particles(0, 0, key, {
        x: { min: 0, max: w },
        y: -10,
        speedY: { min: 100, max: 220 },
        speedX: { min: -30, max: 30 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0.4 },
        alpha: { start: 1, end: 0.6 },
        lifespan: durationMs + 400,
        tint: palette,
        quantity: 3,
        frequency: 50,
        blendMode: 'NORMAL',
      });
      this.scene.time.delayedCall(durationMs, () => {
        try {
          if (!this.alive()) { try { emitter.destroy(); } catch {} return; }
          emitter.stop();
          this.scene.time.delayedCall(1000, () => { try { emitter.destroy(); } catch {} });
        } catch { try { emitter.destroy(); } catch {} }
      });
    } catch {}
  }
}

// ============================================================================
// Mascot Controller — state machine driven by live telemetry
// ============================================================================

export type MascotState = 'idle' | 'hype' | 'urgent' | 'celebrate' | 'sad';

export class MascotController {
  private sprite: Phaser.GameObjects.Sprite;
  private state: MascotState = 'idle';
  private currentTween?: Phaser.Tweens.Tween;
  private secondaryTween?: Phaser.Tweens.Tween;
  private stateTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemeManifest,
    x: number, y: number
  ) {
    const texKey = theme.mascot === 'cloudDog'
      ? 'mascot-clouddog-' + theme.id
      : 'mascot-starkid-' + theme.id;
    if (!scene.textures.exists(texKey)) ThemeAtlas.build(scene, theme);
    this.sprite = scene.add.sprite(x, y, texKey).setDepth(100).setScale(1.5);
    // Make mascot interactive — tap to hear it speak
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => {
      audioBus.speak('Hi there! Keep playing!');
      scene.tweens.add({
        targets: this.sprite,
        scale: { from: 1.8, to: 1.5 },
        duration: 200, ease: 'Back.out',
      });
    });
    this.enterState('idle');
  }

  setState(s: MascotState) {
    if (this.state === s) return;
    this.state = s;
    this.enterState(s);
  }

  private enterState(s: MascotState) {
    if (this.currentTween) { this.currentTween.stop(); this.currentTween = undefined!; }
    if (this.secondaryTween) { this.secondaryTween.stop(); this.secondaryTween = undefined!; }
    if (this.stateTimer) { this.stateTimer.remove(); this.stateTimer = undefined!; }
    const sp = this.sprite;
    sp.setScale(1.2);
    sp.setAngle(0);
    sp.setAlpha(1);
    sp.setPosition(sp.x, sp.y); // reset drift
    switch (s) {
      case 'idle':
        this.currentTween = this.scene.tweens.add({
          targets: sp, y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        break;
      case 'hype':
        audioBus.play('streak');
        this.currentTween = this.scene.tweens.add({
          targets: sp, scale: 1.6, y: '-=20', duration: 180, yoyo: true, repeat: -1, ease: 'Quad.out',
        });
        this.secondaryTween = this.scene.tweens.add({
          targets: sp, angle: 12, duration: 90, yoyo: true, repeat: -1,
        });
        this.stateTimer = this.scene.time.delayedCall(4000, () => this.setState('idle'));
        break;
      case 'urgent':
        this.currentTween = this.scene.tweens.add({
          targets: sp, x: '+=4', duration: 60, yoyo: true, repeat: -1,
        });
        this.secondaryTween = this.scene.tweens.add({
          targets: sp, alpha: 0.6, duration: 200, yoyo: true, repeat: -1,
        });
        break;
      case 'celebrate':
        audioBus.play('win');
        this.currentTween = this.scene.tweens.add({
          targets: sp, scale: 1.8, duration: 200, yoyo: true, repeat: 3, ease: 'Back.out',
        });
        this.secondaryTween = this.scene.tweens.add({ targets: sp, angle: 360, duration: 1000, repeat: 0 });
        this.stateTimer = this.scene.time.delayedCall(2500, () => this.setState('idle'));
        break;
      case 'sad':
        audioBus.play('lose');
        this.currentTween = this.scene.tweens.add({
          targets: sp, y: '+=8', angle: -10, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        this.stateTimer = this.scene.time.delayedCall(3000, () => this.setState('idle'));
        break;
    }
  }

  setVisible(v: boolean) { this.sprite.setVisible(v); }
  destroy() {
    this.sprite.destroy();
  }
}

// ============================================================================
// HUD overlay — score, streak, timer, mascot
// ============================================================================

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private streakText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressBg!: Phaser.GameObjects.Rectangle;
  private mascot: MascotController;
  private startTime = 0;
  private lastUrgentTick = false;
  private lastStreakShown = 0;

  constructor(
    private scene: Phaser.Scene,
    private theme: ThemeManifest,
    private onUpdate: (state: { score: number; streak: number; remainingMs: number }) => void,
    private initialTimeMs = 300_000, // 5 minutes — kid-friendly, no pressure
  ) {
    const t = theme;
    const textHex = '#' + t.text.toString(16).padStart(6, '0');
    const accentHex = '#' + t.accent.toString(16).padStart(6, '0');

    // AAA 2029 — semi-transparent HUD panel background
    const hudBg = scene.add.rectangle(0, 0, scene.scale.width, 90, 0x000000, 0.35)
      .setOrigin(0, 0).setDepth(199);

    // Score with badge background
    const scoreBg = scene.add.rectangle(20, 24, 150, 36, t.card, 0.7)
      .setStrokeStyle(1, t.accent, 0.5).setDepth(200);
    this.scoreText = scene.add.text(28, 16, 'Score: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '21px', color: textHex,
      fontStyle: 'bold',
    }).setDepth(201);

    // Streak with fire emoji + accent color
    this.streakText = scene.add.text(180, 22, '🔥 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: accentHex, fontStyle: 'bold',
    }).setDepth(201);

    // Timer (right side) with badge
    const timerBg = scene.add.rectangle(scene.scale.width - 130, 24, 110, 36, t.card, 0.7)
      .setStrokeStyle(1, t.accent, 0.5).setDepth(200);
    this.timerText = scene.add.text(scene.scale.width - 75, 16, '⏱ 3:00', {
      fontFamily: 'Inter, sans-serif', fontSize: '21px', color: textHex,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(201);

    // Progress bar (under HUD)
    this.progressBg = scene.add.rectangle(
      scene.scale.width / 2, 70, scene.scale.width - 40, 6,
      0x000000, 0.4
    ).setStrokeStyle(1, t.accent, 0.3).setDepth(200);
    this.progressBar = scene.add.rectangle(
      20, 70, 0, 4, t.success, 1
    ).setOrigin(0, 0.5).setDepth(201);

    // Mascot in bottom-right corner
    this.mascot = new MascotController(scene, theme, scene.scale.width - 60, scene.scale.height - 60);

    this.startTime = Date.now(); // Use real time, not Phaser game time
    void hudBg; void scoreBg; void timerBg;
  }

  tick(score: number, streak: number, maxScore: number) {
    const elapsed = Date.now() - this.startTime;
    const remainingMs = Math.max(0, this.initialTimeMs - elapsed);
    const sec = Math.floor(remainingMs / 1000);
    const mm = Math.floor(sec / 60);
    const ss = (sec % 60).toString().padStart(2, '0');
    this.timerText.setText(`⏱ ${mm}:${ss}`);

    const isUrgent = remainingMs < this.initialTimeMs * 0.2;
    if (isUrgent && !this.lastUrgentTick) {
      this.timerText.setColor('#' + this.theme.warning.toString(16).padStart(6, '0'));
      this.mascot.setState('urgent');
      this.lastUrgentTick = true;
    } else if (!isUrgent && this.lastUrgentTick) {
      this.timerText.setColor('#' + this.theme.text.toString(16).padStart(6, '0'));
      this.lastUrgentTick = false;
    }

    this.scoreText.setText(`Score: ${score}/${maxScore}`);
    // Combo multiplier display — shows x2, x3 etc. when on streak
    const mult = streak >= 5 ? 3 : streak >= 3 ? 2 : 1;
    this.streakText.setText(streak >= 3 ? `🔥${streak} x${mult}!` : `🔥 ${streak}`);
    if (streak >= 3) {
      this.streakText.setColor('#' + this.theme.warning.toString(16).padStart(6, '0'));
      // Pulse the streak text on streak
      if (streak !== this.lastStreakShown) {
        this.scene.tweens.add({
          targets: this.streakText,
          scale: { from: 1.4, to: 1 },
          duration: 300, ease: 'Back.out',
        });
        this.lastStreakShown = streak;
      }
    } else {
      this.streakText.setColor('#' + this.theme.accent.toString(16).padStart(6, '0'));
      this.lastStreakShown = 0;
    }
    // Animate progress bar
    const progress = maxScore > 0 ? score / maxScore : 0;
    const maxWidth = this.scene.scale.width - 44;
    this.progressBar.width = maxWidth * progress;
    // Color shift based on progress
    if (progress >= 0.8) this.progressBar.setFillStyle(this.theme.success, 1);
    else if (progress >= 0.5) this.progressBar.setFillStyle(this.theme.warning, 1);
    else this.progressBar.setFillStyle(this.theme.accent, 1);

    if (streak >= 3) this.mascot.setState('hype');
    this.onUpdate({ score, streak, remainingMs });
    return { remainingMs };
  }

  celebrate() { this.mascot.setState('celebrate'); }
  sad() { this.mascot.setState('sad'); }

  destroy() {
    this.scoreText.destroy();
    this.streakText.destroy();
    this.timerText.destroy();
    this.mascot.destroy();
  }
}
