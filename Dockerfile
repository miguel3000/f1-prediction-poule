# Multi-stage Dockerfile for F1 Prediction Poule
# Combines frontend and backend into single image on port 5000

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-build
WORKDIR /app/backend

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source and build TypeScript
COPY backend/ ./
RUN npm run build

# Stage 3: Production Image
FROM node:18-alpine
WORKDIR /app

# Install Python3 for FastF1 sync script (pip install fastf1 on first use)
RUN apk add --no-cache python3 py3-pip

# Copy backend package files and install production dependencies only
COPY backend/package*.json ./
RUN npm install --production

# Copy compiled backend from build stage
COPY --from=backend-build /app/backend/dist ./dist

# Copy backend source files needed at runtime
COPY --from=backend-build /app/backend/src/database/schema.sql ./src/database/

# Copy frontend build to be served by backend
COPY --from=frontend-build /app/frontend/dist ./frontend

# Create uploads directory
RUN mkdir -p ./uploads

# Copy FastF1 sync script
COPY backend/scripts/fastf1_sync.py /app/scripts/fastf1_sync.py

# Set up cron for automatic syncing
# Copy cron-related files
COPY crontab /etc/crontabs/root
COPY sync-driver-standings.sh /app/sync-driver-standings.sh
COPY sync-race-results.sh /app/sync-race-results.sh
COPY sync-qualifying-results.sh /app/sync-qualifying-results.sh
COPY send-provisional-results.sh /app/send-provisional-results.sh
COPY process-final-results.sh /app/process-final-results.sh
COPY copy-missing-predictions.sh /app/copy-missing-predictions.sh
COPY reset-yearly-points.sh /app/reset-yearly-points.sh
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Make scripts executable
RUN chmod +x /app/sync-driver-standings.sh /app/sync-race-results.sh /app/sync-qualifying-results.sh /app/send-provisional-results.sh /app/process-final-results.sh /app/copy-missing-predictions.sh /app/reset-yearly-points.sh /app/docker-entrypoint.sh

# Create log directory for cron
RUN mkdir -p /var/log && touch /var/log/cron.log

# Expose port 5000
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use custom entrypoint to start both cron and Node
ENTRYPOINT ["/app/docker-entrypoint.sh"]
