#!/bin/sh
set -e

echo "Starting F1 Prediction Poule application..."

# Run database migrations before starting (idempotent — safe to run on every boot)
echo "Running database migrations..."
node dist/database/migrate.js

# Create log file for cron
touch /var/log/cron.log

# Start cron in background
echo "Starting cron daemon..."
crond -l 2 -f &

# Start the Node.js application
echo "Starting Node.js server..."
exec npm start
