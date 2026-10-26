import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import predictionRoutes from './routes/predictions';
import sprintPredictionRoutes from './routes/sprintPredictions';
import raceRoutes from './routes/races';
import driverRoutes from './routes/drivers';
import leaderboardRoutes from './routes/leaderboard';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import newsRoutes from './routes/news';
import liveTimingRoutes from './routes/liveTiming';
import pitwallRoutes from './routes/pitwall';
import tutorialRoutes from './routes/tutorial';
import groupRoutes from './routes/groups';
import { startLiveTimingIngest } from './services/liveTimingService';
import { startEmailRetries } from './services/emailLog';
import { pickLang, renderIndex } from './utils/seoMeta';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Cloudflare/nginx proxy so express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  // The live timing page polls every few seconds, which would exhaust this
  // shared budget in minutes and make every other call (including the
  // profile fetch on page load) fail — it gets its own limiter instead.
  skip: (req) => req.path.startsWith('/live-timing'),
});

const liveTimingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for React app
  // Static assets (the email logo, uploaded avatars) are meant to be embedded
  // cross-origin — an email client renders our <img> from its own origin —
  // so the default same-origin CORP would silently block them from loading.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: [
    'https://pouleposition.nl',
    'https://f1.miguelm.nl',
    'http://localhost:5000',
    'http://localhost:3000',
    process.env.FRONTEND_URL || 'http://localhost:5000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// Serve static files (uploaded avatars)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/sprint-predictions', sprintPredictionRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/live-timing', liveTimingLimiter, liveTimingRoutes);
app.use('/api/pitwall', pitwallRoutes);
app.use('/api/tutorial', tutorialRoutes);
app.use('/api/groups', groupRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// pouleposition.nl is the one address search engines should list. The same app
// is also reachable on other hostnames (f1.miguelm.nl), which are asked not to
// be indexed so the two never compete as duplicates. Local development is left alone.
const CANONICAL_HOST = 'pouleposition.nl';
app.use((req, res, next) => {
  const host = req.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!isLocal && host !== CANONICAL_HOST && host !== `www.${CANONICAL_HOST}`) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// One address per page: www.pouleposition.nl and plain http go to https://pouleposition.nl with the
// same path (a 301), so search engines and shared links see one site instead of copies. Cloudflare
// reports how the visitor connected in the CF-Visitor header. API calls and the health check are
// left alone.
const viaPlainHttp = (header: unknown) => {
  try {
    return JSON.parse(String(header || '{}')).scheme === 'http';
  } catch {
    return false;
  }
};
app.use((req, res, next) => {
  const host = req.hostname.toLowerCase();
  const wrongAddress = host === `www.${CANONICAL_HOST}` || (host === CANONICAL_HOST && viaPlainHttp(req.headers['cf-visitor']));
  if (wrongAddress && (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/') && req.path !== '/health') {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }
  next();
});

// The old address f1.miguelm.nl now just forwards page visits to pouleposition.nl
// (same path), so links in older emails and bookmarks keep working. Only GET/HEAD page
// loads are forwarded; /api and /uploads are left alone for tabs that are still open.
const LEGACY_HOSTS = ['f1.miguelm.nl'];
app.use((req, res, next) => {
  if (
    LEGACY_HOSTS.includes(req.hostname.toLowerCase()) &&
    (req.method === 'GET' || req.method === 'HEAD') &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/uploads/') &&
    req.path !== '/health'
  ) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }
  next();
});

// Serve static files from React build (after API routes)
// index: false so '/' goes through the per-page <head> rendering below instead.
app.use(express.static(path.join(__dirname, '../frontend'), { index: false }));

// A missing file (robots.txt typo, old asset, bot probing /wp-login.php) should be
// a real 404 — answering 200 with the app shell makes crawlers index it as a page.
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  next();
});

// SPA fallback - send all non-API requests to React app
app.get('*', (req, res) => {
  const lang = pickLang(req.query.lang, req.headers['accept-language']);
  res.setHeader('Vary', 'Accept-Language');
  res.type('html').send(renderIndex(path.join(__dirname, '../frontend/index.html'), req.path, lang));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏎️  Poule Position API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  startLiveTimingIngest();
  startEmailRetries();
});

export default app;
