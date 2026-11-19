#!/bin/sh
# Cron job script: the Thursday race weekend preview. Mails every player who has not had it yet for the
# race starting within the next days; does nothing while the Pitlane switch is off.
cd /app
echo "[$(date)] Starting race weekend preview..." >> /var/log/cron.log
node dist/scripts/sendRacePreviews.js >> /var/log/cron.log 2>&1
echo "[$(date)] Race weekend preview completed" >> /var/log/cron.log
