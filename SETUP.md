# Poule Position - Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- Gmail account (for sending emails)

## Quick Start with Docker

### 1. Clone or navigate to the project directory

```bash
cd f1-prediction-poule
```

### 2. Set up environment variables

#### Backend (.env)

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and update the following:

```env
# Gmail Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=Poule Position <your-gmail@gmail.com>

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important: How to get Gmail App Password:**
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security > 2-Step Verification > App passwords
4. Generate a new app password for "Mail"
5. Copy the 16-character password to your .env file

#### Frontend (.env)

```bash
cp frontend/.env.example frontend/.env
```

The default settings should work for local development.

### 3. Start the application

```bash
docker compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 5000
- Frontend React app on port 3000

### 4. Run database migrations

```bash
docker compose exec backend npm run migrate
```

### 5. Seed the database with 2025 F1 data

```bash
docker compose exec backend npm run seed
```

### 6. Access the application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/health

## Local Development (without Docker)

### 1. Install PostgreSQL locally

Install PostgreSQL 15+ and create a database:

```bash
createdb f1_predictions
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and configure as described above.

Update `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/f1_predictions
```

### 4. Run backend migrations and seed

```bash
npm run migrate
npm run seed
```

### 5. Start backend development server

```bash
npm run dev
```

Backend will run on http://localhost:5000

### 6. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 7. Start frontend development server

```bash
npm run dev
```

Frontend will run on http://localhost:3000

## Admin Tasks

### Sync Races from API

You can manually sync races at any time:

```bash
curl -X POST http://localhost:5000/api/races/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Sync Drivers from API

```bash
curl -X POST http://localhost:5000/api/drivers/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Race Results

After each race, you'll need to:
1. Fetch results from the F1 API
2. Insert them into the `race_results` table
3. Run the points calculation script

Example:

```sql
-- Insert race results (after fetching from API)
INSERT INTO race_results (race_id, driver_id, position, points, status)
VALUES (1, 1, 1, 25, 'finished');
-- ... (repeat for all positions)
```

Then calculate points:

```javascript
// In Node.js
const { calculateRacePoints } = require('./backend/dist/controllers/leaderboardController');
await calculateRacePoints(raceId);
```

## Troubleshooting

### Database connection errors

Make sure PostgreSQL is running:

```bash
docker compose ps
```

### Email not sending

- Verify Gmail credentials in `.env`
- Check that you're using an App Password, not your regular password
- Ensure 2FA is enabled on your Google account

### Frontend can't connect to backend

Check that `VITE_API_URL` in `frontend/.env` matches your backend URL.

### Port conflicts

If ports 3000, 5000, or 5432 are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:3000"  # Change YOUR_PORT
```

## Production Deployment

### 1. Update environment variables

- Change `NODE_ENV` to `production`
- Update `DATABASE_URL` to your production database
- Update `FRONTEND_URL` to your production domain
- Use strong `JWT_SECRET`

### 2. Build the application

```bash
docker compose -f docker-compose.prod.yml build
```

### 3. Deploy

Use your preferred hosting service (AWS, DigitalOcean, etc.) with Docker support.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with password
- `GET /api/auth/profile` - Get user profile (requires auth)

### Races
- `GET /api/races` - Get all races
- `GET /api/races/next` - Get next upcoming race
- `GET /api/races/:id` - Get specific race
- `GET /api/races/:id/results` - Get race results

### Drivers
- `GET /api/drivers` - Get all drivers
- `GET /api/drivers/standings` - Get driver standings
- `GET /api/drivers/:id` - Get specific driver

### Predictions
- `POST /api/predictions` - Submit prediction (requires auth)
- `GET /api/predictions/:raceId` - Get prediction for race (requires auth)
- `GET /api/predictions/user` - Get all user predictions (requires auth)

### Leaderboard
- `GET /api/leaderboard` - Get full leaderboard
- `GET /api/leaderboard/top-three` - Get top 3 users
- `GET /api/leaderboard/rank` - Get current user's rank (requires auth)

### Upload
- `POST /api/upload/avatar` - Upload avatar (requires auth)
- `DELETE /api/upload/avatar` - Delete avatar (requires auth)

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React DnD
- **APIs:** OpenF1 API, Jolpi Ergast API
- **Email:** Nodemailer with Gmail
- **Deployment:** Docker, Docker Compose

## Support

For issues or questions, please open an issue on GitHub or contact the maintainer.

Happy racing! 🏁
