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

const router = express.Router();

// Get completed races list
router.get('/races', getCompletedRaces);

// Get season statistics
router.get('/summary', getSeasonStats);

// Fun and interesting season stats
router.get('/fun', getFunStats);

// Get practice results for a round (session: 1, 2, or 3)
router.get('/practice/:round/:session', getPracticeResults);

// Get qualifying results for a round
router.get('/qualifying/:round', getQualifyingResults);

// Get sprint qualifying (SQ) results for a round
router.get('/sprint-qualifying/:round', getSprintQualifyingResultsFromApi);

// Get race results for a round
router.get('/race/:round', getRaceResultsFromApi);

// Get sprint results for a round
router.get('/sprint/:round', getSprintResultsFromApi);

export default router;
