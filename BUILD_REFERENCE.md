# MiniStar Lab — Ongoing Build Reference

> **Purpose:** Living document. Updated every session with new learnings, environment details, gotchas, and constraints. Read this BEFORE starting any work.
>
> **Last updated:** 2026-07-03 (Session: AA Build Review Protocol embedded)
> **Sandbox base path:** `/home/z/my-project`
> **User repo path:** `C:\Users\User\ministar-lab`

> **⚠️ MANDATORY:** Every build and every build review MUST follow the **AA_ENGINEERING_LEVEL_BUILD_REVIEW_PROTOCOL.md** (also saved as `AA_BUILD_REVIEW_PROTOCOL.md`). No exceptions. No bypassing. No "it's just a prototype" shortcuts. The protocol includes Phases 0-5 with Phase 4B (Production Readiness) and Phase 4C (Engagement/Polish) mandatory for any browser-shipping build.

---

## 1. USER ENVIRONMENT (confirmed)

| Item | Value | Source |
|---|---|---|
| OS | Windows | User PowerShell output |
| Shell | PowerShell | User confirmed |
| Python | **NOT INSTALLED** | User got "Python was not found" error on 2026-07-03 |
| Repo path | `C:\Users\User\ministar-lab` | User confirmed |
| Branch | `main` | DEPLOY_PROCEDURE.md |
| GitHub | `https://github.com/Drewsure/ministar-lab.git` | DEPLOY_PROCEDURE.md |
| GitHub username | `Drewsure` | DEPLOY_PROCEDURE.md |
| Auth | GitHub PAT (classic, `repo` scope) | DEPLOY_PROCEDURE.md |
| Deployment | Vercel auto-deploys on push to `main` | DEPLOY_PROCEDURE.md |

### Implications
- ❌ **Do not tell the user to run `python -m http.server`** — Python isn't installed.
- ✅ To open a local HTML file, tell the user: `Start-Process "C:\path\to\file.html"`
- ✅ All test servers must run in the sandbox, not on the user's machine.

---

## 2. DELIVERY PROCEDURE (refined 2026-07-03)

### The canonical way to deliver code updates

```
Step 1: Create a zip with a UNIQUE filename (see gotcha #1)
Step 2: Give the user ONE PowerShell block
Step 3: Add the password note
```

### Step 1: Clean up old zips + create ONE fresh zip

```bash
cd /home/z/my-project
# IMPORTANT: Remove ALL old zips first — prevents the user from downloading a stale cached copy
rm -f download/ministar-*.zip
# Create ONE zip with a simple name
zip -r download/ministar-latest.zip \
  src/ public/ prisma/ scripts/ prototypes/ \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs \
  Caddyfile vercel.json .gitignore BUILD_REFERENCE.md \
  -x "node_modules/*" ".*"
```

For targeted fixes (smaller zip, faster download):
```bash
rm -f download/ministar-*.zip
zip -r download/ministar-latest.zip src/app/page.tsx prototypes/ BUILD_REFERENCE.md
```

### Step 2: Provide the zip file button in chat (MANDATORY)

**CRITICAL:** I MUST always provide a clickable download button/link for the zip file in my chat response. The user cannot access the sandbox filesystem directly — the only way they get the zip is by clicking a download button in the chat interface.

**How to do this:** After creating the zip, include a download button/link in the chat response that points to the zip file path. The chat interface will render this as a clickable button the user can use to save the file to their Downloads folder.

**If I forget the download button**, the user gets "path does not exist" errors when running `Expand-Archive`, and the delivery fails.

### Step 3: Give the user ONE PowerShell block (with download verification)

```powershell
# STEP 1: Click the download button in the chat to save ministar-latest.zip to your Downloads folder
# STEP 2: Verify it downloaded:
Test-Path "$env:USERPROFILE\Downloads\ministar-latest.zip"
# If the above returns False, re-download from the chat. If True, continue:

Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-latest.zip" -DestinationPath C:\Users\User\ministar-lab -Force
cd C:\Users\User\ministar-lab
git add .
git commit -m "<descriptive message>"
git push
```

### Step 4: Password note

```
If `git push` asks for password: username = Drewsure, password = GitHub PAT from https://github.com/settings/tokens (classic, repo scope)
```

---

## 3. KNOWN GOTCHAS (each one has bitten us)

### Gotcha #1: Browser caches zip downloads (bitten 2026-07-03)

**Symptom:** User runs `Expand-Archive` → `git add .` → "nothing to commit, working tree clean". The prototypes/ folder didn't appear.

**Root cause:** The zip was named `ministar-src-clean.zip` — same name as a previous delivery. The browser served a cached copy from disk.

**Fix:** ALWAYS use unique zip filenames with a timestamp. Never reuse `ministar-src-clean.zip`.

### Gotcha #2: Python not installed on user's machine (bitten 2026-07-03)

**Symptom:** User ran `python -m http.server 8080` → "Python was not found" error.

**Fix:** To open a local HTML file, use: `Start-Process "C:\path\to\file.html"`. Don't suggest Python for local testing.

### Gotcha #3: Hydration errors from localStorage during SSR (bitten 2026-07-03)

**Symptom:** "Hydration failed because the server rendered HTML didn't match the client."

**Root cause:** `useState(() => loadStats())` reads localStorage during initial render. Server returns empty defaults; client returns stored data → mismatch.

**Fix:** Use the mounted guard pattern:
```tsx
const [stats, setStats] = useState(emptyDefaults);
const [mounted, setMounted] = useState(false);
useEffect(() => {
  setStats(loadStats());
  setMounted(true);
}, []);
```

### Gotcha #4: TTS requires user gesture (known from 2026-06-26)

**Symptom:** Welcome audio doesn't play when a game starts.

**Root cause:** Browsers block `speechSynthesis.speak()` until the user has interacted with the page (click, tap, keypress).

**Fix:** Don't auto-speak on game load. Speak on the first user interaction (tap). The first pointerdown anywhere on the page unlocks TTS for subsequent calls.

### Gotcha #5: I cannot push to GitHub (known from start)

**Symptom:** Hours of work with no updates on GitHub.

**Root cause:** The sandbox has no GitHub credentials. All commits exist only in the ephemeral sandbox.

**Fix:** The only path to GitHub is: sandbox → zip → user downloads → user runs PowerShell → user pushes. This is documented in DEPLOY_PROCEDURE.md and must be followed every time.

### Gotcha #6: TypeScript errors masked by parser failures (bitten 2026-06-26)

**Symptom:** Build fails with "Parsing ecmascript source code failed" pointing at line 20 (`export abstract class`), but the real error was a duplicate `});` on line 149.

**Root cause:** Turbopack's parser can't recover from brace mismatches and reports the error at a misleading location.

**Fix:** When the build fails with a parser error, search for brace/paren mismatches BEFORE trusting the line number in the error message.

### Gotcha #7: Per-container pointerdown + global pointerdown = double-fire (bitten 2026-06-26)

**Symptom:** Anagram typing "apple" produced "appll" (double letters).

**Root cause:** Phaser containers with `setInteractive()` fire BOTH the container's `pointerdown` handler AND the global `input.on('pointerdown')` handler for the same event.

**Fix:** Don't register per-container `pointerdown` handlers. Use only the global `setupGlobalPointer` handler in BaseEngine. Add debounce + `tile.placed` guards as defense in depth.

### Gotcha #8: Zip file not downloaded by user (bitten 2026-07-03)

**Symptom:** User runs `Expand-Archive` → "The path either does not exist or is not a valid file system path." Then `git add .` → "nothing to commit, working tree clean."

**Root cause:** The zip file in the sandbox `download/` folder must be downloaded by the user via the chat interface's download mechanism. If the user doesn't click the download link/button, the file never reaches their Downloads folder.

**Fix:**
1. Clean up ALL old zips from `download/` folder before creating a new one (prevents confusion)
2. Use a simple, memorable filename (e.g., `ministar-latest.zip`)
3. Explicitly tell the user to click the download link/button in the chat to save the file to their Downloads folder
4. Verify the file exists before running `Expand-Archive`:
   ```powershell
   Test-Path "$env:USERPROFILE\Downloads\ministar-latest.zip"
   ```
5. If the test returns False, the download didn't happen — re-download from the chat.

---

## 4. HARD CONSTRAINTS (from user, 2026-07-03 — VERBATIM, do not paraphrase)

> You are working ONLY inside the Drewsure/ministar-lab repository.
>
> You are building prototype game modules for the future Living Textbook platform. You are NOT allowed to change repository architecture, auth, deployment, database, tenant model, package manager, or global app shell unless explicitly asked.
>
> Your output must be isolated prototype code and documentation only.

Hard constraints:

1. Do not hard-code MiniStar as the only possible tenant.
2. All learner-facing text must have audio support.
3. Prefer tap/click text to hear it.
4. If text is also an action button, add a separate listen/replay control.
5. Games must accept JSON-style input data.
6. Games must emit standard event objects:
   - game_started
   - round_shown
   - answer_submitted
   - answer_result
   - game_completed
   - mastery_updated
7. Games must support 8-12 vocabulary terms.
8. Games must support exactly 2 target sentence structures.
9. Mobile layout must work first.
10. No premium visual polish before clean layout and component structure.
11. Do not introduce gambling-like reward mechanics.
12. Do not import public code/assets unless license, source URL, and commercial-use status are documented.

Create a short README for every prototype explaining:
- input JSON shape
- emitted events
- scoring logic
- audio behavior
- mobile layout assumptions
- known limitations
- integration notes for future LivingTextbook migration

### Drama / Antagonist requirement (added 2026-07-03)

**Every game must have dramatic tension — an antagonist, opposition, or pressure mechanic against which the challenge is built.** A game without opposition is a worksheet, not a game.

| Game type | Required antagonist/opposition |
|---|---|
| Maze Chase | Chasing enemies (Pac-Man ghosts) that pursue the player |
| Airplane | Obstacles (clouds, birds) that slow or block the player |
| Endless Runner | Speed ramp + obstacles in wrong lanes |
| Physics Puzzler | Limited ammo + moving targets (time pressure) |
| Snake | Walls + self-collision + shrinking on wrong eat |
| Quiz / Gameshow | Timer countdown (tension) + wrong-answer penalties |
| Memory Match | Timer + move counter (efficiency pressure) |
| Whack-a-Mole | Mole stay-time decreases per level (speed pressure) |
| Balloon Pop | Balloon rise speed + carrier movement |
| Spot It | Timer + speed bonus (competition with self) |
| Anagram | Timer + hint penalty |
| Word Search | Timer |
| Bridge Builder | Limited wrong guesses (hangman mechanic) |
| Crossword | Timer |
| Flash Cards | Deck countdown + known/review sorting |
| Spin Wheel | Timer |
| Group Sort | Timer |
| Type Answer | Timer |
| Label It | Timer + wrong-answer lockout |
| Speak It | Timer + speech recognition accuracy |
| Training Academy | Timer + command queue |
| Rescue Quest | Obstacle sequence + timer |
| Match Up | Timer |
| Vocab Tap Match (prototype) | Timer + streak pressure |
| Sentence Builder (prototype) | Timer |
| Fill in the Blank (prototype) | Timer + retry shame-free |
| Quiz / TF (prototype) | Timer + streak |

**Check every build:** Does the game have a clear antagonist or pressure mechanic? If not, it's a defect. A timer alone is minimum. Physical enemies (chasers, obstacles) are required for action games.

**The drama curve must be visible:**
- Early game: low pressure, player learns mechanics
- Mid game: pressure ramps (faster enemies, shorter timers, more obstacles)
- Late game: peak tension (close calls, near-misses, urgency)
- Win/loss: clear resolution with stakes-appropriate feedback

---

## 5. PROTOTYPE ARCHITECTURE

### Directory structure

```
prototypes/
├── README.md                          ← overview + all 12 constraints
├── _shared/
│   ├── prototype-framework.js         ← event emitter + audio bus + input validator + mastery tracker
│   └── sample-data.json               ← example input (10 fruit terms, 2 sentence structures)
├── 01-vocab-tap-match/
│   ├── README.md                      ← 7 required sections
│   ├── index.html                     ← standalone, no build step
│   ├── game.js                        ← game logic
│   └── sample-data.js                 ← sample data as JS for standalone testing
└── 02-.../                            ← future prototypes
```

### Shared framework (`_shared/prototype-framework.js`)

Exposes `window.LTB` with:

| Class | Purpose |
|---|---|
| `LTB.EventLogger` | Emits 6 standard events with timestamps + session token |
| `LTB.AudioBus` | TTS (Web Speech API) + optional audio URL playback |
| `LTB.InputValidator` | Validates JSON input (8-12 terms, 2 structures, required fields) |
| `LTB.MasteryTracker` | Per-term mastery (0.0-1.0), emits `mastery_updated` |
| `LTB.UI` | Mobile-first CSS, `makeSpeakable()`, `makeListenButton()`, `shuffle()` |

### Standard event payload shapes

See `prototypes/01-vocab-tap-match/README.md` section 2 for full payload examples.

### Mastery logic (no gambling)

- Correct answer → mastery += 0.15 (capped at 1.0)
- Incorrect answer → mastery -= 0.10 (floored at 0.0)
- No loot boxes, no random rewards, no currency

---

## 6. EXISTING APP ARCHITECTURE (do not modify without explicit ask)

### Stack
- Next.js 16.1.3 (Turbopack) + TypeScript + Tailwind + shadcn/ui
- Phaser 3.80.1 for game scenes (in `src/game/`)
- Prisma ORM (in `prisma/`)
- xAPI telemetry (in `src/lib/telemetry.ts`)

### Key files (existing — not prototypes)
- `src/app/page.tsx` — main app shell (student + teacher views, game library, game launcher)
- `src/game/BaseEngine.ts` — abstract base class for all Phaser game scenes
- `src/game/Juice.ts` — particle effects, screen shake, HUD, mascot
- `src/game/scenes/*.ts` — 24 game scene files
- `src/lib/audio.ts` — WebAudio SFX bus + TTS
- `src/lib/gameModes.ts` — game mode registry (24 modes)
- `src/lib/themes.ts` — 10 theme manifests

### Build commands
```bash
npm run build              # Next.js production build (Turbopack)
npx tsc --noEmit --skipLibCheck   # TypeScript check (excludes examples/ and skills/)
```

---

## 7. SESSION LOG (append-only)

### 2026-07-04 — Session: 2-hour autonomous build (freeze fix + prototype migration + drama + pause)

**Delivered:**
- Removed ALL 31 infinite tweens (`repeat: -1`) → replaced with `repeat: 999` (finite)
- Simplified `showLevelUp()` — removed zoomPunch + glowRing + confettiRain
- Added scene shutdown/destroy listeners → killAll + removeAllEvents
- Added GameObject.destroy override → killTweensOf before destroy
- Migrated Prototype 01 from Schema A to Schema B + speakWithCues + retry
- Fixed Prototype 03 critical defect — explicit answers array
- Fixed Prototype 04 critical defect — implemented questions override
- Added pause/quit button overlay to all 24 games
- Added near-miss dramatic feedback to MazeChase
- Added safePulse + safeSpin timer-based animation helpers

**Pushed by user:** Pending

### 2026-07-03 — Session: Quiz / True-False prototype (Prototype 04)

**Delivered:**
- Built Prototype 04: Quiz / True-False with start screen + 2 modes (Multiple Choice + True/False)
- Question generator (`questions.js`) derives MC + TF questions from pedagogical_payload
  - MC: "A cat says meow." → "Which word goes with: 'says meow'?" → answer: cat
  - TF: "A cat says meow." → True version + "A dog says meow." (false version with swapped subject)
- Verified both modes in headless browser — all 6 events fire correctly
  - MC mode: game_started → round_shown (mc-0) → answer_submitted → answer_result → mastery_updated → round_shown (mc-1)
  - TF mode: round_shown (tf-true-0) with "True or False: A cat says meow."
- Wrote 7-section README with LivingTextbook Selection parent engine mapping
- Updated `prototypes/README.md` index

**Key design decisions:**
- Start screen with mode selection (MC / TF) — each mode button has separate 🔊 listen button
- Question generator is overrideable — host app can provide explicit questions array
- `engine_id: "selection"` in unit_meta signals this belongs to the Selection parent engine family
- Child-safe feedback: "That is right!" / "Not quite. Try again." — no shame language
- Distractors deterministic (first 3 vocab words that aren't the answer, then shuffled)
- TF false-statement generation: swaps subject with first different vocab word

**Learned:**
- Start screen with mode selection is a clean UX for multi-mode games
- Question generation from target sentences works well for simple SVO sentences
- The Selection engine family now has 3 prototypes (01, 03, 04) — good candidate for parent engine extraction
- README's "Mapping to Selection Parent Engine" section documents the family relationship clearly

**Pushed by user:** Pending

### 2026-07-03 — Session: Fill in the Blank prototype (Prototype 03)

**Delivered:**
- Built Prototype 03: Fill in the Blank (verified working in headless browser — all 6 events fire correctly, 2 target sentences with {blank} placeholder presented in sequence)
- Answer derivation: compares {blank} sentence to full sentence in audio_cues (kind="sentence") to extract the correct word
- Shame-free retry language: "Not quite. Try again." (never "wrong", "fail", "incorrect" in UI)
- Wrote 7-section README for Prototype 03
- Updated `prototypes/README.md` index

**Key design decisions:**
- Reuses Schema B (same as Prototype 02) with one addition: `{blank}` placeholder in target_sentences
- Answer derived from audio_cues (kind="sentence") by regex matching before+after the blank
- Distractors are deterministic (first 3 vocab words that aren't the answer) per constraint #11
- Shame-free feedback: UI says "Not quite. Try again.", event payload uses neutral `isCorrect: false`
- Choice buttons have separate 🔊 listen buttons (constraint #4)
- Sentence has separate 🔊 listen button that speaks the FULL sentence (answer filled in)

**Learned:**
- {blank} placeholder is a clean way to mark the missing word in target sentences
- Answer derivation from audio_cues works well but requires the host app to provide matching sentence cues
- Shame-free language is both a UI text concern AND a spoken audio concern
- User ran `Start-Process` before downloading — need to make sure the download-extract-push-test order is clear in instructions

**Pushed by user:** ✅ YES — commit `6e529f7` on `main` (2026-07-03)
- 6 files changed, 1018 insertions(+), 2 deletions(-)
- Prototype 03 + updated prototypes/README.md + updated BUILD_REFERENCE.md all live
- User verified by opening the prototype in browser via `Start-Process`

### 2026-07-03 — Session: Sentence Builder prototype + framework extension

**Delivered:**
- Extended `_shared/prototype-framework.js` with:
  - `InputValidator.validateSentenceBuilder()` — validates the new schema (unit_meta + pedagogical_payload + audio_cues)
  - `AudioBus.speakWithCues()` — looks up audio_cues by text+kind, falls back to TTS with language
  - `AudioBus.speak()` now accepts `opts.lang` for multi-language TTS
- Built Prototype 02: Sentence Builder (verified working in headless browser — all 6 events fire correctly, 2 target sentences presented in sequence)
- Wrote 7-section README for Prototype 02
- Updated `prototypes/README.md` index with both schemas documented

**Key design decisions:**
- New schema uses plain strings for vocab/sentences (not objects with IDs) — matches the "Greetings" unit format
- Mastery keyed by `"sentence-<roundIndex>"` since schema has no term IDs
- Distractors are deterministic (first N from vocab, not random) to keep scoring deterministic per constraint #11
- Word tiles have separate 🔊 listen buttons (constraint #4: tiles are action buttons + tap-to-speak)
- Submit button has separate 🔊 listen button

**Learned:**
- Two valid input schemas now coexist — framework supports both via separate validators
- audio_cues lookup by text+kind is a clean abstraction for "prefer pre-recorded, fall back to TTS"
- Punctuation-attached words ("Hello," "teacher.") are pedagogically intentional tokens

**Pushed by user:** ✅ YES — commit `ad83062` on `main` (2026-07-03)
- 13 files changed, 2988 insertions(+), 1 deletion(-)
- Both prototypes (01 + 02) + shared framework + hydration fix + BUILD_REFERENCE.md all live
- Vercel auto-deploying

### 2026-07-03 — Session: Prototype pivot + hydration fix

**Delivered:**
- Created `prototypes/` directory isolated from `src/`
- Built shared framework (`_shared/prototype-framework.js`) with event emitter, audio bus, input validator, mastery tracker
- Built Prototype 01: Vocab Tap Match (verified working in headless browser — all 6 events fire correctly)
- Wrote README with all 7 required sections
- Fixed hydration error in `src/app/page.tsx` (localStorage read during SSR → mounted guard pattern)

**Learned:**
- Python is not installed on user's machine — use `Start-Process` to open HTML files
- Browser caches zip downloads — must use unique filenames per delivery
- User's 12 hard constraints supersede the previous "AAA game polish" directive

**Pushed by user:** Pending (waiting for "pushed" confirmation)

### 2026-06-26 — Session: Full game audit + crash guards

**Delivered:**
- Fixed build-breaking syntax error in `BaseEngine.ts` (duplicate `});`)
- Fixed 11 TypeScript errors across 6 scene files
- Added runtime crash guards (BaseEngine update loop, Juice.confettiRain, MazeChase update)
- Fixed Memory Match TTS (speak prompt synchronously, not in delayedCall)
- Fixed Match Up number-badge tap-to-speak
- Verified all 7 arcade games wired into GameCanvas + library registry

**Learned:**
- Turbopack parser errors point at misleading line numbers when braces mismatch
- Phaser per-container `pointerdown` + global `pointerdown` = double-fire
- Mobile browsers block TTS not triggered directly by user gesture

### 2026-06-23 — Session: DEPLOY_PROCEDURE.md established

**Delivered:**
- Established canonical delivery procedure (zip + ONE PowerShell block)
- Documented user environment (Windows, PowerShell, repo path, GitHub details)

**Learned:**
- Git bundles fail when local history doesn't match
- User wants ONE path, not options A/B/C
- Don't suggest manual unzip instructions (too many steps)

---

## 8. REMINDERS FOR THE AI

When starting a new session:
1. **Read this file first** (`BUILD_REFERENCE.md`)
2. **Read `AA_BUILD_REVIEW_PROTOCOL.md`** — mandatory for every build and every build review. Phases 0-5 with 4B (Production) and 4C (Engagement) mandatory.
3. **Read `DEPLOY_PROCEDURE.md`** for the delivery procedure
4. **Check the session log** (section 7) for recent context
5. **Clean up ALL old zips** before creating a new one — use `rm -f download/ministar-*.zip`
6. **Use the simple filename** `ministar-latest.zip` (not timestamps)
7. **ALWAYS provide a download button/link in the chat** for the zip file — the user cannot access the sandbox filesystem directly. Without the download button, the delivery fails.
8. **Don't suggest Python** — it's not installed
9. **Don't read localStorage during SSR** — use the mounted guard pattern
10. **Speak on user interaction, not on load** — TTS requires a gesture
11. **Follow the 12 hard constraints** (section 4) for all prototype work — verbatim, do not paraphrase
12. **Write the 7-section README** for every prototype
13. **Append to the session log** at the end of each session
14. **Every build review must produce a `BUILD_REVIEW_<commit>.md` report** following the AA protocol. No verbal "looks good" — produce the structured Phase 5 report.

When the user says "ship it" / "deploy" / "push":
1. Clean up old zips: `rm -f download/ministar-*.zip`
2. Create `download/ministar-latest.zip`
3. **Provide a download button/link in the chat** for the zip file (MANDATORY)
4. Paste the ONE PowerShell block (with `Test-Path` verification)
5. Add the password note
6. Stop. No alternatives. No options.
