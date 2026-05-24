import express from 'express';
import {
  getAllUsers,
  deleteUser,
  getCronJobs,
  triggerDriverStandingsSync,
  triggerRaceResultsSync,
  getSyncStatus,
  getSyncDiagnosis,
  sendBroadcastToAllUsers,
  sendLastRaceResults,
  setUserPassword,
  changeAdminPassword
} from '../controllers/adminController';
import { syncDrivers } from '../controllers/driverController';
import { authenticateAdmin } from '../middleware/adminAuth';

const router = express.Router();

// All admin routes require admin authentication
router.get('/users', authenticateAdmin, getAllUsers);
router.delete('/users/:id', authenticateAdmin, deleteUser);
router.post('/users/:userId/password', authenticateAdmin, setUserPassword);
router.post('/admin-password', authenticateAdmin, changeAdminPassword);

// Cronjob management
router.get('/cronjobs', authenticateAdmin, getCronJobs);
router.post('/cronjobs/sync-driver-standings', authenticateAdmin, triggerDriverStandingsSync);
router.post('/cronjobs/sync-drivers', authenticateAdmin, syncDrivers);
// ?force=true to re-sync races that already have results (recalculates points)
router.post('/cronjobs/sync-race-results', authenticateAdmin, triggerRaceResultsSync);

// Sync status polling + diagnostics
router.get('/sync-status', authenticateAdmin, getSyncStatus);
router.get('/sync-diagnosis', authenticateAdmin, getSyncDiagnosis);

// Broadcast email
router.post('/broadcast', authenticateAdmin, sendBroadcastToAllUsers);

// Send personal prediction results for the last race to all players
router.post('/send-last-race-results', authenticateAdmin, sendLastRaceResults);

export default router;
