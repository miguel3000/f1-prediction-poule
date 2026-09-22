import express from 'express';
import {
  getRaces,
  getRace,
  getNextRace,
  getUpcomingRaces,
  getRaceResults,
  getQualifyingOrder,
  syncRaces
} from '../controllers/raceController';
import { authenticateAdmin } from '../middleware/adminAuth';

const router = express.Router();

router.get('/', getRaces);
router.get('/next', getNextRace);
router.get('/upcoming', getUpcomingRaces);
router.get('/:id', getRace);
router.get('/:id/results', getRaceResults);
router.get('/:id/qualifying', getQualifyingOrder);
router.post('/sync', authenticateAdmin, syncRaces); // Admin use — also exposed at /api/admin/cronjobs/sync-calendar

export default router;
