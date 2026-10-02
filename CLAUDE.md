# Poule Position - Claude Code Guide

## Project Overview

Poule Position is a web application where users can predict Formula 1 race results and compete on a leaderboard. It supports both main races (top 10 predictions) and sprint races (top 8 predictions).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, react-dnd (drag-and-drop)
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 15
- **Deployment**: Docker Compose (single container serving both frontend and backend on port 5000)
- **External APIs**: Jolpi/Ergast F1 API for race data and results

## Build & Run Commands

### Docker (Production)
```bash
# Build and start all services
docker compose build && docker compose up -d

# View logs
docker logs -f f1-app

# Restart after code changes
docker compose down && docker compose build && docker compose up -d

# Run database migration inside container
docker exec -it f1-app node dist/database/migrate.js
```

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev          # Start with nodemon (hot reload)
npm run build        # Compile TypeScript
npm run migrate      # Run database migrations
npm run seed         # Seed database
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # Run ESLint
```

### Backend Scripts (run from backend directory or inside container)
```bash
npm run sync:results              # Sync race results from F1 API
npm run results:provisional       # Send provisional results emails
npm run results:final             # Process final results (24h after race)
npm run predictions:copy-missing  # Copy predictions for users who forgot
npm run predictions:remind-missed # Email users who haven't predicted, 1h before lights out
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/database.ts       # PostgreSQL connection pool
│   │   ├── controllers/             # Route handlers
│   │   │   ├── authController.ts
│   │   │   ├── predictionController.ts
│   │   │   ├── sprintPredictionController.ts
│   │   │   ├── raceController.ts
│   │   │   ├── driverController.ts
│   │   │   ├── leaderboardController.ts
│   │   │   ├── statsController.ts
│   │   │   ├── adminController.ts
│   │   │   └── uploadController.ts
│   │   ├── routes/                  # Express routes
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT authentication (exports: authenticate)
│   │   │   ├── adminAuth.ts         # Admin authorization
│   │   │   └── upload.ts            # Multer file upload
│   │   ├── services/
│   │   │   ├── jolpiService.ts      # F1 API integration
│   │   │   ├── emailService.ts      # Nodemailer
│   │   │   └── openF1Service.ts     # Alternative F1 API
│   │   ├── scripts/                 # Cron job scripts
│   │   ├── database/
│   │   │   ├── schema.sql           # Database schema
│   │   │   ├── migrate.ts           # Migration runner
│   │   │   └── seed.ts              # Seed data
│   │   ├── types/index.ts           # TypeScript types
│   │   └── server.ts                # Express app entry point
│   └── uploads/                     # User avatars
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx       # Hamburger menu
│   │   │   ├── Footer.tsx
│   │   │   ├── PredictionInterface.tsx      # Main race predictions (10 positions)
│   │   │   ├── SprintPredictionInterface.tsx # Sprint predictions (8 positions)
│   │   │   └── Banner.tsx
│   │   ├── pages/
│   │   │   ├── Homepage.tsx         # Race countdown, predictions
│   │   │   ├── RaceOverview.tsx     # Race calendar
│   │   │   ├── DriverStandings.tsx  # Driver standings
│   │   │   ├── Leaderboard.tsx      # User rankings
│   │   │   ├── MyPredictions.tsx    # User's prediction history
│   │   │   ├── Stats.tsx            # Session results (FP, Quali, Race)
│   │   │   ├── Auth.tsx             # Login/register
│   │   │   ├── Profile.tsx          # User profile
│   │   │   ├── Admin.tsx            # Admin panel
│   │   │   ├── Rules.tsx
│   │   │   ├── About.tsx
│   │   │   └── PrivacyPolicy.tsx
│   │   ├── services/api.ts          # Axios API client
│   │   ├── context/AuthContext.ts   # Auth state management
│   │   ├── App.tsx                  # Routes and layout
│   │   └── main.tsx                 # Entry point
│   └── tailwind.config.js
├── docker-compose.yml               # PostgreSQL + app services
├── Dockerfile                       # Multi-stage build
├── crontab                          # Scheduled tasks
└── *.sh                             # Cron shell scripts
```

## Key Concepts

### Sprint vs Main Races
- **Main races**: Predict top 10 finishers, scored positions 1-10
- **Sprint races**: Predict top 8 finishers, points 8-7-6-5-4-3-2-1
- Sprint races have orange-themed UI styling
- Not all weekends have sprints (check `race_type` field)

### Prediction System
- Users drag-and-drop drivers to predict finish order
- Predictions lock when the race/sprint starts
- If user forgets to predict, their last prediction is automatically copied
- Two-stage results: provisional (immediate) then final (24h later for penalties)

### Authentication
- Password-based authentication
- JWT tokens stored in localStorage
- Auth middleware: `import { authenticate } from './middleware/auth'`

### Scoring
- Points for correct position predictions
- 50% accuracy bonus available
- Separate leaderboards for main vs sprint predictions

## Database

PostgreSQL with these main tables:
- `users` - User accounts
- `races` - Race calendar with `race_type` ('main' or 'sprint')
- `drivers` - Current F1 drivers
- `predictions` - Main race predictions (10 positions)
- `sprint_predictions` - Sprint predictions (8 positions)
- `race_results` - Official race results
- `sprint_results` - Official sprint results

## API Endpoints

All routes prefixed with `/api`:
- `/auth` - Register, login, verify, profile
- `/races` - Race calendar and results
- `/drivers` - Driver data and standings
- `/predictions` - Main race predictions (authenticated)
- `/sprint-predictions` - Sprint predictions (authenticated)
- `/leaderboard` - Rankings
- `/stats` - Practice, qualifying, race results
- `/upload` - Avatar uploads
- `/admin` - Admin functions

## Environment Variables

Backend `.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
EMAIL_FROM=noreply@example.com
FRONTEND_URL=https://yoursite.com
```

## Cron Jobs

Automated via crontab in Docker:
- **Driver standings sync**: Mon/Thu 9:00 UTC
- **Missed-prediction reminder**: Every 5 min on race days, ~1h before lights out
- **Copy missing predictions**: Every 2 min on Sundays 12:00-18:00 UTC
- **Provisional results**: Every 5 min on Sundays 12:00-20:00 UTC
- **Final results**: Mon 12:00-20:00 UTC

## Common Tasks

### Add a new API endpoint
1. Create/update controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. Register route in `backend/src/server.ts`
4. Add API function in `frontend/src/services/api.ts`

### Add a new page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Optionally add to navigation in `frontend/src/components/Navigation.tsx`

### Database changes
1. Update `backend/src/database/schema.sql`
2. Add migration query in `backend/src/database/migrate.ts`
3. Run migration: `docker exec -it f1-app node dist/database/migrate.js`

## Styling

- Tailwind CSS with F1-themed custom colors
- `text-f1-red`, `bg-f1-red`, `text-f1-gray` for brand colors
- Sprint races use orange theme: `bg-orange-500`, `text-orange-500`
- Responsive design with mobile-first approach
