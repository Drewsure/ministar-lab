import * as Phaser from 'phaser';

// ============================================================================
// EventBus — Decoupled event-driven communication system
// ============================================================================
// Elite-tier architecture: game systems NEVER talk to each other directly.
// Instead they emit events through this global bus, and other systems listen.
//
// This eliminates spaghetti code like:
//   recordAnswer() → juice.burst() + audioBus.speak() + hud.tick() + checkLevelUp()
//
// Now it's:
//   recordAnswer() → EventBus.emit(GAME_EVENTS.ANSWER_CORRECT, payload)
//   → Juice listens → burst + scorePopup
//   → Audio listens → play correct sound + speak word
//   → HUD listens → tick + update display
//   → LevelSystem listens → checkLevelUp
//
// Each system is independently testable and modifiable.
// ============================================================================

export const GAME_EVENTS = {
  ANSWER_CORRECT: 'answer:correct',
  ANSWER_WRONG: 'answer:wrong',
  ANSWER_TIMEOUT: 'answer:timeout',
  LEVEL_UP: 'level:up',
  GAME_START: 'game:start',
  GAME_END: 'game:end',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  SCORE_CHANGE: 'score:change',
  STREAK_CHANGE: 'streak:change',
  MILESTONE: 'milestone',
  URGENCY_START: 'urgency:start',
  ENTITY_SPAWN: 'entity:spawn',
  ENTITY_DESPAWN: 'entity:despawn',
  VFX_BURST: 'vfx:burst',
  VFX_FLASH: 'vfx:flash',
  VFX_SHAKE: 'vfx:shake',
  VFX_POPUP: 'vfx:popup',
} as const;

export interface EventPayloads {
  [GAME_EVENTS.ANSWER_CORRECT]: {
    term: string;
    coordinate?: { x: number; y: number; t: number };
    streak: number;
    score: number;
    maxScore: number;
  };
  [GAME_EVENTS.ANSWER_WRONG]: {
    term: string;
    response: string;
    coordinate?: { x: number; y: number; t: number };
  };
  [GAME_EVENTS.LEVEL_UP]: {
    level: number;
  };
  [GAME_EVENTS.GAME_END]: {
    won: boolean;
    score: number;
    maxScore: number;
    durationMs: number;
  };
  [GAME_EVENTS.SCORE_CHANGE]: {
    score: number;
    maxScore: number;
  };
  [GAME_EVENTS.STREAK_CHANGE]: {
    streak: number;
  };
  [GAME_EVENTS.MILESTONE]: {
    percentage: number;
  };
  [GAME_EVENTS.URGENCY_START]: {};
  [GAME_EVENTS.VFX_BURST]: {
    x: number;
    y: number;
    kind: 'correct' | 'incorrect' | 'streak' | 'win';
  };
  [GAME_EVENTS.VFX_FLASH]: {
    color: number;
    alpha: number;
    durationMs: number;
  };
  [GAME_EVENTS.VFX_SHAKE]: {
    intensity: 'light' | 'medium' | 'heavy';
  };
  [GAME_EVENTS.VFX_POPUP]: {
    x: number;
    y: number;
    text: string;
    color: number;
  };
}

// Type-safe event emitter wrapper
export class EventBus {
  private emitter: Phaser.Events.EventEmitter;

  constructor() {
    this.emitter = new Phaser.Events.EventEmitter();
  }

  // Type-safe emit
  emit<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
    this.emitter.emit(event as string, payload);
  }

  // Type-safe on
  on<K extends keyof EventPayloads>(
    event: K,
    callback: (payload: EventPayloads[K]) => void,
    context?: any
  ): this {
    this.emitter.on(event as string, callback, context);
    return this;
  }

  // Type-safe once
  once<K extends keyof EventPayloads>(
    event: K,
    callback: (payload: EventPayloads[K]) => void,
    context?: any
  ): this {
    this.emitter.once(event as string, callback, context);
    return this;
  }

  // Remove listener
  off<K extends keyof EventPayloads>(
    event: K,
    callback?: (payload: EventPayloads[K]) => void,
    context?: any
  ): this {
    this.emitter.off(event as string, callback as any, context);
    return this;
  }

  // Remove all listeners (on scene shutdown)
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  // Destroy
  destroy(): void {
    this.emitter.destroy();
  }
}
