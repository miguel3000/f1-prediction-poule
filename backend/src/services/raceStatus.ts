import { query } from '../config/database';

// A race waits for its final run from the moment its provisional results are out until that run
// has processed it (status 'provisional', final_results_processed FALSE). The scheduled final job
// and the Pitlane's "Run final results" both look for exactly this state.
export const isAwaitingFinal = async (raceId: number): Promise<boolean> => {
  const result = await query(
    `SELECT 1 FROM races WHERE id = $1 AND status = 'provisional' AND final_results_processed = FALSE`,
    [raceId]
  );
  return result.rows.length > 0;
};

// Results were just stored by hand (Pitlane sync). The race counts as completed, except one that is
// still waiting for its final run: closing that one would mean the final run skips it, so the
// penalties handed out after the flag would never reach the stored results.
export const markResultsSynced = async (raceId: number): Promise<void> => {
  await query(
    `UPDATE races
     SET status = CASE WHEN status = 'provisional' AND final_results_processed = FALSE THEN 'provisional' ELSE 'completed' END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [raceId]
  );
};
