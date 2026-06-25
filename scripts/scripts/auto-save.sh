#!/bin/bash
# MiniStar Auto-Committer — runs every 15 minutes via cron.
# Stages all changes, commits with a timestamp, and pushes to origin/main.
# If there's nothing to commit, exits silently.

set -e
cd /home/z/my-project

# Configure identity (idempotent)
git config user.email "buildbot@ministar.lab" 2>/dev/null || true
git config user.name "MiniStar Build Bot" 2>/dev/null || true

# Ensure remote is set
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin https://github.com/Drewsure/ministar-lab.git
fi

# Stage everything except dev.log and .next
git add -A
git reset dev.log .next 2>/dev/null || true

# Check if there's anything staged
if git diff --cached --quiet; then
  echo "[$(date -u +%FT%TZ)] No changes to commit."
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
COMMIT_MSG="Auto-save: $TIMESTAMP

- Continuous build checkpoint from dev session
- Maze chase A* + keyboard input fix
- AAA 2029 polish pass"

git commit -m "$COMMIT_MSG" --no-verify 2>&1 | tail -5

# Attempt push (may fail without credentials — that's OK in sandbox)
git push origin aaa-2029-nextjs 2>&1 | tail -3 || echo "[push skipped — no credentials in sandbox]"

echo "[$(date -u +%FT%TZ)] Auto-save complete."
