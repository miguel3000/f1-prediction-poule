import express from 'express';
import {
  getPracticeResults,
  getQualifyingResults,
  getRaceResultsFromApi,
  getSprintResultsFromApi,
  getSprintQualifyingResultsFromApi,
  getCompletedRaces,
  getSeasonStats,
  getFunStats
} from '../controllers/statsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get completed races list
router.get('/races', authenticate, getCompletedRaces);

// Get season statistics
router.get('/summary', authenticate, getSeasonStats);

// Fun and interesting season stats
router.get('/fun', authenticate, getFunStats);

// Get practice results for a round (session: 1, 2, or 3)
router.get('/practice/:round/:session', authenticate, getPracticeResults);

// Get qualifying results for a round
router.get('/qualifying/:round', authenticate, getQualifyingResults);

// Get sprint qualifying (SQ) results for a round
router.get('/sprint-qualifying/:round', authenticate, getSprintQualifyingResultsFromApi);

// Get race results for a round
router.get('/race/:round', authenticate, getRaceResultsFromApi);

// Get sprint results for a round
router.get('/sprint/:round', authenticate, getSprintResultsFromApi);

export default router;
