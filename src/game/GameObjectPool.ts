import * as Phaser from 'phaser';

// ============================================================================
// GameObjectPool — Zero-allocation object recycling system
// ============================================================================
// Inspired by Vampire Survivors-style object pooling. Instead of creating
// new GameObjects every frame (which triggers GC), we pre-allocate a pool
// of objects and recycle them.
//
// Usage:
//   const pool = new GameObjectPool(scene, 'text', 20);
//   const text = pool.acquire(x, y, 'Hello', style);  // get or create
//   pool.release(text);                                 // recycle back
//
// This eliminates GC pauses during gameplay — the #1 cause of micro-stutters.
// ============================================================================

export class GameObjectPool {
  private scene: Phaser.Scene;
  private pool: Phaser.GameObjects.GameObject[] = [];
  private active: Set<Phaser.GameObjects.GameObject> = new Set();
  private type: 'text' | 'circle' | 'rectangle' | 'container';
  private maxSize: number;

  constructor(scene: Phaser.Scene, type: 'text' | 'circle' | 'rectangle' | 'container', maxSize = 30) {
    this.scene = scene;
    this.type = type;
    this.maxSize = maxSize;
  }

  // Acquire an object from the pool (or create new if pool is empty)
  acquire(x: number, y: number): Phaser.GameObjects.GameObject {
    let obj: Phaser.GameObjects.GameObject | undefined;

    // Try to get from pool
    if (this.pool.length > 0) {
      obj = this.pool.pop();
      if (obj) {
        const c = obj as unknown as Phaser.GameObjects.Components.Transform;
        obj.setActive(true);
        (obj as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
        c.setPosition(x, y);
        if ('setAlpha' in obj) (obj as any).setAlpha(1);
        if ('setScale' in obj) (obj as any).setScale(1);
      }
    }

    // Create new if pool was empty
    if (!obj) {
      switch (this.type) {
        case 'text':
          obj = this.scene.add.text(x, y, '', {
            fontFamily: 'Inter, sans-serif',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
          }).setOrigin(0.5).setDepth(9998);
          break;
        case 'circle':
          obj = this.scene.add.circle(x, y, 10, 0xffffff, 1).setDepth(9998);
          break;
        case 'rectangle':
          obj = this.scene.add.rectangle(x, y, 100, 50, 0xffffff, 1).setDepth(9998);
          break;
        case 'container':
          obj = this.scene.add.container(x, y).setDepth(9998);
          break;
      }
    }

    this.active.add(obj!);
    return obj!;
  }

  // Release an object back to the pool (recycle, don't destroy)
  release(obj: Phaser.GameObjects.GameObject) {
    if (!obj || !this.active.has(obj)) return;

    const c = obj as any;
    obj.setActive(false);
    if ('setVisible' in c) c.setVisible(false);
    if ('setAlpha' in c) c.setAlpha(0);

    // Kill any tweens on this object (prevent orphaned tweens)
    try { this.scene.tweens.killTweensOf(obj); } catch {}

    this.active.delete(obj);

    // Only keep up to maxSize in pool (prevent memory leak)
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    } else {
      // Pool is full — actually destroy
      try { obj.destroy(); } catch {}
    }
  }

  // Release all active objects (e.g., on scene shutdown)
  releaseAll() {
    for (const obj of this.active) {
      const c = obj as any;
      obj.setActive(false);
      if ('setVisible' in c) c.setVisible(false);
      if ('setAlpha' in c) c.setAlpha(0);
      try { this.scene.tweens.killTweensOf(obj); } catch {}
      if (this.pool.length < this.maxSize) {
        this.pool.push(obj);
      } else {
        try { obj.destroy(); } catch {}
      }
    }
    this.active.clear();
  }

  // Get count of active objects (for debugging)
  get activeCount(): number {
    return this.active.size;
  }

  // Get count of pooled (available) objects
  get pooledCount(): number {
    return this.pool.length;
  }

  // Destroy all objects (on scene destroy)
  destroy() {
    for (const obj of this.active) { try { obj.destroy(); } catch {} }
    for (const obj of this.pool) { try { obj.destroy(); } catch {} }
    this.active.clear();
    this.pool.length = 0;
  }
}
