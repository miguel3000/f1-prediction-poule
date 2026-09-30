import { query } from '../config/database';
import { sendMissedPredictionReminder } from '../services/emailService';

/**
 * Runs ~1 hour before lights out. For any race/sprint in that window, emails
 * every user who hasn't submitted a prediction yet — last chance before the
 * race locks and copyMissingPredictions.ts fills in their last pick instead.
 */
async function sendMissedPredictionReminders() {
  try {
    console.log('[CRON] Starting missed-prediction reminder check...');
    const season = 2026;

    // Find races starting in 55-65 minutes that haven't had a reminder sent yet.
    // The 10-minute window absorbs the cron's own polling interval.
    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type
       FROM races r
       WHERE r.season = $1
         AND r.race_date - INTERVAL '65 minutes' < NOW()
         AND r.race_date - INTERVAL '55 minutes' > NOW()
         AND r.status = 'upcoming'
         AND r.reminder_sent = FALSE
       ORDER BY r.race_date ASC`,
      [season]
    );

    const races = racesResult.rows;

    if (races.length === 0) {
      console.log('[CRON] No races need a missed-prediction reminder right now');
      process.exit(0);
      return;
    }

    for (const race of races) {
      const isSprint = race.race_type === 'sprint';
      const predictionTable = isSprint ? 'sprint_predictions' : 'predictions';
      console.log(`[CRON] Checking missing ${isSprint ? 'sprint ' : ''}predictions for ${race.race_name} (Round ${race.round})...`);

      const usersWithoutPrediction = await query(
        `SELECT u.id, u.nickname, u.email
         FROM users u
         WHERE NOT EXISTS (
           SELECT 1 FROM ${predictionTable} p WHERE p.user_id = u.id AND p.race_id = $1
         )`,
        [race.id]
      );

      console.log(`[CRON] ${usersWithoutPrediction.rows.length} user(s) still need to predict for ${race.race_name}`);

      for (const user of usersWithoutPrediction.rows) {
        try {
          await sendMissedPredictionReminder(user.email, user.nickname, race.race_name, isSprint);
        } catch (emailError) {
          console.error(`[CRON] Error sending missed-prediction reminder to ${user.email}:`, emailError);
        }
      }

      // Mark sent even if nobody needed one, so this race isn't re-checked every poll.
      await query(`UPDATE races SET reminder_sent = TRUE WHERE id = $1`, [race.id]);
      console.log(`[CRON] ✓ Missed-prediction reminders processed for ${race.race_name}`);
    }

    console.log('[CRON] Missed-prediction reminder check completed');
    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error sending missed-prediction reminders:', error);
    process.exit(1);
  }
}

sendMissedPredictionReminders();
