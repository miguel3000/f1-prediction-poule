import express from 'express';
import {
  getRaces,
  getRace,
  getNextRace,
  getUpcomingRaces,
  getRaceResults,
  getQualifyingOrder,
  getRaceWeekend,
  syncRaces
} from '../controllers/raceController';
import { authenticateAdmin } from '../middleware/adminAuth';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public: the logged-out homepage banner needs this for its countdown
router.get('/upcoming', getUpcomingRaces);

router.get('/', authenticate, getRaces);
router.get('/next', authenticate, getNextRace);
// Before '/:id' so "weekend" is not taken for a race id
router.get('/weekend/:round', authenticate, getRaceWeekend);
router.get('/:id', authenticate, getRace);
router.get('/:id/results', authenticate, getRaceResults);
router.get('/:id/qualifying', authenticate, getQualifyingOrder);
router.post('/sync', authenticateAdmin, syncRaces); // Admin use — also exposed at /api/admin/cronjobs/sync-calendar

export default router;
