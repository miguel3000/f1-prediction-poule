#!/bin/sh
# Cron job script to email anyone who hasn't predicted yet, 1 hour before lights out

cd /app
echo "[$(date)] Starting missed-prediction reminder check..."
node dist/scripts/sendMissedPredictionReminders.js >> /var/log/cron.log 2>&1
echo "[$(date)] Missed-prediction reminder check completed"
