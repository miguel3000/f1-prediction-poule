import { query } from '../config/database';
import { fetchQualifying, storeQualifying } from '../services/qualifyingService';
import { sendAdminAlert } from '../services/emailService';

/**
 * Stores the qualifying order of the current race weekend (sprint qualifying and main
 * qualifying) as soon as a data source has it, so the prediction page shows it.
 *
 * Runs every 10 minutes from Friday to Sunday. It only does real work for a session
 * that should have started and has nothing stored yet, and tries Jolpi and OpenF1.
 * If the data is still missing a few hours after the session, the admin is told once.
 */
async function syncQualifyingResults() {
  try {
    const season = 2026;

    const racesResult = await query(
      `SELECT r.id, r.season, r.round, r.race_name, r.race_date, r.race_type, r.qualifying_alert_sent,
              -- when the qualifying session should long be over and published
              CASE WHEN r.race_type = 'main'
                   THEN COALESCE(r.qualifying_date, r.race_date - INTERVAL '1 day') + INTERVAL '3 hours'
                   ELSE r.race_date - INTERVAL '17 hours'
              END AS expected_by
       FROM races r
       WHERE r.season = $1
         AND r.race_date - INTERVAL '1 day' < NOW()
         AND r.race_date > NOW() - INTERVAL '2 days'
         AND NOT EXISTS (SELECT 1 FROM qualifying_results WHERE race_id = r.id)
       ORDER BY r.race_date DESC`,
      [season]
    );

    if (racesResult.rows.length === 0) {
      process.exit(0);
      return;
    }

    for (const race of racesResult.rows) {
      const label = `${race.race_name} (Round ${race.round}, ${race.race_type})`;
      try {
        const loaded = await fetchQualifying({
          id: race.id,
          season: race.season,
          round: race.round,
          race_date: race.race_date,
          race_type: race.race_type,
        });

        if (loaded) {
          const { stored, unknown } = await storeQualifying(
            { id: race.id, season: race.season, round: race.round, race_date: race.race_date, race_type: race.race_type },
            loaded.rows
          );
          console.log(`[CRON] Stored ${stored.length} qualifying results for ${label} from ${loaded.source} (${unknown} unknown drivers)`);
          continue;
        }

        const overdue = new Date(race.expected_by).getTime() < Date.now();
        console.log(`[CRON] No qualifying results yet for ${label}${overdue ? ' (overdue)' : ''}`);

        if (overdue && !race.qualifying_alert_sent) {
          const sent = await sendAdminAlert(
            `Qualifying results missing — ${race.race_name}`,
            `The ${race.race_type === 'sprint' ? 'sprint qualifying' : 'qualifying'} of ${label} should have been ` +
              `over for a few hours, but neither Jolpi nor OpenF1 has results for it yet. The prediction page keeps ` +
              `showing the previous race's order until they appear. The job keeps retrying every 10 minutes. ` +
              `If this stays, check both sources and the Pitlane sync.`
          );
          if (sent) {
            await query('UPDATE races SET qualifying_alert_sent = TRUE WHERE id = $1', [race.id]);
          }
        }
      } catch (error) {
        console.error(`[CRON] Error syncing qualifying for ${label}:`, error);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('[CRON] Error in qualifying results sync:', error);
    process.exit(1);
  }
}

syncQualifyingResults();
