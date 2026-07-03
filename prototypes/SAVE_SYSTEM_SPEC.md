# Save / Checkpoint System — Specification & Scope

## Status: OUT OF SCOPE FOR PROTOTYPES

Per the hard constraints:
> You are NOT allowed to change repository architecture, auth, deployment, database, tenant model, package manager, or global app shell unless explicitly asked.

A save/checkpoint system requires database schema changes, API endpoints, and authentication — all explicitly out of scope for prototype work.

**AA save-integrity standard:** NOT MET for prototypes. This document specifies how it would be implemented in the LivingTextbook production migration.

---

## Production Save System Specification

### 1. Checkpoint Triggers

The game emits `mastery_updated` events whenever a term's mastery changes. In production, each `mastery_updated` event triggers a checkpoint write:

```
mastery_updated event → PATCH /api/terms/{termId}/mastery
```

The `game_completed` event triggers a full session checkpoint:

```
game_completed event → POST /api/game-sessions
```

### 2. Save Payload

```jsonc
// PATCH /api/terms/{termId}/mastery
{
  "tenantId": "sample",
  "studentId": "stu-123",
  "termId": "sentence-0",
  "mastery": 0.15,
  "delta": 0.15,
  "sessionId": "sess-...",
  "timestamp": 1701
}

// POST /api/game-sessions
{
  "tenantId": "sample",
  "studentId": "stu-123",
  "sessionId": "sess-...",
  "gameMode": "fill-in-the-blank",
  "totalRounds": 2,
  "correct": 2,
  "totalAttempts": 2,
  "accuracy": 1.0,
  "durationMs": 15000,
  "finalMastery": { "sentence-0": 0.15, "sentence-1": 0.15 },
  "eventLog": [/* full event array */]
}
```

### 3. Save Integrity Requirements (AA Standard)

1. **Atomic writes:** Each checkpoint write is atomic — either fully committed or not at all. No partial saves.
2. **Conflict resolution:** If a save write is interrupted (network failure, browser crash), the next session loads the last known-good state and the interrupted attempt is discarded.
3. **No progress bricking:** A corrupt save file does not prevent the student from starting a new game. The system detects corruption and falls back to default state.
4. **Idempotent mastery updates:** Re-sending the same `mastery_updated` event does not double-apply the delta. The API deduplicates by `sessionId + termId + timestamp`.

### 4. Implementation Plan (for LivingTextbook migration)

1. **Database schema:** Add `game_sessions` and `term_mastery` tables to the Prisma schema.
2. **API endpoints:** Add `/api/game-sessions` (POST) and `/api/terms/{id}/mastery` (PATCH) routes.
3. **Client-side:** In the prototype's `onEvent` callback, forward `mastery_updated` and `game_completed` events to the API.
4. **Load on start:** When a game starts, fetch the student's current mastery state from `/api/students/{id}/mastery?unit={unitId}` and pass it as initial mastery in the game input JSON.
5. **Resume:** If a student closes the browser mid-game, the next session resumes from the last checkpoint (last `mastery_updated` event). The game reconstructs the round state from the mastery scores.

### 5. What the Prototypes Do Instead

The prototypes track mastery in-memory only. When the page reloads:
- Mastery scores reset to 0
- No session history is preserved
- No progress is saved

This is acceptable for prototype evaluation but does NOT meet AA save-integrity standards.

### 6. Migration Checklist

- [ ] Add `GameSession` and `TermMastery` models to Prisma schema
- [ ] Add POST `/api/game-sessions` route
- [ ] Add PATCH `/api/terms/{id}/mastery` route
- [ ] Add GET `/api/students/{id}/mastery` route (for loading saved state)
- [ ] Wire prototype `onEvent` callbacks to API calls
- [ ] Add save-corruption detection + fallback
- [ ] Test: close browser mid-game → reopen → verify mastery preserved
- [ ] Test: network failure during save → verify no progress lost
- [ ] Test: corrupt save file → verify game still starts with defaults
