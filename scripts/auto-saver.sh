#!/bin/bash
# Background auto-saver: runs the auto-save script every 15 minutes.
# Started in background; logs to /home/z/my-project/scripts/auto-saver.log

LOG=/home/z/my-project/scripts/auto-saver.log
INTERVAL=900  # 15 minutes in seconds

echo "[auto-saver] started at $(date -u +%FT%TZ), interval=${INTERVAL}s" >> "$LOG"

while true; do
  echo "[auto-saver] tick: $(date -u +%FT%TZ)" >> "$LOG"
  /home/z/my-project/scripts/auto-save.sh >> "$LOG" 2>&1
  sleep "$INTERVAL"
done
