# MiniStar Lab — Deployment Procedure Memory

> **Purpose:** Remind the AI assistant how to deliver code updates to the user.
> User confirmed this is the preferred method on 2026-06-23. DO NOT change it.

---

## ✅ THE WAY TO DELIVER CODE UPDATES (DO THIS EVERY TIME)

### Step 1: Create a zip of the source

```bash
cd /home/z/my-project
zip -r download/ministar-src-clean.zip \
  src/ public/ prisma/ scripts/ \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs \
  Caddyfile vercel.json .gitignore \
  PERSISTENCE_GUARD.md \
  -x "node_modules/*" ".*"
```

### Step 2: Give the user ONE PowerShell block (WITH BUILT-IN VERIFICATION)

The PowerShell block MUST include the verification script check. It runs
`scripts/verify-aaaa-features.sh` via Git Bash BEFORE pushing. If verification
fails, the push is BLOCKED. This prevents deploying broken/regressed code.

Paste this exact format (no variations, no alternatives):

```
Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-src-clean.zip" -DestinationPath C:\Users\User\ministar-lab -Force
cd C:\Users\User\ministar-lab
git add .
git commit -m "<descriptive message>"
$result = & "C:\Program Files\Git\bin\bash.exe" -c "cd /c/Users/User/ministar-lab && bash scripts/verify-aaaa-features.sh 2>&1"
Write-Host $result
if ($result -match "ALL CHECKS PASSED") {
    Write-Host "✅ Verification passed — pushing to GitHub..." -ForegroundColor Green
    git push
    Start-Process "https://ministar-lab.vercel.app"
} else {
    Write-Host "❌ Verification FAILED — deployment blocked. Check the output above." -ForegroundColor Red
}
```

### Step 3: Add a one-line note about the password

```
If `git push` asks for password: username = Drewsure, password = GitHub PAT from https://github.com/settings/tokens (classic, repo scope)
```

### Step 4: ALWAYS include the Vercel URL

The PowerShell block MUST contain:
```
Start-Process "https://ministar-lab.vercel.app"
```
This opens the live application after push so the user can verify immediately. NEVER omit this line.

### Step 5: ALWAYS run verification on the AI server BEFORE packaging the zip

Before creating the zip, the AI MUST run:
```bash
bash scripts/verify-aaaa-features.sh
```
If ANY check fails on the AI server, the AI MUST fix it BEFORE packaging.
NEVER ship a zip that doesn't pass verification on the AI server.

---

## 🛡️ VERIFICATION IS MANDATORY

The `scripts/verify-aaaa-features.sh` script checks 113 AAAA features across:
- BaseEngine.ts (pause system, makeHoverSpeakable, auto-mascot, sticker book, slow mode)
- KidsJuice.ts (celebrateCorrect, confettiRain, 7-layer fanfare)
- audio.ts (onStart/onEnd TTS callbacks)
- page.tsx (🐢 Slow + ⏱️ Time+ toggles)
- ALL 32 games (speakPromptWithHighlight + makeHoverSpeakable coverage)
- Quiz (Living Storybook), Gameshow (Supercharged Spectacle), Airplane (storm clouds), Snaking (AAAA letter snake)
- Pacing fixes (7 timed games)
- Hyper-focus 150s window (HUD timer + 29 maxQuestions caps)

**If verification fails, the deployment is BLOCKED.** This is non-negotiable.
The verification script is the AI's responsibility to maintain and pass —
not the user's job to debug.

---

## ❌ DO NOT DO THESE (caused friction on 2026-06-23)

- ❌ Git bundles (`.bundle` files) — fail when local history doesn't match
- ❌ Multiple "options" (Option A/B/C, "if this then that") — user wants ONE path
- ❌ Manual unzip instructions ("drag and drop in Explorer") — too many steps
- ❌ Force-push commands without context
- ❌ Branch-switching commands (`git checkout -b ...`) when not needed
- ❌ Rebase commands
- ❌ `--allow-unrelated-histories` workarounds

---

## 📝 User's Environment

- **OS:** Windows (PowerShell)
- **Repo path:** `C:\Users\User\ministar-lab`
- **Branch:** `main` (NOT `aaa-2029-nextjs` — that was a sandbox-only branch)
- **GitHub:** `https://github.com/Drewsure/ministar-lab.git`
- **GitHub username:** `Drewsure`
- **Auth:** GitHub Personal Access Token (classic, `repo` scope)
- **Deployment:** Vercel auto-deploys on push to `main`

---

## 🎯 Why this works

1. `Expand-Archive -Force` overwrites existing files silently — no prompts
2. `git add .` stages all changes (new + modified + deleted)
3. `git commit -m "..."` creates one clean commit
4. `git push` uploads to GitHub → Vercel auto-deploys

Total user effort: paste one block. Done.

---

## 📦 File Naming Convention

Always name the zip `ministar-src-clean.zip`. User knows this name. Don't invent new names.

If a previous zip exists, overwrite it:
```bash
rm -f download/ministar-src-clean.zip
# then create the new one
```

---

## 🔁 Reminder for the AI

When the user says "ship it" or "deploy" or "push to GitHub":
1. Run `bash scripts/verify-aaaa-features.sh` on the AI server — if ANY check fails, FIX IT FIRST
2. Run the zip command (include `PERSISTENCE_GUARD.md` in the zip)
3. Paste the ONE PowerShell block WITH built-in verification (the block that runs `verify-aaaa-features.sh` via Git Bash before pushing)
4. Add the password note
5. Stop. No alternatives. No options. No essays.

The PowerShell block MUST include the verification check. NEVER give the user a plain
`git push` block without the verification wrapper. The verification is the AI's job,
not the user's. The user just pastes the block — the script does the checking.

That's it. That's the whole procedure.
