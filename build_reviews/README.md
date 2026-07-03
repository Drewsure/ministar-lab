# Build Reviews Index — Drewsure/ministar-lab

**Protocol:** AA Engineering-Level Build Review Protocol (`AA_BUILD_REVIEW_PROTOCOL.md`)
**Last updated:** 2026-07-03

## Individual Reviews

| # | Game | Review File | Verdict |
|---|---|---|---|
| 01 | Vocab Tap Match (prototype) | `BUILD_REVIEW_01_vocab_tap_match.md` | CONDITIONALLY READY |
| 02 | Sentence Builder (prototype) | `BUILD_REVIEW_02_sentence_builder.md` | CONDITIONALLY READY |
| 03 | Fill in the Blank (prototype) | `BUILD_REVIEW_03_fill_in_the_blank.md` | NOT READY (critical: silent answer failure) |
| 04 | Quiz / True-False (prototype) | `BUILD_REVIEW_04_quiz_true_false.md` | NOT READY (critical: doc bug) |
| 05-28 | 24 Phaser Scenes (consolidated) | `BUILD_REVIEW_05-28_phaser_scenes_consolidated.md` | CONDITIONALLY READY (Phase 2 UNVERIFIED) |

## Summary

- **28 games reviewed** against AA protocol
- **2 Critical defects remain** (both in prototypes 03 and 04 — documentation/answer-derivation issues)
- **0 Critical defects remain** in Phaser scenes (LabelIt/SpeakIt win conditions + PhysicsPuzzler rAF fixed this session)
- **All 24 Phaser scenes have Phase 2 UNVERIFIED** — cannot run without full Next.js app
- **Build passes clean**, **TypeScript passes clean** (0 errors)

## What the user must do

1. **Push the fixes** (download zip, extract, commit, push)
2. **Run the live app** and play each of the 24 Phaser scenes for 30+ seconds to verify Phase 2
3. **Fix Prototype 03** — replace regex answer derivation with explicit answer field in input JSON
4. **Fix Prototype 04** — implement the explicit questions override or remove the README claim
5. **Re-run Phase 2** after any fix — a fix for one game can break another
