import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import * as jolpiService from '../services/jolpiService';
import { calculateRacePoints } from './leaderboardController';
import { sendBroadcastEmail, sendPersonalRaceResults } from '../services/emailService';
import { f1Cache } from '../utils/cache';

const SALT_ROUNDS = 10;

// Store last run info in memory (persists until server restart)
const cronJobStatus: {
  [key: string]: {
    lastRun: Date | null;
    lastStatus: 'success' | 'error' | 'running' | null;
    lastMessage: string | null;
    isRunning: boolean;
  };
} = {
  syncDriverStandings: { lastRun: null, lastStatus: null, lastMessage: null, isRunning: false },
  syncRaceResults: { lastRun: null, lastStatus: null, lastMessage: null, isRunning: false },
  copyMissingPredictions: { lastRun: null, lastStatus: null, lastMessage: null, isRunning: false },
  sendProvisionalResults: { lastRun: null, lastStatus: null, lastMessage: null, isRunning: false },
  processFinalResults: { lastRun: null, lastStatus: null, lastMessage: null, isRunning: false },
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, nickname, email, avatar_url, total_points, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: user.id,
        nickname: user.nickname,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get cronjob status and configuration
export const getCronJobs = async (req: Request, res: Response) => {
  try {
    // Get last sync times from database
    const driverLastUpdate = await query(
      'SELECT MAX(updated_at) as last_updated FROM drivers WHERE season = 2026'
    );
    const raceLastUpdate = await query(
      'SELECT MAX(updated_at) as last_updated FROM races WHERE season = 2026'
    );

    // Get count of completed races and pending races
    const raceStats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed_races,
        COUNT(*) FILTER (WHERE status = 'provisional') as provisional_races,
        COUNT(*) FILTER (WHERE status = 'upcoming' AND race_date < NOW()) as pending_races,
        COUNT(*) FILTER (WHERE status = 'upcoming' AND race_date > NOW()) as upcoming_races
       FROM races WHERE season = 2026`
    );

    // Get races needing provisional results (finished 5min-3hrs ago, not sent yet)
    const provisionalPending = await query(
      `SELECT COUNT(*) as count FROM races
       WHERE season = 2026
         AND race_date < NOW() - INTERVAL '5 minutes'
         AND race_date > NOW() - INTERVAL '3 hours'
         AND provisional_results_sent = FALSE
         AND status = 'upcoming'`
    );

    // Get races needing final results (24+ hours old, provisional status)
    const finalPending = await query(
      `SELECT COUNT(*) as count FROM races
       WHERE season = 2026
         AND race_date < NOW() - INTERVAL '24 hours'
         AND final_results_processed = FALSE
         AND status = 'provisional'`
    );

    // Get races that just locked (for copy missing predictions)
    const copyPredictionsPending = await query(
      `SELECT COUNT(*) as count FROM races
       WHERE season = 2026
         AND race_date - INTERVAL '1 minute' < NOW()
         AND race_date - INTERVAL '1 minute' > NOW() - INTERVAL '10 minutes'
         AND status = 'upcoming'`
    );

    const cronJobs = [
      {
        id: 'syncDriverStandings',
        name: 'Sync Driver Standings',
        description: 'Updates F1 championship points from Jolpi Ergast API',
        schedule: '0 9 * * 1,4',
        scheduleHuman: 'Monday & Thursday at 09:00 UTC',
        lastDataUpdate: driverLastUpdate.rows[0]?.last_updated || null,
        canTrigger: true,
        ...cronJobStatus.syncDriverStandings
      },
      {
        id: 'syncRaceResults',
        name: 'Sync Race Results',
        description: 'Imports race results and calculates prediction points',
        schedule: '15 9 * * 1,4',
        scheduleHuman: 'Monday & Thursday at 09:15 UTC',
        lastDataUpdate: raceLastUpdate.rows[0]?.last_updated || null,
        pendingRaces: parseInt(raceStats.rows[0]?.pending_races || '0'),
        canTrigger: true,
        ...cronJobStatus.syncRaceResults
      },
      {
        id: 'copyMissingPredictions',
        name: 'Copy Missing Predictions',
        description: 'Copies last prediction for users who forgot to submit before race lock',
        schedule: '*/2 12-18 * * 0',
        scheduleHuman: 'Sundays 12:00-18:00 UTC (every 2 min)',
        lastDataUpdate: null,
        pendingRaces: parseInt(copyPredictionsPending.rows[0]?.count || '0'),
        canTrigger: false,
        ...cronJobStatus.copyMissingPredictions
      },
      {
        id: 'sendProvisionalResults',
        name: 'Send Provisional Results',
        description: 'Sends provisional results email ~5 minutes after race ends',
        schedule: '*/5 12-20 * * 0',
        scheduleHuman: 'Sundays 12:00-20:00 UTC (every 5 min)',
        lastDataUpdate: null,
        pendingRaces: parseInt(provisionalPending.rows[0]?.count || '0'),
        canTrigger: false,
        ...cronJobStatus.sendProvisionalResults
      },
      {
        id: 'processFinalResults',
        name: 'Process Final Results',
        description: 'Recalculates points 24h after race (accounts for DQs/penalties), sends final email',
        schedule: '0 12-20 * * 1',
        scheduleHuman: 'Mondays 12:00-20:00 UTC (hourly)',
        lastDataUpdate: null,
        pendingRaces: parseInt(finalPending.rows[0]?.count || '0'),
        canTrigger: false,
        ...cronJobStatus.processFinalResults
      }
    ];

    res.json({
      cronJobs,
      stats: {
        completedRaces: parseInt(raceStats.rows[0]?.completed_races || '0'),
        provisionalRaces: parseInt(raceStats.rows[0]?.provisional_races || '0'),
        pendingRaces: parseInt(raceStats.rows[0]?.pending_races || '0'),
        upcomingRaces: parseInt(raceStats.rows[0]?.upcoming_races || '0')
      }
    });
  } catch (error) {
    console.error('Get cron jobs error:', error);
    res.status(500).json({ error: 'Failed to get cron job status' });
  }
};

// Manually trigger driver standings sync
export const triggerDriverStandingsSync = async (req: Request, res: Response) => {
  if (cronJobStatus.syncDriverStandings.isRunning) {
    return res.status(409).json({ error: 'Sync is already running' });
  }

  cronJobStatus.syncDriverStandings.isRunning = true;
  cronJobStatus.syncDriverStandings.lastStatus = 'running';

  // Run async but respond immediately
  res.json({ message: 'Driver standings sync started', status: 'running' });

  try {
    const season = 2026;
    const standings = await jolpiService.getDriverStandings(season);

    // Fetch all existing drivers for this season
    const existingDrivers = await query(
      'SELECT id, driver_number, UPPER(name) as name_upper FROM drivers WHERE season = $1',
      [season]
    );
    const driverByNumber = new Map(existingDrivers.rows.map((d: any) => [d.driver_number, d.id]));
    const driverByName = new Map(existingDrivers.rows.map((d: any) => [d.name_upper, d.id]));

    const updates: { id: number; points: number; nationality: string }[] = [];
    let notFound = 0;

    for (const standing of standings) {
      const driverNumber = parseInt(standing.Driver.permanentNumber);
      const points = parseInt(standing.points);
      const driverName = `${standing.Driver.givenName} ${standing.Driver.familyName}`;
      const nationality = standing.Driver.nationality;

      let driverId = driverByNumber.get(driverNumber);
      if (!driverId) {
        driverId = driverByName.get(driverName.toUpperCase());
      }

      if (driverId) {
        updates.push({ id: driverId, points, nationality });
      } else {
        notFound++;
      }
    }

    // Batch update
    if (updates.length > 0) {
      const ids = updates.map(u => u.id);
      const pointsCases = updates.map(u => `WHEN ${u.id} THEN ${u.points}`).join(' ');
      const nationalityCases = updates.map(u => `WHEN ${u.id} THEN '${u.nationality.replace(/'/g, "''")}'`).join(' ');

      await query(
        `UPDATE drivers
         SET total_points = CASE id ${pointsCases} END,
             nationality = CASE id ${nationalityCases} END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1)`,
        [ids]
      );
    }

    cronJobStatus.syncDriverStandings.lastRun = new Date();
    cronJobStatus.syncDriverStandings.lastStatus = 'success';
    cronJobStatus.syncDriverStandings.lastMessage = `Updated ${updates.length} drivers, ${notFound} not found`;
    cronJobStatus.syncDriverStandings.isRunning = false;

    console.log(`[ADMIN] Driver standings sync completed: ${updates.length} updated, ${notFound} not found`);
  } catch (error: any) {
    cronJobStatus.syncDriverStandings.lastRun = new Date();
    cronJobStatus.syncDriverStandings.lastStatus = 'error';
    cronJobStatus.syncDriverStandings.lastMessage = error.message || 'Unknown error';
    cronJobStatus.syncDriverStandings.isRunning = false;

    console.error('[ADMIN] Driver standings sync error:', error);
  }
};

// Return lightweight sync status (for frontend polling)
export const getSyncStatus = async (req: Request, res: Response) => {
  res.json(cronJobStatus);
};

// Diagnostic endpoint: shows races needing sync and tests Jolpi API connectivity
export const getSyncDiagnosis = async (req: Request, res: Response) => {
  try {
    const season = 2026;

    // Races that have passed and have NO results yet
    const pendingResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type, r.status
       FROM races r
       WHERE r.season = $1
         AND r.race_date < NOW()
         AND (
           (r.race_type = 'main' AND NOT EXISTS (SELECT 1 FROM race_results WHERE race_id = r.id))
           OR
           (r.race_type = 'sprint' AND NOT EXISTS (SELECT 1 FROM sprint_results WHERE race_id = r.id))
         )
       ORDER BY r.race_date DESC`,
      [season]
    );

    // Races that have results already
    const syncedResult = await query(
      `SELECT r.id, r.round, r.race_name, r.race_type, r.status,
              (SELECT COUNT(*) FROM race_results WHERE race_id = r.id) as main_result_count,
              (SELECT COUNT(*) FROM sprint_results WHERE race_id = r.id) as sprint_result_count
       FROM races r
       WHERE r.season = $1
         AND r.race_date < NOW()
       ORDER BY r.race_date DESC`,
      [season]
    );

    // Test Jolpi API availability for the most recent pending round
    const apiTests: any[] = [];
    const testRaces = pendingResult.rows.slice(0, 3);
    for (const race of testRaces) {
      try {
        const isSprint = race.race_type === 'sprint';
        const results = isSprint
          ? await jolpiService.getSprintResults(race.season, race.round)
          : await jolpiService.getRaceResults(race.season, race.round);
        apiTests.push({
          race: race.race_name,
          round: race.round,
          type: race.race_type,
          apiReturned: results.length,
          status: results.length > 0 ? 'available' : 'no_data'
        });
      } catch (err: any) {
        apiTests.push({
          race: race.race_name,
          round: race.round,
          type: race.race_type,
          apiReturned: 0,
          status: 'error',
          error: err.message
        });
      }
    }

    // Cache stats
    const cacheStats = f1Cache.stats();

    res.json({
      pendingSync: pendingResult.rows,
      syncedRaces: syncedResult.rows,
      apiTests,
      cacheStats,
      lastSyncStatus: cronJobStatus.syncRaceResults
    });
  } catch (error: any) {
    console.error('[ADMIN] Sync diagnosis error:', error);
    res.status(500).json({ error: error.message || 'Diagnosis failed' });
  }
};

// Manually trigger race results sync
// Pass ?force=true to re-sync races that already have results (recalculates points)
export const triggerRaceResultsSync = async (req: Request, res: Response) => {
  if (cronJobStatus.syncRaceResults.isRunning) {
    return res.status(409).json({ error: 'Sync is already running' });
  }

  const force = req.query.force === 'true';

  cronJobStatus.syncRaceResults.isRunning = true;
  cronJobStatus.syncRaceResults.lastStatus = 'running';

  // Respond immediately; sync runs in background
  res.json({ message: 'Race results sync started', status: 'running', force });

  try {
    const season = 2026;

    let racesResult;
    if (force) {
      // Force: grab ALL past races regardless of existing results
      racesResult = await query(
        `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
         FROM races r
         WHERE r.season = $1 AND r.race_date < NOW()
         ORDER BY r.race_date DESC`,
        [season]
      );
    } else {
      // Normal: only races with no results yet
      racesResult = await query(
        `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
         FROM races r
         WHERE r.season = $1
           AND r.race_date < NOW()
           AND (
             (r.race_type = 'main' AND NOT EXISTS (SELECT 1 FROM race_results WHERE race_id = r.id))
             OR
             (r.race_type = 'sprint' AND NOT EXISTS (SELECT 1 FROM sprint_results WHERE race_id = r.id))
           )
         ORDER BY r.race_date DESC`,
        [season]
      );
    }

    const races = racesResult.rows;

    if (races.length === 0) {
      cronJobStatus.syncRaceResults.lastRun = new Date();
      cronJobStatus.syncRaceResults.lastStatus = 'success';
      cronJobStatus.syncRaceResults.lastMessage = 'No races found to sync. All past races already have results. Use Force Re-sync to recalculate points.';
      cronJobStatus.syncRaceResults.isRunning = false;
      return;
    }

    let totalInserted = 0;
    let racesProcessed = 0;
    let racesSkipped = 0;
    const raceLog: string[] = [];

    for (const race of races) {
      try {
        const isSprint = race.race_type === 'sprint';
        const resultsTable = isSprint ? 'sprint_results' : 'race_results';
        const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';

        // Clear cache so we always get fresh data from Jolpi
        jolpiService.clearRaceCache(race.season, race.round);

        // Fetch appropriate results from Jolpi API
        const jolpiResults = isSprint
          ? await jolpiService.getSprintResults(race.season, race.round)
          : await jolpiService.getRaceResults(race.season, race.round);

        if (jolpiResults.length === 0) {
          console.log(`[ADMIN] No results available yet for ${race.race_name} (Round ${race.round})`);
          raceLog.push(`⚠ ${race.race_name}: no API data yet`);
          racesSkipped++;
          continue;
        }

        // When force-syncing, subtract existing prediction points before recalculation
        if (force) {
          const existingPoints = await query(
            `SELECT user_id, points_earned FROM ${predictionTable} WHERE race_id = $1 AND points_earned > 0`,
            [race.id]
          );
          for (const p of existingPoints.rows) {
            await query(
              'UPDATE users SET total_points = GREATEST(0, total_points - $1) WHERE id = $2',
              [p.points_earned, p.user_id]
            );
          }
          await query(`UPDATE ${predictionTable} SET points_earned = 0 WHERE race_id = $1`, [race.id]);
        }

        // Clear and re-insert results
        await query(`DELETE FROM ${resultsTable} WHERE race_id = $1`, [race.id]);

        // Batch fetch drivers
        const driverNumbers = jolpiResults.map((r: any) => parseInt(r.number));
        const driversResult = await query(
          'SELECT id, driver_number FROM drivers WHERE driver_number = ANY($1) AND season = $2',
          [driverNumbers, race.season]
        );
        const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d.id]));

        // Batch insert results
        const insertValues: string[] = [];
        const insertParams: any[] = [];
        let paramIndex = 1;

        for (const result of jolpiResults) {
          const driverId = driverMap.get(parseInt(result.number));
          if (driverId) {
            insertValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
            insertParams.push(race.id, driverId, parseInt(result.position), parseFloat(result.points || '0'), result.status);
            paramIndex += 5;
          }
        }

        if (insertValues.length > 0) {
          await query(
            `INSERT INTO ${resultsTable} (race_id, driver_id, position, points, status)
             VALUES ${insertValues.join(', ')}`,
            insertParams
          );
          totalInserted += insertValues.length;
        }

        // Update race status
        await query(
          'UPDATE races SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', race.id]
        );

        // Calculate points using the unified function (handles both main and sprint)
        await calculateRacePoints(race.id);
        racesProcessed++;

        const topThree = jolpiResults.slice(0, 3).map((r: any) => `P${r.position}:#${r.number}`).join(', ');
        raceLog.push(`✓ ${race.race_name} (${isSprint ? 'Sprint' : 'Main'}): ${insertValues.length} results — ${topThree}`);
        console.log(`[ADMIN] Synced ${race.race_name}: ${insertValues.length} results`);

      } catch (error: any) {
        raceLog.push(`✗ ${race.race_name}: ${error.message}`);
        console.error(`[ADMIN] Error syncing race ${race.race_name}:`, error);
      }
    }

    cronJobStatus.syncRaceResults.lastRun = new Date();
    cronJobStatus.syncRaceResults.lastStatus = 'success';
    cronJobStatus.syncRaceResults.lastMessage = [
      `Processed ${racesProcessed} race(s), inserted ${totalInserted} results, skipped ${racesSkipped}`,
      ...raceLog
    ].join('\n');
    cronJobStatus.syncRaceResults.isRunning = false;

    console.log(`[ADMIN] Race results sync completed: ${racesProcessed} races, ${totalInserted} results`);
  } catch (error: any) {
    cronJobStatus.syncRaceResults.lastRun = new Date();
    cronJobStatus.syncRaceResults.lastStatus = 'error';
    cronJobStatus.syncRaceResults.lastMessage = error.message || 'Unknown error';
    cronJobStatus.syncRaceResults.isRunning = false;

    console.error('[ADMIN] Race results sync error:', error);
  }
};

// Send broadcast email to all users
export const sendBroadcastToAllUsers = async (req: Request, res: Response) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    if (subject.length > 100) {
      return res.status(400).json({ error: 'Subject must be 100 characters or less' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message must be 5000 characters or less' });
    }

    // Get all users
    const usersResult = await query('SELECT id, email, nickname FROM users ORDER BY nickname');
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found' });
    }

    // Send emails to all users
    let successCount = 0;
    let failCount = 0;
    const failures: string[] = [];

    for (const user of users) {
      const success = await sendBroadcastEmail(user.email, user.nickname, subject, message);
      if (success) {
        successCount++;
      } else {
        failCount++;
        failures.push(user.nickname);
      }
    }

    console.log(`[ADMIN] Broadcast email sent: ${successCount} success, ${failCount} failed`);

    res.json({
      message: `Broadcast sent to ${successCount} user(s)`,
      successCount,
      failCount,
      failures: failures.length > 0 ? failures : undefined
    });
  } catch (error) {
    console.error('Send broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
};

// Send personal prediction results email for the last completed race to all players
export const sendLastRaceResults = async (req: Request, res: Response) => {
  try {
    const season = new Date().getFullYear();

    // Find the most recently completed race
    const raceResult = await query(
      `SELECT * FROM races
       WHERE status IN ('completed', 'provisional')
         AND season = $1
       ORDER BY race_date DESC LIMIT 1`,
      [season]
    );

    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No completed races found for this season' });
    }

    const race = raceResult.rows[0];
    const isSprint = race.race_type === 'sprint';
    const maxPositions = isSprint ? 8 : 10;
    const resultsTable = isSprint ? 'sprint_results' : 'race_results';
    const predictionsTable = isSprint ? 'sprint_predictions' : 'predictions';

    // Get actual race results with driver names
    const actualsResult = await query(
      `SELECT rr.position, d.name AS driver_name
       FROM ${resultsTable} rr
       JOIN drivers d ON rr.driver_id = d.id
       WHERE rr.race_id = $1
       ORDER BY rr.position ASC`,
      [race.id]
    );
    const actuals = actualsResult.rows.map((r: any) => ({ position: r.position, driverName: r.driver_name }));

    // Get all users with predictions for this race
    const posColumns = Array.from({ length: maxPositions }, (_, i) => `p.position_${i + 1}`).join(', ');
    const predictionsResult = await query(
      `SELECT u.email, u.nickname, u.total_points, p.points_earned, ${posColumns}
       FROM ${predictionsTable} p
       JOIN users u ON p.user_id = u.id
       WHERE p.race_id = $1`,
      [race.id]
    );

    if (predictionsResult.rows.length === 0) {
      return res.status(404).json({ error: `No predictions found for ${race.race_name}` });
    }

    // Collect all driver IDs we need to resolve
    const allDriverIds = new Set<number>();
    for (const pred of predictionsResult.rows) {
      for (let i = 1; i <= maxPositions; i++) {
        const driverId = pred[`position_${i}`];
        if (driverId) allDriverIds.add(driverId);
      }
    }

    const driversResult = await query(
      `SELECT id, name FROM drivers WHERE id = ANY($1)`,
      [Array.from(allDriverIds)]
    );
    const driverNameMap = new Map<number, string>(driversResult.rows.map((d: any) => [d.id, d.name]));

    // Send email to each user
    let successCount = 0;
    let failCount = 0;

    for (const pred of predictionsResult.rows) {
      const predictions = [];
      for (let i = 1; i <= maxPositions; i++) {
        const driverId = pred[`position_${i}`];
        predictions.push({
          position: i,
          driverName: driverId ? (driverNameMap.get(driverId) || 'Unknown') : 'Not set'
        });
      }

      const ok = await sendPersonalRaceResults(
        pred.email,
        pred.nickname,
        race.race_name,
        race.race_type,
        predictions,
        actuals,
        pred.points_earned || 0,
        pred.total_points
      );

      if (ok) successCount++; else failCount++;
    }

    console.log(`[ADMIN] Personal race results emails sent for ${race.race_name}: ${successCount} success, ${failCount} failed`);

    res.json({
      message: `Emails sent for ${race.race_name}`,
      raceName: race.race_name,
      sent: successCount,
      failed: failCount,
      total: predictionsResult.rows.length
    });
  } catch (error) {
    console.error('Send last race results error:', error);
    res.status(500).json({ error: 'Failed to send race results emails' });
  }
};

// Change admin password
export const changeAdminPassword = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Update ADMIN_PASSWORD in environment
    process.env.ADMIN_PASSWORD = password;

    // Also update the .env file if it exists
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(__dirname, '../../.env');

    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.match(/^ADMIN_PASSWORD=.*/m)) {
        envContent = envContent.replace(/^ADMIN_PASSWORD=.*/m, `ADMIN_PASSWORD=${password}`);
      } else {
        envContent += `\nADMIN_PASSWORD=${password}`;
      }
      fs.writeFileSync(envPath, envContent);
    }

    console.log('[ADMIN] Admin password changed');

    res.json({ message: 'Admin password updated successfully' });
  } catch (error) {
    console.error('Change admin password error:', error);
    res.status(500).json({ error: 'Failed to change admin password' });
  }
};

// Set password for a user (admin function)
export const setUserPassword = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const userResult = await query('SELECT id, nickname, email FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update user with password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    console.log(`[ADMIN] Password set for user ${user.nickname} (${user.email})`);

    res.json({
      message: `Password set for ${user.nickname}`,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Set user password error:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
};
