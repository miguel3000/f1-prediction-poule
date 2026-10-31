#!/bin/sh
# Cron job script: weekend flags. Reads the FIA decision documents and emails the owner what
# probably changes predictions. Does nothing outside the window before a main race.

LOCK=/tmp/check-fia-documents.lock
# A run can take a while on the first pass of a weekend; never run two at once.
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "[$(date)] FIA documents check skipped: the previous run is still going" >> /var/log/cron.log
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

cd /app
timeout 480 node dist/scripts/checkFiaDocuments.js >> /var/log/cron.log 2>&1
