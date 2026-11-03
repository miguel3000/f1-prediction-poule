import { Request, Response } from 'express';
import { query } from '../config/database';
import { finalizeRace, FinalDeps } from '../services/finalResultsService';
import { isAwaitingFinal } from '../services/raceStatus';

// Pitlane side of the final results: run a race's final standings now instead of waiting for the
// scheduled job (which only runs on Sundays and Mondays). The run can take a while because it mails
// every player, so it goes on after the answer and the Pitlane polls the status.
// The sources are injectable so the tests need no network.
export const createFinalResultsHandlers = (deps: Partial<FinalDeps> = {}) => {
  const job: {
    running: boolean;
    raceId: number | null;
    lastRun: Date | null;
    lastStatus: 'done' | 'held' | 'error' | null;
    lastMessage: string | null;
  } = { running: false, raceId: null, lastRun: null, lastStatus: null, lastMessage: null };

  const runFinalResults = async (req: Request, res: Response) => {
    if (job.running) return res.status(409).json({ error: 'A final run is already in progress' });
    job.running = true; // taken before the first await, so a second press cannot slip in behind the checks

    let race: any;
    try {
      const raceId = parseInt(req.params.raceId, 10);
      if (!Number.isInteger(raceId) || raceId <= 0) {
        job.running = false;
        return res.status(400).json({ error: 'raceId must be a positive integer' });
      }
      const found = await query(
        `SELECT id, season, round, race_name, race_date, race_type FROM races WHERE id = $1 AND race_date < NOW()`,
        [raceId]
      );
      if (found.rows.length === 0) {
        job.running = false;
        return res.status(404).json({ error: 'Race not found, or it has not happened yet' });
      }
      race = found.rows[0];
      if (!(await isAwaitingFinal(raceId))) {
        job.running = false;
        return res.status(409).json({
          error: `${race.race_name} is not waiting for its final results (they were already processed, or its provisional results were never sent)`,
        });
      }
    } catch (error) {
      job.running = false;
      console.error('Final results check error:', error);
      return res.status(500).json({ error: 'Failed to start the final results' });
    }

    job.raceId = race.id;
    job.lastStatus = null;
    job.lastMessage = null;
    res.status(202).json({ status: 'running', raceId: race.id });

    try {
      const outcome = await finalizeRace(race, deps);
      job.lastStatus = outcome.done ? 'done' : 'held';
      job.lastMessage = outcome.done
        ? `Final results processed for ${race.race_name}: ${outcome.reason}. ${outcome.emailed} emails sent.`
        : `Nothing changed for ${race.race_name}: ${outcome.reason}`;
    } catch (error: any) {
      console.error(`[FINAL] Error processing ${race.race_name}:`, error);
      job.lastStatus = 'error';
      job.lastMessage = `Final results failed for ${race.race_name}: ${error?.message || 'unknown error'}`;
    } finally {
      job.lastRun = new Date();
      job.running = false;
    }
  };

  const getFinalResultsStatus = (_req: Request, res: Response) => {
    res.json(job);
  };

  return { runFinalResults, getFinalResultsStatus };
};

export const { runFinalResults, getFinalResultsStatus } = createFinalResultsHandlers();
