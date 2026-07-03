# MiniStar Lab — Push the AAA 2029 Next.js Version to GitHub

## The Situation

Your GitHub repo (`Drewsure/ministar-lab`) currently contains an older **Vite + JavaScript** build (18 commits, last updated June 20). The sandbox contains a complete **Next.js 16 + TypeScript AAA 2029 rewrite** with:
- 12 game engines (vs 2 in the old version)
- 8 themes (vs 4 in the old version)
- All bugs fixed (Maze Chase, Airplane, Anagram, Bridge Builder, Wordsearch, Memory Match)
- shadcn/ui + Tailwind + Prisma + xAPI telemetry + LLM authoring

These are **two completely separate codebases**. Pushing the new version to `main` would wipe out the Vite version. To keep both, push the new version as a **new branch**.

## Step-by-Step Push Instructions

### 1. Download the bundle
Download `ministar-lab-aaa-2029.bundle` (11 MB) from the download folder.

### 2. On your local machine, in a fresh terminal:

```bash
# Clone your existing GitHub repo
git clone https://github.com/Drewsure/ministar-lab.git
cd ministar-lab

# Fetch the AAA 2029 branch from the bundle
git fetch /path/to/downloaded/ministar-lab-aaa-2029.bundle aaa-2029-nextjs:aaa-2029-nextjs

# Push the new branch to GitHub
git push -u origin aaa-2029-nextjs
```

### 3. Verify on GitHub
- Visit https://github.com/Drewsure/ministar-lab
- Click the branch dropdown — you should see both `main` (Vite) and `aaa-2029-nextjs` (Next.js)
- The `aaa-2029-nextjs` branch has all 8 sandbox commits

### 4. (Optional) Switch Vercel to the new version
- Go to your Vercel project settings
- Under "Git → Production Branch", change from `main` to `aaa-2029-nextjs`
- Vercel will rebuild automatically (~2 minutes)
- https://ministar-lab.vercel.app/ will now serve the AAA 2029 version

### 5. (Optional) Make it the new main
Once you've verified the new version works on Vercel, you can promote it:
```bash
git checkout aaa-2029-nextjs
git merge main --strategy ours --no-edit  # keep Next.js version, ignore Vite version
git checkout main
git merge aaa-2029-nextjs --ff-only
git push origin main
```
This preserves the commit history but makes Next.js the canonical main.

---

## What's in the `aaa-2029-nextjs` branch (8 commits)

```
1c17668 Auto-save: 2026-06-21 09:19 UTC   ← latest (crossword + bundle)
d75b2be Auto-save: 2026-06-21 09:19 UTC   ← crossword engine added
17b621a Auto-save: 2026-06-21 09:16 UTC   ← 4 new themes + bug fixes
64907c3 Auto-save: 2026-06-21 09:13 UTC   ← memory match + wordsearch + bridge builder fixes
9cc2998 Auto-save: 2026-06-21 09:01 UTC   ← anagram + airplane + maze chase fixes
56010a8 Auto-save: 2026-06-21 09:01 UTC   ← maze chase A* + smart AI
e53b918 Initial sandbox commit
ad5e28a Initial commit
```

## After you push

Once you've pushed the `aaa-2029-nextjs` branch, please reply here with "pushed" — I'll then:
1. Set up the auto-saver to push future commits to that branch automatically (still needs a GitHub Personal Access Token from you)
2. Continue building the remaining 7 game templates from the research roadmap (Flash Cards, Spin Wheel, Group Sort, etc.)

## Quick Token Setup (for auto-push)

If you want the sandbox to push automatically every 15 minutes without manual bundle downloads:

1. Go to https://github.com/settings/tokens
2. Generate a new classic token with `repo` scope only
3. Paste the token back to me here
4. I'll wire it into the auto-saver — every commit will then auto-push to `aaa-2029-nextjs`
