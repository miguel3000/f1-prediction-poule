import express from 'express';
import { getLiveTiming } from '../controllers/liveTimingController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Current merged live-timing snapshot (polled by the frontend every few seconds)
router.get('/', authenticate, getLiveTiming);

export default router;
