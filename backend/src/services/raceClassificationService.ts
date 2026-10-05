import pool, { query } from '../config/database';
import { normalizeStatus, NormalizedStatus } from '../utils/resultStatus';

// Saves the final classification of a race or sprint from F1's live timing
// feed into race_classifications, so the results cross-check can use the feed
// as a third source long after the session ended (the in-memory feed state is
// replaced by the next session, and lost on every redeploy).

export interface ClassificationRow {
  driver_number: number;
  position: number;
  status: NormalizedStatus;
  laps: number;
}

interface ClassificationJob {
  kind: 'main' | 'sprint';
  startMs: number;
  final: boolean;
  rows: ClassificationRow[];
}

const OVER_STATES = ['Finished', 'Finalised', 'Ends'];
const FINAL_STATES = ['Finalised', 'Ends'];

// SessionInfo.StartDate is local wall-clock time and GmtOffset its UTC offset.
function sessionStartUtcMs(startDate: string, gmtOffset?: string): number | null {
  const wallClock = Date.parse(startDate.endsWith('Z') ? startDate : `${startDate}Z`);
  if (Number.isNaN(wallClock)) return null;
  const m = /^(-?)(\d+):(\d{2})(?::(\d{2}))?$/.exec(gmtOffset || '00:00:00');
  const offsetMs = m
    ? (m[1] ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0)) * 1000
    : 0;
  return wallClock - offsetMs;
}

// Reads the live state SYNCHRONOUSLY into plain values (the feed merge mutates
// the state object in place, so nothing may hold a reference across an await).
// Only a finished race/sprint is worth keeping — a half-run race has no classification.
export function buildClassificationJob(state: any): ClassificationJob | null {
  const info = state?.SessionInfo;
  if (info?.Type !== 'Race' || !info.StartDate) return null;
  const kind = info.Name === 'Race' ? 'main' : info.Name === 'Sprint' ? 'sprint' : null;
  if (!kind) return null;
  if (!OVER_STATES.includes(state?.SessionStatus?.Status)) return null;

  const startMs = sessionStartUtcMs(info.StartDate, info.GmtOffset);
  const lines = state?.TimingData?.Lines;
  if (startMs === null || !lines || typeof lines !== 'object') return null;

  const rows: ClassificationRow[] = [];
  for (const [num, line] of Object.entries<any>(lines)) {
    if (!/^\d+$/.test(num) || !line || typeof line !== 'object') continue;
    const position = parseInt(line.Position, 10);
    if (!Number.isInteger(position) || position < 1) continue;
    rows.push({
      driver_number: parseInt(num, 10),
      position,
      // The feed flags a car that stopped on track (Stopped) or was retired (Retired).
      status: line.Stopped === true || line.Retired === true ? 'dnf' : 'finished',
      laps: Number(line.NumberOfLaps) || 0,
    });
  }

  if (rows.length < 10) return null;
  rows.sort((a, b) => a.position - b.position);

  return {
    kind,
    startMs,
    final: FINAL_STATES.includes(state?.SessionStatus?.Status),
    rows,
  };
}

// A main race belongs to the round whose race_date is within a couple of hours
// of its start; a sprint to the round whose main race follows within 3 days
// (sprint rows' own dates are approximate, so they are never matched directly).
async function resolveRound(kind: 'main' | 'sprint', startMs: number): Promise<number | null> {
  const wallClock = new Date(startMs).toISOString().slice(0, 19).replace('T', ' ');
  const season = new Date(startMs).getUTCFullYear();
  const window =
    kind === 'main'
      ? { before: '3 hours', after: '3 hours' }
      : { before: '0 hours', after: '3 days' };
  const result = await query(
    `SELECT round FROM races
     WHERE season = $1 AND race_type = 'main'
       AND race_date >= ($2::timestamp - $3::interval) AND race_date <= ($2::timestamp + $4::interval)
     ORDER BY race_date ASC LIMIT 1`,
    [season, wallClock, window.before, window.after]
  );
  return result.rows.length > 0 ? result.rows[0].round : null;
}

async function saveClassification(
  season: number,
  round: number,
  job: ClassificationJob
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!job.final) {
      const existing = await client.query(
        `SELECT 1 FROM race_classifications
         WHERE season = $1 AND round = $2 AND kind = $3 AND final = TRUE LIMIT 1`,
        [season, round, job.kind]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return false;
      }
    }
    await client.query('DELETE FROM race_classifications WHERE season = $1 AND round = $2 AND kind = $3', [
      season,
      round,
      job.kind,
    ]);
    for (const r of job.rows) {
      await client.query(
        `INSERT INTO race_classifications (season, round, kind, driver_number, position, status, laps, final)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [season, round, job.kind, r.driver_number, r.position, r.status, r.laps, job.final]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

let writeQueue: Promise<void> = Promise.resolve();
const lastWritten = new Map<string, string>();

export function persistRaceClassificationFromState(state: any): void {
  const job = buildClassificationJob(state);
  if (!job) return;

  const memoKey = `${job.startMs}:${job.kind}`;
  const signature = JSON.stringify([job.final, job.rows]);
  if (lastWritten.get(memoKey) === signature) return;

  writeQueue = writeQueue
    .then(async () => {
      const round = await resolveRound(job.kind, job.startMs);
      if (round === null) {
        console.log(`[classification] No matching round for the ${job.kind} that started ${new Date(job.startMs).toISOString()}, not saving`);
      } else {
        const season = new Date(job.startMs).getUTCFullYear();
        const saved = await saveClassification(season, round, job);
        if (saved) console.log(`[classification] Saved ${job.kind} round ${round} (${job.rows.length} drivers, final=${job.final})`);
      }
      lastWritten.set(memoKey, signature);
    })
    .catch((error) => {
      console.error('[classification] Failed to persist race classification:', error?.message || error);
    });
}

export const getLiveClassification = async (
  season: number,
  round: number,
  kind: 'main' | 'sprint'
): Promise<{ rows: ClassificationRow[]; final: boolean } | null> => {
  const result = await query(
    `SELECT driver_number, position, status, laps, final FROM race_classifications
     WHERE season = $1 AND round = $2 AND kind = $3 ORDER BY position ASC`,
    [season, round, kind]
  );
  if (result.rows.length === 0) return null;
  return {
    rows: result.rows.map((r: any) => ({
      driver_number: r.driver_number,
      position: r.position,
      status: normalizeStatus(r.status),
      laps: r.laps ?? 0,
    })),
    final: result.rows.every((r: any) => r.final),
  };
};
