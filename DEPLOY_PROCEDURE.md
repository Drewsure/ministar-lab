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
  -x "node_modules/*" ".*"
```

### Step 2: Give the user ONE-AT-A-TIME PowerShell steps

**CRITICAL (user override, 2026-07-05):** The user has explicitly and repeatedly
asked for **one-at-a-time steps** in the live chat. This OVERRIDES the previous
"one block" format below. From now on:

- Present each step as a **separate** numbered code block.
- Each step = **one** self-contained PowerShell command.
- Wait for the user to confirm before giving the next step.
- Format:

```
### Step 1 — <action>

```powershell
<single command>
```

### Step 2 — <action>

```powershell
<single command>
```

(etc.)
```

The previous format (chained commands in one block) caused confusion — the user
could not tell which command failed when an error appeared. One-at-a-time makes
each command's output unambiguous.

--- LEGACY FORMAT (DO NOT USE — kept for reference only) ---

Paste this exact format (no variations, no alternatives, no "options A/B/C"):

```
Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-src-clean.zip" -DestinationPath C:\Users\User\ministar-lab -Force
cd C:\Users\User\ministar-lab
git add .
git commit -m "<descriptive message>"
git push
```

### Step 3: Add a one-line note about the password

```
If `git push` asks for password: username = Drewsure, password = GitHub PAT from https://github.com/settings/tokens (classic, repo scope)
```

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
1. Run the zip command
2. Paste the ONE PowerShell block
3. Add the password note
4. Stop. No alternatives. No options. No essays.

That's it. That's the whole procedure.
