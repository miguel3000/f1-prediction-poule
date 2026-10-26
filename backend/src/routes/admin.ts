import express from 'express';
import {
  getAllUsers,
  deleteUser,
  getCronJobs,
  triggerDriverStandingsSync,
  triggerRaceResultsSync,
  triggerQualifyingSync,
  getSyncStatus,
  getSyncDiagnosis,
  listResultCheckRaces,
  getResultCheck,
  sendBroadcastToAllUsers,
  sendLastRaceResults,
  getRacePredictionStatus,
  setUserPassword,
  setPitwallAccess,
  setGroupStarter,
  listPitwallIdeas,
  decidePitwallIdea,
  listEmailLog
} from '../controllers/adminController';
import { syncDrivers } from '../controllers/driverController';
import { syncRaces } from '../controllers/raceController';
import { authenticateAdmin } from '../middleware/adminAuth';
import { adminListGroups, adminDeleteGroup, adminRemoveMember, adminReassignOwner } from '../controllers/groupController';

const router = express.Router();

// All admin routes require admin authentication
router.get('/users', authenticateAdmin, getAllUsers);
router.delete('/users/:id', authenticateAdmin, deleteUser);
router.post('/users/:userId/password', authenticateAdmin, setUserPassword);

// Group play: who may start groups, and every group with its owner and members
router.put('/users/:id/group-starter', authenticateAdmin, setGroupStarter);
router.get('/groups', authenticateAdmin, adminListGroups);
router.delete('/groups/:id', authenticateAdmin, adminDeleteGroup);
router.delete('/groups/:id/members/:userId', authenticateAdmin, adminRemoveMember);
router.put('/groups/:id/owner', authenticateAdmin, adminReassignOwner);

// Player Pit Wall: who has access, and reviewing what they submit
router.put('/users/:id/pitwall-access', authenticateAdmin, setPitwallAccess);
router.get('/pitwall-ideas', authenticateAdmin, listPitwallIdeas);
router.put('/pitwall-ideas/:id', authenticateAdmin, decidePitwallIdea);

// Sign-up / departure emails: what was sent, what failed
router.get('/email-log', authenticateAdmin, listEmailLog);

// Cronjob management
router.get('/cronjobs', authenticateAdmin, getCronJobs);
router.post('/cronjobs/sync-driver-standings', authenticateAdmin, triggerDriverStandingsSync);
router.post('/cronjobs/sync-drivers', authenticateAdmin, syncDrivers);
// ?force=true to re-sync races that already have results (recalculates points)
router.post('/cronjobs/sync-qualifying', authenticateAdmin, triggerQualifyingSync)
// ?force=true to re-sync all past races (recalculates points); ?raceId=<id> to target one specific race
router.post('/cronjobs/sync-race-results', authenticateAdmin, triggerRaceResultsSync);
// Re-pull the race calendar (dates, qualifying times) from Jolpi — schedule changes don't auto-refresh otherwise
router.post('/cronjobs/sync-calendar', authenticateAdmin, syncRaces);

// Sync status polling + diagnostics
router.get('/sync-status', authenticateAdmin, getSyncStatus);
router.get('/sync-diagnosis', authenticateAdmin, getSyncDiagnosis);

// Results cross-check: compare the sources for a race (read-only)
router.get('/results-check', authenticateAdmin, listResultCheckRaces);
router.get('/results-check/:raceId', authenticateAdmin, getResultCheck);

// Broadcast email
router.post('/broadcast', authenticateAdmin, sendBroadcastToAllUsers);

// Send personal prediction results for the last race to all players
router.post('/send-last-race-results', authenticateAdmin, sendLastRaceResults);

// Which users have submitted a prediction for a given race
router.get('/races/:raceId/prediction-status', authenticateAdmin, getRacePredictionStatus);

export default router;
