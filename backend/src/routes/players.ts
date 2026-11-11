import express from 'express';
import { getPlayerPredictions } from '../controllers/playerController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// A player's predictions against the results, inside one poule (?poule=) and season (?season=)
router.get('/:id/predictions', authenticate, getPlayerPredictions);

export default router;
