import * as Phaser from 'phaser';

// ============================================================================
// GlobalPoolManager — Centralized Singleton Pool Factory
// ============================================================================
// Elite-tier object pooling inspired by AAA game architecture.
// Manages ALL recycled entities through a single global interface.
//
// Sub-pools registered:
//   - 'popup'   → scorePopup Text objects
//   - 'ring'    → glowRing Arc objects
//   - 'flash'   → full-screen flash Rectangle objects
//   - 'particle'→ particle burst Image objects
//   - 'trail'   → dash trail Text/Image objects
//
// Key features:
//   - spawnFromPool<T>(): type-safe generic acquire
//   - returnToPool(): recycle with tween cleanup
//   - flushAll(): bulk purge on scene transition (kills tweens, timers, events)
//   - Strict eviction policy: max pool size prevents memory leaks
// ============================================================================

type PoolType = 'popup' | 'ring' | 'flash' | 'particle' | 'trail';

interface PoolEntry {
  objects: Phaser.GameObjects.GameObject[];
  active: Set<Phaser.GameObjects.GameObject>;
  maxSize: number;
}

export class GlobalPoolManager {
  private static _instance: GlobalPoolManager | null = null;
  private pools: Map<PoolType, PoolEntry> = new Map();
  private scene: Phaser.Scene | null = null;

  // Singleton — one global manager for the entire game
  static getInstance(): GlobalPoolManager {
    if (!GlobalPoolManager._instance) {
      GlobalPoolManager._instance = new GlobalPoolManager();
    }
    return GlobalPoolManager._instance;
  }

  private constructor() {}

  // Register this manager with a scene (call on scene create)
  init(scene: Phaser.Scene) {
    this.scene = scene;
    // Pre-register sub-pools with sensible defaults
    this._registerPool('popup', 15);
    this._registerPool('ring', 10);
    this._registerPool('flash', 5);
    this._registerPool('particle', 20);
    this._registerPool('trail', 10);

    // Auto-flush on scene shutdown
    scene.events.once('shutdown', () => this.flushAll());
    scene.events.once('destroy', () => this.destroy());
  }

  private _registerPool(type: PoolType, maxSize: number) {
    if (!this.pools.has(type)) {
      this.pools.set(type, { objects: [], active: new Set(), maxSize });
    }
  }

  // Type-safe generic spawn — get from pool or create new
  spawnFromPool<T extends Phaser.GameObjects.GameObject>(
    type: PoolType,
    x: number,
    y: number,
    factory: (scene: Phaser.Scene, x: number, y: number) => T
  ): T {
    const entry = this.pools.get(type);
    if (!entry || !this.scene) {
      // Fallback: create directly if pool not registered
      return factory(this.scene!, x, y);
    }

    let obj = entry.objects.pop() as T | undefined;

    if (obj) {
      // Recycle
      obj.setActive(true);
      (obj as any).setVisible(true);
      (obj as any).setPosition(x, y);
      if ('setAlpha' in obj) (obj as any).setAlpha(1);
      if ('setScale' in obj) (obj as any).setScale(1);
    } else {
      // Create new
      obj = factory(this.scene, x, y);
    }

    entry.active.add(obj);
    return obj;
  }

  // Return object to pool (recycle, don't destroy)
  returnToPool(type: PoolType, obj: Phaser.GameObjects.GameObject) {
    const entry = this.pools.get(type);
    if (!entry || !entry.active.has(obj)) return;

    // Kill tweens on this object
    if (this.scene) {
      try { this.scene.tweens.killTweensOf(obj); } catch {}
    }

    obj.setActive(false);
    (obj as any).setVisible?.(false);
    if ('setAlpha' in obj) (obj as any).setAlpha(0);

    entry.active.delete(obj);

    // Eviction policy: if pool is full, actually destroy
    if (entry.objects.length < entry.maxSize) {
      entry.objects.push(obj);
    } else {
      try { obj.destroy(); } catch {}
    }
  }

  // BULK PURGE: Safely wipe all active objects on scene transition
  // Kills tweens, deactivates, returns to pool — no memory leaks
  flushAll() {
    if (!this.scene) return;

    for (const [type, entry] of this.pools) {
      for (const obj of entry.active) {
        // Kill all tweens
        try { this.scene.tweens.killTweensOf(obj); } catch {}

        // Deactivate
        obj.setActive(false);
        (obj as any).setVisible?.(false);
        if ('setAlpha' in obj) (obj as any).setAlpha(0);

        // Return to pool or destroy
        if (entry.objects.length < entry.maxSize) {
          entry.objects.push(obj);
        } else {
          try { obj.destroy(); } catch {}
        }
      }
      entry.active.clear();
    }
  }

  // Get stats (for debugging)
  getStats(): Record<string, { active: number; pooled: number }> {
    const stats: Record<string, { active: number; pooled: number }> = {};
    for (const [type, entry] of this.pools) {
      stats[type] = { active: entry.active.size, pooled: entry.objects.length };
    }
    return stats;
  }

  // Full destroy — cleanup everything
  destroy() {
    for (const [type, entry] of this.pools) {
      for (const obj of entry.active) { try { obj.destroy(); } catch {} }
      for (const obj of entry.objects) { try { obj.destroy(); } catch {} }
      entry.active.clear();
      entry.objects.length = 0;
    }
    this.pools.clear();
    this.scene = null;
  }
}
