import express from 'express';
import {
  getDrivers,
  getDriver,
  getDriverStandings,
  syncDrivers,
  syncDriverStandings
} from '../controllers/driverController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, getDrivers);
router.get('/standings', authenticate, getDriverStandings);
router.get('/:id', authenticate, getDriver);
router.post('/sync', authenticate, syncDrivers); // Protected: admin use
router.post('/sync-standings', authenticate, syncDriverStandings); // Protected: sync points only

export default router;
