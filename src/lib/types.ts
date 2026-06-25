// MiniStar shared types — used across React UI, Phaser scenes, serverless APIs.

export type ThemeId = 'space' | 'jungle' | 'festival' | 'cityscape' | 'ocean' | 'candy' | 'haunted' | 'sports' | 'christmas' | 'easter';

export interface ThemeManifest {
  id: ThemeId;
  name: string;
  tagline: string;
  // Phaser palette
  bg: number;
  bgGradientTop: number;
  bgGradientBottom: number;
  card: number;
  cardAlt: number;
  accent: number;
  accent2: number;
  text: number;
  textMuted: number;
  success: number;
  danger: number;
  warning: number;
  // Particle palettes per event
  particles: {
    correct: number[];
    incorrect: number[];
    streak: number[];
  };
  // Mascot
  mascot: 'cloudDog' | 'starKid';
  // Background sprite key (procedurally generated)
  bgSpriteKey: string;
  // CSS tokens (for React shell)
  css: {
    '--brand-primary': string;
    '--brand-accent': string;
    '--brand-bg': string;
    '--brand-card': string;
    '--brand-text': string;
    '--ui-radius': string;
    '--font-display': string;
  };
}

export interface BrandManifest {
  id: string;
  subdomain: string;
  displayName: string;
  logoText: string;
  logoSvg?: string; // inline SVG markup
  primaryColor: string;
  accentColor: string;
  bgTone: string;
  radius: number;
  fontDisplay: string;
  defaultTheme: ThemeId;
  tagline: string;
}

export interface TermItem {
  id: string;
  term: string;
  definition?: string;
  emoji?: string;
  termAudioUrl?: string;
  definitionAudioUrl?: string;
  verified: boolean;
}

export interface ContentBlock {
  id: string;
  tenantId: string;
  unit: string;
  term: string;
  definition?: string;
  emoji?: string;
  termAudioUrl?: string;
  definitionAudioUrl?: string;
  verified: boolean;
}

export type GameModeId =
  | 'maze-chase'
  | 'quiz'
  | 'airplane'
  | 'gameshow'
  | 'memory-match'
  | 'match-up'
  | 'balloon-pop'
  | 'whack-a-mole'
  | 'anagram'
  | 'wordsearch'
  | 'bridge-builder'
  | 'crossword'
  | 'flash-cards'
  | 'spin-wheel'
  | 'group-sort'
  | 'type-answer'
  | 'spot-it'
  | 'label-it'
  | 'speak-it'
  | 'endless-runner'
  | 'physics-puzzler'
  | 'snaking'
  | 'training-academy'
  | 'rescue-quest';

export interface GameModeMeta {
  id: GameModeId;
  name: string;
  engine: 'Selection' | 'Pairing' | 'Text';
  description: string;
  emoji: string;
  minTerms: number;
  maxTerms: number;
  accent: string;
}

export interface GameLaunchConfig {
  mode: GameModeId;
  theme: ThemeId;
  terms: TermItem[];
  unit: string;
  qrSlug?: string;
  tenantId?: string;
  studentId?: string;
}

// xAPI-compliant telemetry payload (subset of the spec).
export interface XapiEvent {
  actor: { id: string; name: string };
  verb: {
    id: string; // e.g. "https://w3id.org/xapi/verbs/answered"
    display: { 'en-US': string };
  };
  object: { id: string; definition: { type: string; name: { 'en-US': string } } };
  result?: {
    success?: boolean;
    response?: string;
    score?: { raw: number; min: number; max: number };
    duration?: string; // ISO 8601 duration
    extensions?: Record<string, unknown>;
  };
  timestamp: string;
  // Custom MiniStar extensions for anti-cheat
  context?: {
    extensions?: {
      'https://ministar.lab/xapi/coordinate'?: { x: number; y: number; t: number };
      'https://ministar.lab/xapi/streak'?: number;
      'https://ministar.lab/xapi/gameMode'?: string;
      'https://ministar.lab/xapi/tenantId'?: string;
    };
  };
}

export interface TelemetryVerifyResult {
  status: 'ok' | 'quarantine' | 'review';
  anomalyReason?: string;
  finalScore?: number;
}
