#!/bin/sh
# Cron job script: store the real starting grid (penalties applied) once it is known, shortly
# before a race or sprint starts. Prints to the cron log only when it stores a grid.

cd /app
node dist/scripts/syncStartingGrid.js >> /var/log/cron.log 2>&1
