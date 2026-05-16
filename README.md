# F1 2025 Prediction Poule Website

A Formula 1 prediction website where users can predict race results and compete on a leaderboard.

## Features

- User registration with email verification (no password required)
- Drag-and-drop interface for predicting top 10 race finishers
- Real-time countdown to next race
- Live leaderboard with podium display
- Driver championship standings
- F1 scoring system (25-18-15-12-10-8-6-4-2-1 points)
- Mobile-responsive design

## Technology Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React DnD
- **APIs:** OpenF1 API (primary), Jolpi Ergast API (backup)
- **Email:** Nodemailer with Gmail
- **Deployment:** Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Gmail account (for sending emails)

### Installation

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
3. Update `.env` files with your credentials
4. Start the application:
   ```bash
   docker compose up -d
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Project Structure

```
f1-prediction-poule/
├── backend/          # Express API server
├── frontend/         # React application
├── docker-compose.yml
└── README.md
```

## License

MIT
# f1-prediction-poule
