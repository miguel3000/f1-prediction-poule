import pool, { query } from '../config/database';

// Persists FP1/FP2/FP3 results taken from the live timing feed into
// practice_results, since Jolpi has no practice endpoint at all.

export interface PracticeRow {
  position: number;
  driver_number: number;
  driver_name: string;
  driver_code: string | null;
  team: string | null;
  best_time: string;
  laps: number;
}

interface PracticeJob {
  session: number;
  startMs: number;
  final: boolean;
  rows: PracticeRow[];
}

const OVER_STATES = ['Finished', 'Finalised', 'Ends'];

// SessionInfo.StartDate is local wall-clock time and GmtOffset its UTC offset
// ("04:00:00" / "-05:00:00"), so UTC = wall-clock minus offset.
function sessionStartUtcMs(startDate: string, gmtOffset?: string): number | null {
  const wallClock = Date.parse(startDate.endsWith('Z') ? startDate : `${startDate}Z`);
  if (Number.isNaN(wallClock)) return null;
  const m = /^(-?)(\d+):(\d{2})(?::(\d{2}))?$/.exec(gmtOffset || '00:00:00');
  const offsetMs = m
    ? (m[1] ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0)) * 1000
    : 0;
  return wallClock - offsetMs;
}

// Reads the live state SYNCHRONOUSLY into plain values. The caller's state
// object is mutated in place by the feed merge, so nothing here may hold a
// reference to it across an await.
export function buildPracticeJob(state: any): PracticeJob | null {
  const info = state?.SessionInfo;
  const match = /^Practice ([123])$/.exec(info?.Name || '');
  if (info?.Type !== 'Practice' || !match || !info.StartDate) return null;

  const startMs = sessionStartUtcMs(info.StartDate, info.GmtOffset);
  const lines = state?.TimingData?.Lines;
  if (startMs === null || !lines || typeof lines !== 'object') return null;

  const drivers = state?.DriverList || {};
  const rows: PracticeRow[] = [];

  for (const [num, line] of Object.entries<any>(lines)) {
    if (!/^\d+$/.test(num) || !line || typeof line !== 'object') continue;
    const d = drivers[num] && typeof drivers[num] === 'object' ? drivers[num] : {};
    const name =
      d.FirstName && d.LastName ? `${d.FirstName} ${d.LastName}` : d.FullName || `Driver #${num}`;
    rows.push({
      position: parseInt(line.Position, 10) || 0,
      driver_number: parseInt(num, 10),
      driver_name: String(name).slice(0, 255),
      driver_code: d.Tla ? String(d.Tla).slice(0, 10) : null,
      team: d.TeamName ? String(d.TeamName).slice(0, 255) : null,
      best_time: typeof line.BestLapTime?.Value === 'string' ? line.BestLapTime.Value.slice(0, 20) : '',
      laps: Number(line.NumberOfLaps) || 0,
    });
  }

  // Nothing worth storing before the first timed lap.
  if (!rows.some((r) => r.best_time)) return null;

  rows.sort((a, b) => (a.position || 999) - (b.position || 999) || a.driver_number - b.driver_number);
  rows.forEach((r, i) => {
    r.position = i + 1;
  });

  return {
    session: Number(match[1]),
    startMs,
    final: OVER_STATES.includes(state?.SessionStatus?.Status),
    rows,
  };
}

// The practice session starts 0-4 days before its weekend's main race.
// Sprint rows are skipped (their date is approximate) and nothing falls back
// to "nearest race", so pre-season testing can never be filed under round 1.
async function resolveRound(startMs: number): Promise<number | null> {
  const wallClock = new Date(startMs).toISOString().slice(0, 19).replace('T', ' ');
  const season = new Date(startMs).getUTCFullYear();
  const result = await query(
    `SELECT round FROM races
     WHERE season = $1 AND race_type = 'main'
       AND race_date >= $2::timestamp AND race_date <= ($2::timestamp + INTERVAL '4 days')
     ORDER BY race_date ASC LIMIT 1`,
    [season, wallClock]
  );
  return result.rows.length > 0 ? result.rows[0].round : null;
}

export async function savePracticeRows(
  season: number,
  round: number,
  session: number,
  rows: PracticeRow[],
  final: boolean,
  source: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // A live (not-yet-final) write must never clobber a finished session.
    if (!final) {
      const existing = await client.query(
        `SELECT 1 FROM practice_results
         WHERE season = $1 AND round = $2 AND session = $3 AND final = TRUE LIMIT 1`,
        [season, round, session]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return false;
      }
    }

    await client.query(
      'DELETE FROM practice_results WHERE season = $1 AND round = $2 AND session = $3',
      [season, round, session]
    );
    for (const r of rows) {
      await client.query(
        `INSERT INTO practice_results
           (season, round, session, position, driver_number, driver_name, driver_code, team, best_time, laps, final, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [season, round, session, r.position, r.driver_number, r.driver_name, r.driver_code, r.team, r.best_time, r.laps, final, source]
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

// Writes are serialized, and skipped when nothing changed since the last
// successful write, so calling this every few seconds costs no DB traffic
// outside a live session.
let writeQueue: Promise<void> = Promise.resolve();
const lastWritten = new Map<string, string>();

export function persistPracticeFromState(state: any): void {
  const job = buildPracticeJob(state);
  if (!job) return;

  const memoKey = `${job.startMs}:${job.session}`;
  const signature = JSON.stringify([job.final, job.rows]);
  if (lastWritten.get(memoKey) === signature) return;

  writeQueue = writeQueue
    .then(async () => {
      const round = await resolveRound(job.startMs);
      if (round === null) {
        console.log(`[practice] No main race within 4 days of FP${job.session} start, not saving`);
      } else {
        const season = new Date(job.startMs).getUTCFullYear();
        const saved = await savePracticeRows(season, round, job.session, job.rows, job.final, 'live');
        if (saved) console.log(`[practice] Saved FP${job.session} round ${round} (${job.rows.length} drivers, final=${job.final})`);
      }
      lastWritten.set(memoKey, signature);
    })
    .catch((error) => {
      console.error('[practice] Failed to persist practice results:', error?.message || error);
    });
}
