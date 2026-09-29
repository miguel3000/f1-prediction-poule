import express from 'express';
import {
  getLeaderboard,
  getTopThree,
  getUserRank,
  getSeasonHistory,
  getPlayerStats
} from '../controllers/leaderboardController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, getLeaderboard);
router.get('/top-three', authenticate, getTopThree);
router.get('/season-history', authenticate, getSeasonHistory);
router.get('/player-stats', authenticate, getPlayerStats);
router.get('/rank', authenticate, getUserRank);

export default router;
