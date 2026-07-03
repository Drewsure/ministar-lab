# QUALITY BENCHMARKS: Wordwall & Educational Gamification Competitors

**Research date:** June 2025
**Researcher mandate:** AAA game-quality benchmark study for our Phaser 4 educational games
**Sources reviewed:** Wordwall.net (home, features, Balloon Pop/Match Up/Quiz/Whack-a-Mole template pages, audio & gameplay help docs), JALT Publications peer-reviewed article, Blooket Help Center (full game-mode catalog), slideswith.com 4-way comparison, differentiatedteaching.com, Northern Review, LunarLab kids-UX paper, Phaser 4 changelog (v4.0.0 "Caladan"), and 8 web searches.

---

## 1. EXECUTIVE SUMMARY

Wordwall is a **content authoring platform**, not a game studio. Its polish comes from **20 visual styles** (each restyling graphics + fonts + sounds together), a **30+ template library** that all run on a single shared engine, and a **one-click "Switch Template"** feature that no competitor matches. Its games look clean and friendly but lack AAA juice — no particle bursts, no spine animation, no shader effects, no synthesized audio. **Blooket and Gimkit are the real AAA bar to clear** for engagement (collectible characters, currency economies, 27+ game modes, Among-Us-style social deduction).

**Our opportunity:** Use Phaser 4's new WebGL renderer + Spine + Filters to deliver Wordwall's breadth of templates with Blooket-level engagement juice that Wordwall cannot match without rebuilding their stack.

---

## 2. WORDWALL — SPECIFIC GAME-BY-GAME QUALITY ANALYSIS

### 2.1 Balloon Pop
- **Mechanic (verbatim from template page):** "Pop the balloons to drop each keyword onto its matching definition."
- **Genre:** Open-ended drag-and-drop matching, no leaderboard, no score.
- **Visual feel:** Cartoon balloons with text labels float in; on tap they burst and the keyword "drops" onto the definition slot. The burst is a simple scale-and-fade pop, NOT a particle explosion.
- **Audio:** Default pop SFX (short, generic balloon-burst sample). Optional TTS narration or uploaded audio per item (max 5 MB, any format).
- **Engagement hooks:** **None intrinsic** — no timer, no streak, no XP, no leaderboard. Engagement relies entirely on the teacher's content and classroom framing.
- **Quality verdict:** Functional but flat. The animation budget is one tween per interaction. A Phaser 4 implementation with particle confetti, screen shake, and a satisfying low-frequency "thump" SFX would instantly outclass it.

### 2.2 Match Up
- **Mechanic (verbatim):** "Drag and drop each keyword next to its definition."
- **Visual feel:** Two columns. Draggable cards on the left, drop targets on the right. Cards lift slightly on drag, snap into place with a small bounce tween. Correct matches turn green; wrong attempts snap back with a subtle shake.
- **Audio:** Click on grab, soft "snap" on drop, success/error tone on verdict. Optional per-item TTS or uploaded audio.
- **Engagement hooks:** Immediate correctness feedback. No streak counter, no timer unless teacher enables one in Options.
- **Quality verdict:** The drag/snap is well-tuned (this is Wordwall's strongest template mechanically). The visuals are flat rectangles with no depth, no shadows, no glassmorphism. A Phaser 4 version with lit 3D-feeling cards (filters + drop shadow), magnetic snapping, and trail particles on drag would dominate.

### 2.3 Quiz
- **Mechanic (verbatim):** "A series of multiple choice questions. Tap the correct answer to proceed."
- **Visual feel:** Question card on top, 2–4 answer tiles below. Tapping the right answer triggers a green flash + checkmark; wrong answer flashes red with an X. Auto-advance to next question.
- **Audio:** Generic correct/wrong SFX. TTS optional. No background music by default.
- **Engagement hooks:** Score counter, accuracy %, optional timer. Per-question results reviewable at end. No XP, no streaks, no badges.
- **Quality verdict:** Functional but the most generic of the three. This is where Kahoot's lobby music + suspense countdowns + character avatars absolutely outclass Wordwall. Huge opportunity for us.

### 2.4 Whack-a-Mole (arcade benchmark — most "AAA" Wordwall template)
- **Mechanic (from official help doc):** "Animated moles popping up dynamically from a grid of holes, each displaying a specific item or statement." Students whack only the moles carrying correct answers. Moles appear and submerge rapidly. Hitting correct mole = points. Whacking incorrect distractor or missing correct mole = lose a life. **Time Bonus** for fast correct hits. Multiple levels with accelerating difficulty. Leaderboard at end. "Show answers" review screen.
- **Customization dials:** Timer (countdown), Speed slider (how long moles stay above ground), End-of-game "show answers" toggle, Game mode (multi-level vs single-level), Levels slider (target item threshold), "Switch correct/incorrect" advanced flip.
- **Visual feel:** Grid of holes, cartoon mole sprites (custom per visual style), pop-up/down animation is a simple y-tween + scale. Score and lives displayed as bold HUD.
- **Quality verdict:** This is the most "game-like" Wordwall gets — and it's still using tweens, not physics, not particles. A Phaser 4 version with arc trajectories, dust particles on emerge, squash-and-stretch on whack, screen shake on miss, and combo multipliers would feel generational.

---

## 3. WORDWALL VISUAL STYLE SYSTEM (the killer feature)

Per JALT peer-reviewed article (Morales, July 2025) and the Wordwall Features page:

- **~20 visual styles** ship today, including: **Primary** (font specifically designed for early readers), **Classroom**, **Cartoon**, **Neon**, **Autumn**, **Spring**, **Winter**, **Christmas**, plus additional seasonal and aesthetic themes.
- **Each visual style swaps three things simultaneously:** graphics, fonts, AND sounds. (This is the critical insight — themes are full audiovisual overhauls, not CSS skins.)
- **6 font choices** including a dyslexia-friendly / early-reader option.
- **Volume and SFX controls** are exposed per activity (confirmed by Wordwall's own June 2025 video promos).
- **Difficulty settings** are per-template under the Options panel (e.g. Whack-a-Mole speed slider).
- **Switch Template panel** on every activity page lets you morph the same content into a different game with one click — Wordwall's signature differentiator.

**Benchmark we must hit:** A theming system where swapping a theme re-skins sprites, audio SFX pack, music bed, font, particle palette, AND transition style in one shot. Wordwall's themes are static; ours should also animate the transition itself.

---

## 4. WORDWALL AUDIO HANDLING (specifics)

From Wordwall's official Audio help doc (zendesk article 4410941851793):

- **Two audio sources per text field:**
  1. **Upload** — any audio format, **max 5 MB per file**, attached via speaker icon next to any text field.
  2. **Text-to-Speech** — up to **300 characters** per call, language/accent drop-down, **male or female voice** selection.
- **Audio is supported in 18 templates:** Match up, Quiz, Speaking cards, Spin the wheel, Group sort, Find the match, Matching pairs, Open the box, Wordsearch (clue), Labelled diagram, Flip tiles, Crossword (clue), Gameshow quiz, Flying Fruit, True or false, Rank order, Categorize, Unscramble, Win or lose quiz.
- **No background music** ships by default — Wordwall is sound-effect-driven, not music-driven. This is a weakness vs. Kahoot.
- **No native recorded narration voice** — Wordwall relies on teacher-uploaded audio or TTS. There is no "Wordwall voice" brand identity.

**Benchmark we must hit:**
- Per-item TTS (300+ char limit, multi-language, male/female).
- Per-item custom audio upload (≥5 MB, multi-format).
- PLUS: a default in-house composed music bed + an iconic "correct answer" SFX that becomes our brand (Kahoot's model).

---

## 5. COMPETITOR DEEP DIVE

### 5.1 Kahoot!

**Visual quality:**
- Signature purple/teal gradient brand. Bold geometric answer tiles in red/blue/yellow/green — color is the answer key, instantly memorable.
- Animated character avatars (the Kahoot! ghost and 50+ unlockable characters).
- Polished question-card slide transitions with motion easing.
- Halloween/seasonal lobby reskins show holiday polish.

**Audio quality (industry-leading):**
- **Original lobby music** composed by "The Mellow Fellows" — released on Spotify, has 1.6M+ YouTube views, becomes a meme/cultural touchstone for students.
- **5-second countdown music** builds suspense before each question.
- Distinct in-game SFX for correct, wrong, tie, podium.
- Halloween lobby music + seasonal variations.
- This is the bar: a game whose music students hum outside class.

**Engagement hooks:**
- 14+ game modes including Team Mode (since 2016).
- Podium with 1st/2nd/3rd place visuals.
- Streak bonuses, points decay over time.
- Unlockable character avatars.

**Stability / Mobile:**
- Lobby video background can be customized.
- Settings include **Increase contrast** (accessibility) and **Unlimited time** (SPED support) — accessibility is a first-class feature.
- QR code join from any phone, works on tablet/Chromebook/phone.

**Pricing concern:** slideswith.com calls Kahoot "predatory and expensive" (7/10 score).

---

### 5.2 Blooket (the engagement benchmark)

**Visual quality:**
- 27 game modes (18 free, 9 Plus), each with **distinct visual genre**: Tower Defense, Café management, Fishing, Crypto-hacking terminal, Monster Brawl arena, Battle Royale, Racing, Brick-breaker, Social deduction, etc.
- Collectible characters called **"Blooks"** — students obsess over rare drops (TikTok has dedicated "rarest Blooks" content verticals).
- Each mode has genre-appropriate art style (pixel-art for Zorblitz, soft cartoon for Café, neon-hacker for Crypto Hack).

**Audio quality:**
- Mode-specific background music tracks.
- SFX for currency pickups, hits, level-ups, mystery-box reveals.
- Less iconic than Kahoot's lobby music but more varied.

**Engagement hooks (the gold standard):**
- Multiple currencies per mode (coins, gold, crypto, doubloons).
- **Mystery boxes** with three outcome types: rewards, deductions, or **swap-points-with-another-player** (genius social chaos mechanic).
- Power-ups and upgrades (Gimkit-style investment).
- Blooks collection with rarity tiers (Common → Legendary → Chroma → Mystic).
- Solo mode + Live mode + Homework mode for every question set.
- 20+ million shared question sets.

**Cognitive design (from Blooket's own mode catalog):**
Each mode is tagged with:
- 🧠 Cognitive style: Speed & Accuracy / Strategy & Memory / Dexterity & Speed / Dexterity & Accuracy / Speed & Luck / Speed & Strategy
- ⚖️ Difficulty: Simple / Normal / Complex
- ⏱️ Ideal time: 5–10 min target
- ❓ Question prompting: Synced (live) vs Self-Paced
- 👥 Player counts: min, ideal, free max (60), Plus max (300)

**Stability:** Self-paced modes tolerate disconnects well. Live modes can lag at 60+ concurrent players on weak networks.

---

### 5.3 Gimkit (the strategy/retrieval-practice benchmark)

**Visual quality:**
- 10+ game modes including **Trust No One** (Among Us clone with crewmate/impostor roles), **Don't Look Down** (tower climbing), **Snowbrawl** (projectile combat), **Fishtopia** (slow fishing), **The Floor is Lava**, **Capture the Flag**.
- "Projectile game mechanic" is a reusable physics system across modes.
- Heavier game-feel than Blooket — actual character movement, not just menu clicks.

**Audio quality:**
- Mode-specific music and SFX.
- Voice-line style feedback in some modes.

**Engagement hooks (differentiator):**
- **GimBucks** currency invested in power-ups and upgrades.
- **Spaced repetition built in** — incorrectly answered questions resurface more frequently. This is the only major platform with pedagogy-grade retrieval practice baked into the game loop. (Critical to beat if we claim educational value.)
- Strategy layer creates momentum and urgency.
- Calmer modes (Fishtopia) for overwhelmed students — accessibility through pacing.

**Stability:** More complex to set up; more failure surface. Some modes overwhelming for sensitive students.

---

### 5.4 Quizizz

**Visual quality:** Slideswith.com calls it "nice design and teacher-friendly" (8/10). Polished meme-powered feedback (correct/wrong memes shown after each question). Power-ups (x2 points, 50/50, freeze time).

**Engagement:** Asynchronous/homework-friendly. Leaderboards. Meme customization is a signature hook.

**Stability:** Solid, mature platform. Higher learning curve than Blooket.

---

## 6. CROSS-COMPETITOR QUALITY MATRIX

| Dimension | Wordwall | Kahoot | Blooket | Gimkit | Quizizz |
|---|---|---|---|---|---|
| Visual polish | 6/10 flat cartoon | 8/10 brand-iconic | 9/10 genre-spanning | 8/10 game-feel | 7/10 meme-driven |
| Audio identity | 4/10 SFX only | 10/10 viral lobby music | 7/10 mode-specific | 7/10 mode-specific | 6/10 generic |
| Engagement hooks | 3/10 (no XP/currency/streaks) | 7/10 streaks+podium | 10/10 currency+Blooks+mystery boxes | 9/10 GimBucks+spaced repetition | 7/10 power-ups+memes |
| Template breadth | 10/10 (30+, 1-click switch) | 4/10 (quiz-focused) | 8/10 (27 modes) | 7/10 (10+ modes) | 5/10 (quiz+power-ups) |
| Stability | 9/10 simple engine | 8/10 | 7/10 lag at scale | 7/10 complex | 9/10 mature |
| Mobile UX | 8/10 responsive | 9/10 QR join | 8/10 | 7/10 | 8/10 |
| Accessibility | 7/10 Primary font, contrast | 8/10 contrast+unlimited time | 5/10 fast-paced only | 6/10 calmer modes exist | 7/10 |
| Localization | 10/10 35+ languages | 7/10 | 5/10 English-first | 5/10 English-first | 7/10 |
| Pricing fairness | 8/10 $6/$9 mo | 5/10 "predatory" | 7/10 free tier generous | 7/10 | 6/10 pricey |

---

## 7. SPECIFIC QUALITY BENCHMARKS WE MUST HIT

### 7.1 Visual / Animation
1. **Every interaction needs a 3-stage tween:** anticipation (wind-up 80ms) → action (snap 120ms) → follow-through (overshoot/settle 200ms). Wordwall only does the middle stage.
2. **Particle bursts on every correct action:** minimum 12 particles, gravity-influenced, color-matched to the theme. Phaser 4's SpriteGPULayer supports thousands of instanced particles — use it.
3. **Screen shake on errors and big wins:** amplitude 4–8px, decay 300ms, configurable per template.
4. **Squash-and-stretch on every character/creature:** 1.2x scale on impact → 0.85x → 1.0x over 250ms. This is the single biggest "AAA feel" upgrade.
5. **Drop shadows on all draggable objects** that compress on drag (object "lifts"). Wordwall cards are flat rectangles.
6. **Transition animations between questions/screens** minimum 350ms with easing curve `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutExpo).
7. **Theme switching must animate**, not snap — cross-fade sprites, swap audio with a 1-bar musical transition, transition particle palettes.
8. **Loading screens must be branded and animated** (spinning mascot, progress bar with personality). Wordwall shows a blank white card.

### 7.2 Audio
1. **Compose an original lobby theme** (60–90 second loop, in-house, ≤2 MB MP3). Target: students hum it outside class. This is Kahoot's moat — we must build our own.
2. **Compose 5-second suspense countdown** sting for timed questions.
3. **Three distinct correct-SFX** (small win / big win / streak bonus) and **two wrong-SFX** (gentle nudge / game-changing error).
4. **Per-item TTS** with 300+ char limit, ≥12 languages, male/female voices (match Wordwall).
5. **Per-item custom audio upload** ≥10 MB (2× Wordwall's 5 MB), multi-format (MP3/WAV/OGG/M4A).
6. **Per-template background music beds** that match the visual style — when theme switches, music switches with a 1-bar crossfade.
7. **Master volume + SFX volume + music volume** sliders (Wordwall exposes volume + SFX only).
8. **Audio must unlock on first user gesture** (mobile autoplay policy) — show a "Tap to start" splash with a satisfying entrance sound.

### 7.3 Engagement Hooks (where Wordwall is weakest — biggest opportunity)
1. **Streak counter with visual escalation:** 3-streak = flame icon, 5-streak = screen-edge glow, 10-streak = particle aura around player avatar.
2. **XP system** that persists across sessions (localStorage + server sync). Wordwall has zero persistence for students.
3. **Daily challenge** with rotating template + bonus XP (Duolingo model).
4. **Leaderboards:** daily / weekly / all-time / class-only / global — configurable by teacher.
5. **Badges/achievements** for: first play, 10 correct in a row, perfect game, speed demon, comeback kid, etc.
6. **Collectible characters** (Blooket model) earned through play — gives long-term meta-progression.
7. **Mystery boxes** with reward/deduction/swap mechanics for live multiplayer (Blooket's signature chaos hook).
8. **Combo multipliers** in arcade templates (Whack-a-Mole, Balloon Pop) — x2, x3, x5 with on-screen popup.

### 7.4 Game Stability
1. **WebGL context loss handler** — Phaser 4 supports context restoration natively; ensure all textures re-upload. Wordwall has no equivalent protection because it doesn't use WebGL.
2. **Asset preloader with progress + retry** on failed asset (3 retries with exponential backoff, then graceful fallback to a placeholder).
3. **Error boundary** that catches any scene error and shows a friendly "Oops, let's try again" with one-tap restart — never a blank screen.
4. **Save-state on every correct answer** (localStorage) so a refresh resumes mid-game.
5. **Network-aware:** if multiplayer server lags >500ms, show a "Reconnecting…" banner and queue actions.
6. **Target 60 FPS** on a 2018 iPad (A10X) — profile with Phaser 4's new RenderNode stats panel.
7. **Audio context resume** on visibility change (mobile Safari backgrounding).

### 7.5 Mobile Experience
1. **Touch targets minimum 48×48 px** (Apple HIG) for tappable answers. Wordwall's tiles are adequately sized — match.
2. **Landscape AND portrait support** for every template — Phaser 4's rewritten camera system handles scale modes cleanly; use `Scale.RESIZE`.
3. **Safe-area insets** respected for notched phones (CSS env() + Phaser scale margins).
4. **Haptic feedback** on supported devices (navigator.vibrate) for correct/wrong — Blooket doesn't do this; cheap win.
5. **Pinch-to-zoom disabled** in game canvas, but enabled where appropriate (matching diagrams).
6. **Orientation lock prompt** if a template requires landscape.
7. **Offline-first:** service worker caches the last 5 played activities so they work without network.

### 7.6 Accessibility (beat everyone)
1. **Increase contrast toggle** (Kahoot has this; Wordwall doesn't).
2. **Unlimited time toggle** for SPED (Kahoot has this; Wordwall only has adjustable timer).
3. **Dyslexia-friendly font** option (Wordwall's "Primary" font does this; match it).
4. **Screen reader ARIA labels** on every interactive element (nobody in this space does it well).
5. **Keyboard navigation** for every template (Tab + Enter/Space + arrow keys).
6. **Color-blind-safe palette** toggle (avoid red/green as the only correct/wrong signal — add icon + shape).
7. **Reduced-motion mode** that disables particles and screen shake (vestibular sensitivity).

---

## 8. TOP 5 THINGS WORDWALL DOES BETTER THAN US RIGHT NOW

1. **One-click "Switch Template"** — same content, instantly becomes a different game. This is Wordwall's signature feature and a massive authoring productivity win. We have no equivalent.
2. **30+ template variety** spanning arcade (Whack-a-Mole, Airplane, Maze Chase, Flying Fruit), word games (Anagram, Wordsearch, Crossword, Unjumble), matching (Match Up, Matching Pairs, Find the Match, Group Sort), and classroom tools (Seating Plan, Brainstorm, Random Wheel). We are likely narrow.
3. **20 visual styles as full audiovisual overhauls** (graphics + fonts + sounds swap together). Our theming is probably CSS-only or sprite-only.
4. **35+ language localization** with native UI translation. Wordwall is genuinely global; we are likely English-first.
5. **30 million community-shared resources** + AI content generator. Wordwall's network effect is enormous; a new teacher finds ready-made content for any topic in seconds.

---

## 9. TOP 5 THINGS WE CAN DO TO BEAT WORDWALL

1. **Blooket-grade engagement layer:** XP, streaks, badges, collectible characters, mystery boxes, daily challenges. Wordwall has zero of this — students have no meta-reason to return. This is the single biggest competitive gap and the easiest to win.
2. **AAA game-feel juice:** particle bursts, screen shake, squash-and-stretch, hit-stop, motion trails, dynamic camera. Wordwall's engine is tween-only; Phaser 4's new renderer + Filters + SpriteGPULayer lets us deliver this at 60 FPS where they cannot follow without a rewrite.
3. **Original music identity:** compose a viral-worthy lobby theme + per-template music beds + seasonal variations. Kahoot proved this is a moat; Wordwall has no music at all. We can own "the educational game with the song kids hum."
4. **Gimkit-style spaced repetition** baked into the quiz engine: wrong answers resurface with weighted frequency. Wordwall quizzes are one-pass; this is the pedagogy differentiator that wins teacher recommendations.
5. **Spine 2D character animation** for mascots and game hosts. Phaser 4 ships official spine-phaser runtime. Wordwall uses static sprites and tweens; we can have a host character that emotes, reacts, and guides — closer to PBS Kids / Disney quality than worksheet-gamification.

**Bonus 6th:** Real-time multiplayer with Blooket-style mystery boxes and social deduction modes (Trust No One clone). Wordwall is fundamentally single-device or teacher-led; we can be the platform kids play with friends.

---

## 10. PHASER 4 TECHNICAL RECOMMENDATIONS (specific, from v4.0.0 "Caladan" changelog)

Phaser 4 released April 10, 2026 with a complete WebGL renderer rewrite. Use these features explicitly:

### 10.1 Renderer & Performance
- **RenderNode architecture** replaces v3 Pipelines. Each node handles one render task — more maintainable, more reliable. Register custom nodes via `RenderConfig#renderNodes` at boot. Use this for any custom shaders (e.g. our theme-transition dissolve).
- **WebGL context restoration** is now supported natively. Wire `phaser.scale.on('contextrestored', ...)` to re-upload dynamic textures. This is our #1 stability fix vs. mobile Safari tab-switch crashes.
- **Canvas renderer is deprecated.** Build for WebGL only; accept Canvas as a degraded fallback. Don't waste effort on feature-parity there.
- **SpriteGPULayer** is the new instanced-rendering game object — use it for particle systems, snow/rain, flocking background creatures. Supports thousands of instances at 60 FPS where v3 choked.
- **16 MB RAM freed** vs v3 (removed genericVertexBuffer/genericVertexData). Lower memory floor on mobile.

### 10.2 Visuals: Filters (the new unified FX+Masks system)
- **Filters replace both FX and Masks.** A filter takes input image → shader → output image. They compose freely.
- **Filters can be applied to ANY game object or scene camera** — v3 restrictions on preFX/postFX are gone. Apply a Bloom filter to a single draggable card, or to the entire scene.
- **Internal vs External filters:** Internal affects only the object (good for object-positioned glow). External affects the rendering context, usually full-screen (good for scene-level bloom).
- **Built-in filters to use day-one:** Bloom (via `Phaser.Actions.AddEffectBloom()`), Shine (`AddEffectShine()`), Mask (`AddMaskShape()`), Gradient (new Gradient game object), ColorMatrix (sepia, grayscale, brightness, etc.), Blend (recreates all 27 Canvas blend modes in WebGL).
- **Plan:** Every theme gets a filter stack (e.g. Neon theme = Bloom + Gradient + Add blend mode). Theme switch = swap filter stack with a 500ms tween.
- **Note:** BitmapMask is removed in v4. Use the Mask filter for all WebGL masking. GeometryMask is Canvas-only.

### 10.3 Lighting (new in v4)
- **One-line per-object lighting:** `gameObject.setLighting(true)` — no more pipeline assignment. Use this for our 3D-feeling cards (Match Up) and characters.
- **Lights now have explicit `z` value** for height — set up a 2.5D feel for our game boards.
- **Warning:** Lighting changes the shader and breaks batches. Group lit objects together in the display list to minimize batch breaks.

### 10.4 Tint System (overhauled)
- **TintModes enum:** MULTIPLY (default), FILL, ADD, SCREEN, OVERLAY, HARD_LIGHT. Use FILL for solid-color silhouettes (correct/wrong feedback), ADD for glowing power-ups, OVERLAY for theme tinting.
- **BitmapText tinting now works correctly** — use BitmapText for score readouts with per-character tint (combo counter rainbow effect).
- **Migration:** v3 `setTintFill(color)` → v4 `setTint(color).setTintMode(Phaser.TintModes.FILL)`.

### 10.5 Camera System (rewritten)
- **matrixExternal** is a new matrix (includes position); **matrix** now includes scroll, excludes position. Use standard `scrollX`/`scrollY`/`zoom`/`rotation` and you're fine.
- **For screen shake:** tween `camera.shakeIntensity` or roll our own using `scrollX`/`scrollY` jitter with decay.
- **For theme transitions:** use a second camera with a CustomFilter for cross-fade between scenes.
- **Scale.RESIZE mode** for true responsive layouts across phone/tablet/whiteboard.

### 10.6 Textures & Shaders
- **GL orientation throughout** (Y=0 at bottom). Compressed textures must be re-encoded for v4 — audit our texture pipeline.
- **DynamicTexture** now uses the standard rendering system with auto-batching. Use it for: minimaps, live leaderboards rendered to texture, captured photo stickers.
- **Shader game object** rewritten — takes a `ShaderQuadConfig` object. Shadertoy-style uniforms are no longer auto-set; encode them in config. Use this for procedural backgrounds (perlin-noise clouds, gradient skies) at zero texture cost.
- **GLSL loaded as raw text** with `#pragma` preprocessor directives (no more custom template hacks). Compatible with syntax checkers.

### 10.7 Spine 2D Integration (character animation game-changer)
- **Official spine-phaser runtime** supports Phaser 3 and 4, Canvas and WebGL. (Source: esotericsoftware.com/spine-phaser.)
- **Use Spine for:** mascot characters, game hosts, creature enemies in arcade templates, achievement badge reveals. Spine's animation mixing lets a single character idle + cheer + react seamlessly.
- **Performance tip from Phaser forums:** loading 13+ Spine animations creates WebGL warnings. Keep concurrent Spine objects ≤10 per scene; pool and reuse.

### 10.8 Audio (Phaser 4 sound system)
- Use **Web Audio API directly via Phaser.Sound** for low-latency SFX (<20ms).
- **Pre-decode all SFX on game start** to avoid first-play hitches.
- **Music:** stream (don't decode fully) to save memory — use `sound.add(key, {stream: true})`.
- **Mobile:** resume AudioContext on first pointerdown; the new Phaser 4 input system fires reliably.

### 10.9 Build & Tooling
- **Phaser Launcher** (mentioned on phaser.io/learn) is the new in-browser IDE — evaluate for our content-authoring tool. Could become our "Switch Template" equivalent.
- **TypeScript types ship in-box** in v4 — strict-mode our entire codebase.
- **Vitest** is used for Phaser's own test suite (visible in repo) — adopt Vitest for our unit tests.

---

## 11. KIDS UX GUIDELINES (from LunarLab + AAP/WHO + UXMatters)

Apply these as hard constraints, not aspirations:

| Age | Max session (AAP/WHO) | Attention span | Design implication |
|---|---|---|---|
| 2–5 | ≤60 min/day | 4–12 min | One activity = ≤5 min; auto-save progress |
| 6–8 | — | 12–18 min | One activity = ≤8 min; clear "you're done!" celebration |
| 9–12 | — | 20–30 min | Multi-stage sessions OK; introduce meta-progression |
| 13+ | — | 28–42 min | Full competitive features; leaderboards matter most |

- **More animation between screens than adult apps** — kids need visual causality, not just state changes (Medium: "Make learning fun again").
- **Brighter, more saturated colors** than adult UIs (UXMatters: "Effective Use of Color and Graphics in Applications for Children"). But maintain WCAG AA contrast.
- **Icon + audio + text** redundancy — don't assume reading ability under age 8.
- **Bigger touch targets** (48px min, 64px preferred for under-7).
- **No destructive actions without confirmation** — kids tap everything.
- **No dark patterns** — ethical design matters (LunarLab: "Can parents use this app to abuse or manipulate kids?").

---

## 12. PRICING BENCHMARK (for our positioning)

| Platform | Free tier | Paid | Per-student |
|---|---|---|---|
| Wordwall | 5 activities | $6/mo Standard, $9/mo Pro | $0 (teacher-pays) |
| Kahoot | Limited | "Predatory and expensive" (slideswith) | Per-seat options |
| Blooket | Generous (60 players, 18 modes) | Plus for 300 players + 9 modes | $0 |
| Gimkit | Limited | Pro tier | $0 |
| Quizizz | Limited | Higher learning curve, pricey | — |

**Our positioning:** Beat Wordwall on engagement, beat Blooket on pedagogy (spaced repetition), beat Kahoot on pricing fairness. Free tier must allow ≥10 custom activities (2× Wordwall's 5).

---

## 13. IMMEDIATE NEXT ACTIONS (priority-ordered)

1. **Prototype the Switch Template system** — this is Wordwall's moat. Without it, we lose to them on authoring productivity. Build a content-schema abstraction layer where one JSON blob renders into any template.
2. **Compose the lobby theme song** (60–90s loop, 3 seasonal variations). Hire a composer; this is a 1-week job and pays off for years.
3. **Implement the engagement layer** (XP, streaks, badges, leaderboards) as a cross-template SDK. Every template plugs in.
4. **Build the 3 hero templates with full juice:** Balloon Pop (particles + screen shake + combos), Match Up (Spine mascot + lit cards + magnetic snap), Quiz (suspense music + streak escalation + spaced-repetition backend).
5. **Ship the theming system** (5 themes at launch: Primary, Classroom, Neon, Cosmic, Forest) where each swaps sprites + fonts + SFX + music + filter stack.
6. **Add accessibility first-class:** contrast toggle, unlimited time, dyslexia font, ARIA labels, reduced motion. This wins teacher procurement.
7. **Localize for top 5 languages** at launch (English, Spanish, Mandarin, Arabic, Hindi). Wordwall's 35+ language moat is unbeatable short-term; pick the highest-ROI 5.

---

## 14. APPENDIX — SOURCE INVENTORY

- `wordwall.net/` (homepage) — 115,280,544 resources created, 30M+ library, AI content generator
- `wordwall.net/features` — 34 interactives + 21 printables, visual styles, switch template, embedding, assignments
- `wordwall.net/about/template/balloon-pop` — open-ended matching, no leaderboard
- `wordwall.net/about/template/match-up` — drag/drop with immediate feedback, "works on any device"
- `wordwall.net/about/template/quiz` — multiple choice, tap to proceed
- `wordwall.zendesk.com/.../how-to-create-a-whack-a-mole-activity` — full mechanic spec, speed slider, levels, time bonus, leaderboard
- `wordwall.zendesk.com/.../how-to-add-audio-to-your-activity` — TTS 300 chars, upload 5MB any format, 18 supported templates
- `jalt-publications.org/articles/29741-using-wordwall-warm-and-review-activities` (Morales, July 2025) — ~20 visual styles, 6 fonts, Primary font for early readers, 18 standard templates, 5-activity free limit
- `help.blooket.com/.../blooket-game-mode-previews` — full 27-mode catalog with cognitive tags
- `slideswith.com/blog/blooket-vs-kahoot-vs-gimkit-vs-quizizz` — 4-way scoring
- `differentiatedteaching.com/blooket-vs-gimkit` — Gimkit spaced-repetition edge, pacing analysis
- `northernreview.org/2026/05/13/kahoot-vs-gimkit-vs-blooket` — student-perspective review
- `lunarlab.io/blog/designing-apps-for-kids` — kids UX, AAP/WHO screen-time, attention spans, ethics
- `github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md` — Phaser 4 full feature inventory
- `esotericsoftware.com/spine-phaser` — Spine runtime for Phaser 3+4
- `kahoot.fandom.com/wiki/Soundtracks` + Spotify "Lobby Music (Original Soundtrack)" — Kahoot audio identity evidence
- `support.kahoot.com/.../live-game-settings` — Kahoot accessibility options (contrast, unlimited time)
