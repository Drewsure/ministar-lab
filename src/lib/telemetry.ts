import type { XapiEvent, TelemetryVerifyResult } from './types';

// xAPI dispatcher + server-authoritative anti-cheat verifier.
// Every Phaser interaction emits an xAPI event; on game completion
// the serverless endpoint runs the dual-verification gate.

const VERB_ANSWERED = 'https://w3id.org/xapi/verbs/answered';
const VERB_COMPLETED = 'https://w3id.org/xapi/verbs/completed';
const VERB_EXPERIENCED = 'https://w3id.org/xapi/verbs/experienced';

const ACTOR_ID_STORAGE = 'ministar.actor.id';
const ACTOR_NAME_STORAGE = 'ministar.actor.name';

export function getActor(): { id: string; name: string } {
  if (typeof window === 'undefined') return { id: 'anonymous', name: 'Anonymous' };
  let id = localStorage.getItem(ACTOR_ID_STORAGE);
  if (!id) {
    id = `student-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ACTOR_ID_STORAGE, id);
  }
  let name = localStorage.getItem(ACTOR_NAME_STORAGE) || 'Student';
  return { id, name };
}

export function setActorName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTOR_NAME_STORAGE, name);
}

// In-memory ring buffer of recent events for the dashboard "live telemetry" view.
const eventBuffer: XapiEvent[] = [];
const MAX_BUFFER = 100;

export function pushEvent(ev: XapiEvent) {
  eventBuffer.unshift(ev);
  if (eventBuffer.length > MAX_BUFFER) eventBuffer.length = MAX_BUFFER;
  // Also POST to /api/telemetry/verify for server-authoritative logging
  if (typeof window !== 'undefined') {
    fetch('/api/telemetry/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    }).catch(() => { /* never block gameplay */ });
  }
}

export function recentEvents(): XapiEvent[] {
  return [...eventBuffer];
}

export function clearEvents() {
  eventBuffer.length = 0;
}

export function makeAnsweredEvent(opts: {
  actor: { id: string; name: string };
  gameMode: string;
  unit: string;
  term: string;
  response: string;
  success: boolean;
  score: number;
  maxScore: number;
  durationMs: number;
  coordinate?: { x: number; y: number; t: number };
  streak?: number;
  tenantId?: string;
}): XapiEvent {
  return {
    actor: opts.actor,
    verb: { id: VERB_ANSWERED, display: { 'en-US': 'answered' } },
    object: {
      id: `https://ministar.lab/units/${opts.unit}/${encodeURIComponent(opts.term)}`,
      definition: { type: 'http://adlnet.gov/expapi/activities/cmi.interaction', name: { 'en-US': opts.term } },
    },
    result: {
      success: opts.success,
      response: opts.response,
      score: { raw: opts.score, min: 0, max: opts.maxScore },
      duration: `PT${(opts.durationMs / 1000).toFixed(3)}S`,
      extensions: {
        'https://ministar.lab/xapi/gameMode': opts.gameMode,
      },
    },
    timestamp: new Date().toISOString(),
    context: {
      extensions: {
        'https://ministar.lab/xapi/coordinate': opts.coordinate,
        'https://ministar.lab/xapi/streak': opts.streak,
        'https://ministar.lab/xapi/gameMode': opts.gameMode,
        'https://ministar.lab/xapi/tenantId': opts.tenantId,
      },
    },
  };
}

export function makeCompletedEvent(opts: {
  actor: { id: string; name: string };
  gameMode: string;
  unit: string;
  totalCorrect: number;
  totalQuestions: number;
  durationMs: number;
  streak: number;
  tenantId?: string;
}): XapiEvent {
  return {
    actor: opts.actor,
    verb: { id: VERB_COMPLETED, display: { 'en-US': 'completed' } },
    object: {
      id: `https://ministar.lab/units/${opts.unit}/game/${opts.gameMode}`,
      definition: { type: 'http://adlnet.gov/expapi/activities/assessment', name: { 'en-US': `${opts.gameMode} session` } },
    },
    result: {
      success: opts.totalCorrect >= opts.totalQuestions * 0.6,
      score: { raw: opts.totalCorrect, min: 0, max: opts.totalQuestions },
      duration: `PT${(opts.durationMs / 1000).toFixed(3)}S`,
      extensions: {
        'https://ministar.lab/xapi/streak': opts.streak,
        'https://ministar.lab/xapi/gameMode': opts.gameMode,
      },
    },
    timestamp: new Date().toISOString(),
    context: {
      extensions: {
        'https://ministar.lab/xapi/gameMode': opts.gameMode,
        'https://ministar.lab/xapi/tenantId': opts.tenantId,
      },
    },
  };
}

// ============================================================================
// DUAL-VERIFICATION GATE (server-side logic, also runs client-side for preview)
// ============================================================================

// Thresholds — calibrated against human reading speed & touchscreen physics.
const IMPOSSIBLE_WPM = 220; // fast adult readers hit ~250 skimming; students rarely exceed 180
const MIN_PER_QUESTION_MS = 600; // sub-600ms answers are virtually always script-assisted
const MAX_COORDINATE_JUMP_PX = 1800; // pointer can't teleport across the canvas

interface VerifyInput {
  events: XapiEvent[];
  totalQuestions: number;
  durationMs: number;
}

export function verifyTelemetry(input: VerifyInput): TelemetryVerifyResult {
  const { events, totalQuestions, durationMs } = input;

  if (totalQuestions === 0) return { status: 'ok', finalScore: 0 };

  const answered = events.filter((e) => e.verb.id === VERB_ANSWERED);
  const correct = answered.filter((e) => e.result?.success).length;

  // Gate 1: time-to-completion physically viable?
  const perQuestion = durationMs / totalQuestions;
  if (perQuestion < MIN_PER_QUESTION_MS) {
    return {
      status: 'quarantine',
      anomalyReason: `avg ${perQuestion.toFixed(0)}ms/question (min ${MIN_PER_QUESTION_MS}ms)`,
      finalScore: correct,
    };
  }

  // Gate 2: WPM check
  const minutes = durationMs / 60000;
  const wpm = totalQuestions / Math.max(minutes, 0.05);
  if (wpm > IMPOSSIBLE_WPM) {
    return {
      status: 'quarantine',
      anomalyReason: `${wpm.toFixed(0)} WPM exceeds human ceiling (${IMPOSSIBLE_WPM})`,
      finalScore: correct,
    };
  }

  // Gate 3: coordinate teleport detection
  const coords = answered
    .map((e) => e.context?.extensions?.['https://ministar.lab/xapi/coordinate'])
    .filter(Boolean) as { x: number; y: number; t: number }[];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dt = Math.max(1, b.t - a.t);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const pxPerMs = dist / dt;
    // 1800 px/s ≈ moving cursor across an entire 800x600 canvas in 0.5s.
    if (pxPerMs > MAX_COORDINATE_JUMP_PX / 1000) {
      return {
        status: 'quarantine',
        anomalyReason: `coordinate jump ${dist.toFixed(0)}px in ${dt}ms`,
        finalScore: correct,
      };
    }
  }

  // Gate 4: success-rate anomaly — if every answer is correct in suspiciously
  // tight timing variance, that's often a scripted bot replay.
  if (answered.length >= 4) {
    const times = answered.map((e) => {
      const dur = e.result?.duration ?? 'PT0S';
      return parseFloat(dur.replace('PT', '').replace('S', '')) * 1000;
    });
    const mean = times.reduce((s, t) => s + t, 0) / times.length;
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    const stddev = Math.sqrt(variance);
    // Sub-50ms variance on 4+ answers is robotic
    if (stddev < 50 && mean < 1500) {
      return {
        status: 'review',
        anomalyReason: `robotic timing variance σ=${stddev.toFixed(0)}ms`,
        finalScore: correct,
      };
    }
  }

  return { status: 'ok', finalScore: correct };
}
