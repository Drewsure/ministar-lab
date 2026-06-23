// ============================================================================
// Adaptive Difficulty + Story Mode Engine
// ============================================================================
// Tracks per-student performance and dynamically adjusts:
//   1. Distractor quality (use harder distractors when student is winning)
//   2. Timer length (faster when winning, slower when losing)
//   3. Boss Battles every 5 levels (multi-stage mechanics)
//   4. Story beats that unlock with progression
//
// All state persists in localStorage so it carries across sessions.
// ============================================================================

import type { TermItem } from './types';

export interface StudentProfile {
  // Per-term mastery: 0 = never seen, 1+ = times correct, -1 = wrong once
  termMastery: Record<string, number>;
  // Rolling accuracy (last 20 answers)
  recentResults: boolean[];
  // Average reaction time (ms) for correct answers
  avgReactionMs: number;
  // Total games played
  totalGames: number;
  // Story progression
  storyChapter: number;
  storyBeats: string[]; // unlocked beat ids
  // Boss battle state
  bossBattlesWon: number;
  currentBossHealth?: number;
  // Difficulty multiplier (0.5 = easy mode, 1.0 = normal, 1.5 = hard)
  difficultyMultiplier: number;
}

const STORAGE_KEY = 'ministar_student_profile';

export function loadProfile(): StudentProfile {
  if (typeof window === 'undefined') {
    return {
      termMastery: {},
      recentResults: [],
      avgReactionMs: 3000,
      totalGames: 0,
      storyChapter: 1,
      storyBeats: [],
      bossBattlesWon: 0,
      difficultyMultiplier: 1.0,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return {
        termMastery: {},
        recentResults: [],
        avgReactionMs: 3000,
        totalGames: 0,
        storyChapter: 1,
        storyBeats: [],
        bossBattlesWon: 0,
        difficultyMultiplier: 1.0,
        ...JSON.parse(raw),
      };
    }
  } catch {}
  return {
    termMastery: {},
    recentResults: [],
    avgReactionMs: 3000,
    totalGames: 0,
    storyChapter: 1,
    storyBeats: [],
    bossBattlesWon: 0,
    difficultyMultiplier: 1.0,
  };
}

export function saveProfile(profile: StudentProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function recordAnswer(
  profile: StudentProfile,
  term: string,
  success: boolean,
  reactionMs: number
): StudentProfile {
  const newProfile = { ...profile };
  newProfile.termMastery = { ...profile.termMastery };

  // Update term mastery
  const prev = profile.termMastery[term] ?? 0;
  newProfile.termMastery[term] = success ? prev + 1 : -1;

  // Update rolling accuracy (keep last 20)
  newProfile.recentResults = [...profile.recentResults.slice(-19), success];

  // Update average reaction time (only for correct answers, exponential moving avg)
  if (success && reactionMs > 0) {
    newProfile.avgReactionMs = Math.round(profile.avgReactionMs * 0.7 + reactionMs * 0.3);
  }

  // Adaptive difficulty: if accuracy > 80% AND avg reaction < 2.5s → harder
  // If accuracy < 50% OR avg reaction > 6s → easier
  const recent = newProfile.recentResults;
  if (recent.length >= 5) {
    const accuracy = recent.filter(r => r).length / recent.length;
    if (accuracy > 0.8 && newProfile.avgReactionMs < 2500) {
      newProfile.difficultyMultiplier = Math.min(1.5, profile.difficultyMultiplier + 0.05);
    } else if (accuracy < 0.5 || newProfile.avgReactionMs > 6000) {
      newProfile.difficultyMultiplier = Math.max(0.5, profile.difficultyMultiplier - 0.05);
    }
  }

  saveProfile(newProfile);
  return newProfile;
}

export function recordGameCompletion(profile: StudentProfile, won: boolean): StudentProfile {
  const newProfile = { ...profile };
  newProfile.totalGames = profile.totalGames + 1;
  // Every 5 games = new story chapter
  if (newProfile.totalGames % 5 === 0) {
    newProfile.storyChapter = Math.min(10, profile.storyChapter + 1);
    newProfile.storyBeats = [...profile.storyBeats, `chapter-${newProfile.storyChapter}`];
  }
  if (won) {
    newProfile.bossBattlesWon = profile.bossBattlesWon + 1;
  }
  saveProfile(newProfile);
  return newProfile;
}

// ============================================================================
// Distractor selection — pick harder distractors when difficulty is high
// ============================================================================

export function pickDistractors(
  allTerms: TermItem[],
  correct: TermItem,
  count: number,
  difficultyMultiplier: number
): TermItem[] {
  const pool = allTerms.filter(t => t.id !== correct.id);
  if (pool.length <= count) return pool;

  // Sort pool by mastery (least-mastered terms are harder distractors)
  const profile = loadProfile();
  const sorted = [...pool].sort((a, b) => {
    const ma = profile.termMastery[a.term] ?? 0;
    const mb = profile.termMastery[b.term] ?? 0;
    // Higher difficulty = pick terms student has seen less (harder distractors)
    if (difficultyMultiplier > 1.0) {
      return ma - mb; // least-mastered first
    } else {
      return mb - ma; // most-mastered first (easier distractors)
    }
  });

  // Take from the appropriate end of the sorted list, with some randomness
  const takeFromHard = difficultyMultiplier > 1.0;
  const candidates = takeFromHard ? sorted.slice(0, count * 2) : sorted.slice(-count * 2);
  // Shuffle and take N
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

// ============================================================================
// Timer adjustment — faster when winning, slower when losing
// ============================================================================

export function getAdaptiveTimerMs(
  baseMs: number,
  difficultyMultiplier: number
): number {
  // 0.5x difficulty = 1.4x timer (more time)
  // 1.0x difficulty = 1.0x timer (normal)
  // 1.5x difficulty = 0.7x timer (less time)
  const factor = 1.0 / Math.sqrt(difficultyMultiplier);
  return Math.round(baseMs * factor);
}

// ============================================================================
// Boss Battle — every 5 levels, multi-stage mechanic
// ============================================================================

export interface BossBattle {
  level: number;
  name: string;
  emoji: string;
  maxHealth: number;
  currentHealth: number;
  // Boss attacks: every wrong answer = lose health
  // Boss rewards: every correct answer = damage boss
  damagePerCorrect: number;
  damagePerWrong: number; // damage to PLAYER
  // Special mechanic: boss has a "shield" that requires streak to break
  shieldThreshold: number; // streak needed to damage boss
}

export function createBossBattle(level: number): BossBattle {
  const bosses = [
    { name: 'The Word Wizard', emoji: '🧙', health: 5 },
    { name: 'Grammar Goblin', emoji: '👺', health: 7 },
    { name: 'Spelling Sphinx', emoji: '🦁', health: 9 },
    { name: 'Vocab Vampire', emoji: '🧛', health: 11 },
    { name: 'The Lexicon Lord', emoji: '👑', health: 15 },
  ];
  const idx = Math.min(bosses.length - 1, Math.floor(level / 5) - 1);
  const boss = bosses[idx];
  return {
    level,
    name: boss.name,
    emoji: boss.emoji,
    maxHealth: boss.health,
    currentHealth: boss.health,
    damagePerCorrect: 1,
    damagePerWrong: 1,
    shieldThreshold: 0, // no shield for first bosses
  };
}

// ============================================================================
// Story beats — unlock narrative as student progresses
// ============================================================================

export const STORY_BEATS: Record<number, { title: string; text: string; emoji: string }> = {
  1: {
    emoji: '🌅',
    title: 'Chapter 1: The Awakening',
    text: 'You awaken in the MiniStar Lab. The words around you glow with magic. A friendly Cloud Dog appears and offers to guide you...',
  },
  2: {
    emoji: '🗺️',
    title: 'Chapter 2: The Map of Words',
    text: 'You discover an ancient map showing 10 theme worlds. Each world holds vocabulary treasures. Your quest begins!',
  },
  3: {
    emoji: '⚔️',
    title: 'Chapter 3: The First Boss',
    text: 'The Word Wizard blocks your path! Defeat them by mastering 5 words in a row. Are you ready?',
  },
  4: {
    emoji: '🌟',
    title: 'Chapter 4: Rising Power',
    text: 'Your powers grow. The words now speak back to you. New worlds are unlocking...',
  },
  5: {
    emoji: '👑',
    title: 'Chapter 5: The Lexicon Lord',
    text: 'The final challenge awaits. The Lexicon Lord has stolen all the words. Defeat them to restore the language!',
  },
};

export function getStoryBeat(chapter: number): { title: string; text: string; emoji: string } | null {
  return STORY_BEATS[chapter] ?? null;
}

export function isBossLevel(level: number): boolean {
  return level > 0 && level % 5 === 0;
}
