import type { GameModeId, GameModeMeta } from './types';

// The 11 game modes — driven by three parent engines.
// Each engine reads the same unified TermItem[] dataset.

export const GAME_MODES: GameModeMeta[] = [
  // Selection Engine — physics collisions + distinct choice logic
  {
    id: 'maze-chase',
    name: 'Maze Chase',
    engine: 'Selection',
    description: 'Navigate a procedural maze, collect correct answers, dodge decoys.',
    emoji: '🧭',
    minTerms: 2,
    maxTerms: 12,
    accent: '#22d3ee',
  },
  {
    id: 'quiz',
    name: 'Quiz',
    engine: 'Selection',
    description: 'Multiple-choice quiz with timed answers and streak multipliers.',
    emoji: '❓',
    minTerms: 2,
    maxTerms: 20,
    accent: '#7c3aed',
  },
  {
    id: 'airplane',
    name: 'Airplane',
    engine: 'Selection',
    description: 'Fly through clouds and steer into the correct term banner.',
    emoji: '✈️',
    minTerms: 2,
    maxTerms: 10,
    accent: '#0ea5e9',
  },
  {
    id: 'gameshow',
    name: 'Gameshow Quiz',
    engine: 'Selection',
    description: 'Three-lifeline gameshow with spotlight reveal and confetti finale.',
    emoji: '🎯',
    minTerms: 2,
    maxTerms: 15,
    accent: '#c026d3',
  },
  // Pairing Engine — ID_A ↔ ID_B comparison
  {
    id: 'memory-match',
    name: 'Memory Match',
    engine: 'Pairing',
    description: 'Flip cards to find matching term pairs against the clock.',
    emoji: '🃏',
    minTerms: 2,
    maxTerms: 8,
    accent: '#22c55e',
  },
  {
    id: 'match-up',
    name: 'Match Up',
    engine: 'Pairing',
    description: 'Drag left-column terms to right-column definitions.',
    emoji: '🔗',
    minTerms: 3,
    maxTerms: 10,
    accent: '#15803d',
  },
  {
    id: 'balloon-pop',
    name: 'Balloon Pop',
    engine: 'Pairing',
    description: 'Pop the balloon carrying the term that matches the prompt.',
    emoji: '🎈',
    minTerms: 2,
    maxTerms: 12,
    accent: '#fb7185',
  },
  {
    id: 'whack-a-mole',
    name: 'Whack-a-Mole',
    engine: 'Pairing',
    description: 'Bonk the mole surfacing with the correct answer.',
    emoji: '🔨',
    minTerms: 2,
    maxTerms: 10,
    accent: '#a16207',
  },
  // Text / Spelling Engine — array sequencing + letter deduction
  {
    id: 'anagram',
    name: 'Anagram',
    engine: 'Text',
    description: 'Unscramble letters to spell each vocabulary word.',
    emoji: '🔤',
    minTerms: 2,
    maxTerms: 15,
    accent: '#fbbf24',
  },
  {
    id: 'wordsearch',
    name: 'Word Search',
    engine: 'Text',
    description: 'Find vocabulary words hidden in a generated letter grid.',
    emoji: '🔍',
    minTerms: 3,
    maxTerms: 12,
    accent: '#8b5cf6',
  },
  {
    id: 'bridge-builder',
    name: 'Bridge Builder',
    engine: 'Text',
    description: 'Rocket Launch mechanic — guess letters to span the river. (Hangman alternative.)',
    emoji: '🚀',
    minTerms: 1,
    maxTerms: 20,
    accent: '#f97316',
  },
  {
    id: 'crossword',
    name: 'Crossword',
    engine: 'Text',
    description: 'AI-generated dense crossword grid from your term list. Tap cells, type answers.',
    emoji: '🔤',
    minTerms: 3,
    maxTerms: 12,
    accent: '#10b981',
  },
];

export function getGameMode(id: GameModeId): GameModeMeta {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

export const GAME_MODE_MAP: Record<GameModeId, GameModeMeta> = Object.fromEntries(
  GAME_MODES.map((m) => [m.id, m])
) as Record<GameModeId, GameModeMeta>;
