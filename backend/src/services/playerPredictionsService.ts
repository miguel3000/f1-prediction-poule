import { query } from '../config/database';
import { seasonPointsCte } from './seasonPoints';
import { isPredictionLocked } from '../utils/predictionLock';
import { normalizeStatus, firstOutDriverId, NormalizedStatus } from '../utils/resultStatus';
import { judgePick, PickHit } from '../utils/scoring';

// The player page: one player's predictions against the real results, race by race. Only races that
// have started are listed (the same moment other players' picks become visible), and only races the
// player predicted. Every pick is marked by the scoring rule itself (utils/scoring.ts), so a colour
// on the page can never disagree with the points.

export interface DriverRef { id: number; name: string; name_acronym: string | null; team: string }
export interface Finished { position: number; status: NormalizedStatus }
export interface PagePick { position: number; driver: DriverRef | null; hit: PickHit | null; finished: Finished | null }
export interface PageRace {
  race: { id: number; round: number; race_name: string; race_type: 'main' | 'sprint'; race_date: string };
  slots: number;
  result: null | { top: Array<{ position: number; driver: DriverRef | null }>; first_out: DriverRef | null };
  prediction: {
    picks: PagePick[];
    dnf_pick: null | { driver: DriverRef; hit: boolean | null; finished: Finished | null };
    points: number | null;
  };
}
export interface PlayerPage {
  player: { id: number; nickname: string; avatar_url: string | null; rank: number; total_points: number };
  poule_size: number;
  stats: { exact: number; near: number; first_retirement_right: number; first_retirement_races: number };
  races: PageRace[];
}

const SPRINT_SLOTS = 8;
const MAIN_SLOTS = 10;

export const getPlayerPage = async (
  targetId: number,
  pouleUserIds: number[],
  season: number
): Promise<PlayerPage | null> => {
  const player = (await query('SELECT id, nickname, avatar_url FROM users WHERE id = $1', [targetId])).rows[0];
  if (!player) return null;

  // Rank and points the way the Championship page works them out: season total, then nickname.
  const standings = (
    await query(
      `WITH ${seasonPointsCte('$2')}
       SELECT u.id, COALESCE(sp.points, 0) AS points
       FROM users u LEFT JOIN season_points sp ON sp.user_id = u.id
       WHERE u.id = ANY($1)
       ORDER BY COALESCE(sp.points, 0) DESC, u.nickname ASC`,
      [pouleUserIds, season]
    )
  ).rows;
  const standing = standings.findIndex((r: any) => r.id === targetId);

  const started = (
    await query(
      `SELECT id, round, race_name, race_type, race_date FROM races WHERE season = $1 ORDER BY race_date DESC`,
      [season]
    )
  ).rows.filter((r: any) => isPredictionLocked(r.race_date));
  const mainIds = started.filter((r: any) => r.race_type !== 'sprint').map((r: any) => r.id);
  const sprintIds = started.filter((r: any) => r.race_type === 'sprint').map((r: any) => r.id);

  const columns = (n: number) => Array.from({ length: n }, (_, i) => `position_${i + 1}`).join(', ');
  const predictions = new Map<number, any>();
  for (const row of (
    await query(`SELECT race_id, ${columns(MAIN_SLOTS)}, dnf_pick, points_earned FROM predictions WHERE user_id = $1 AND race_id = ANY($2)`, [targetId, mainIds])
  ).rows) predictions.set(row.race_id, row);
  for (const row of (
    await query(`SELECT race_id, ${columns(SPRINT_SLOTS)}, points_earned FROM sprint_predictions WHERE user_id = $1 AND race_id = ANY($2)`, [targetId, sprintIds])
  ).rows) predictions.set(row.race_id, row);

  const results = new Map<number, Array<{ driver_id: number; position: number; status: string | null }>>();
  for (const [table, ids] of [['race_results', mainIds], ['sprint_results', sprintIds]] as const) {
    const rows = (
      await query(`SELECT race_id, driver_id, position, status FROM ${table} WHERE race_id = ANY($1) ORDER BY position`, [ids])
    ).rows;
    for (const row of rows) {
      if (!predictions.has(row.race_id)) continue;
      if (!results.has(row.race_id)) results.set(row.race_id, []);
      results.get(row.race_id)!.push(row);
    }
  }

  const driverIds = new Set<number>();
  for (const [raceId, p] of predictions) {
    const slots = started.find((r: any) => r.id === raceId)?.race_type === 'sprint' ? SPRINT_SLOTS : MAIN_SLOTS;
    for (let i = 1; i <= slots; i++) if (p[`position_${i}`]) driverIds.add(p[`position_${i}`]);
    if (p.dnf_pick) driverIds.add(p.dnf_pick);
  }
  for (const rows of results.values()) for (const r of rows) driverIds.add(r.driver_id);
  const drivers = new Map<number, DriverRef>(
    (await query('SELECT id, name, name_acronym, team FROM drivers WHERE id = ANY($1)', [[...driverIds]])).rows.map(
      (d: any) => [d.id, { id: d.id, name: d.name, name_acronym: d.name_acronym ?? null, team: d.team }]
    )
  );
  const driver = (id: number | null | undefined): DriverRef | null => (id ? drivers.get(id) ?? null : null);

  const stats = { exact: 0, near: 0, first_retirement_right: 0, first_retirement_races: 0 };
  const races: PageRace[] = [];
  for (const race of started) {
    const p = predictions.get(race.id);
    if (!p) continue;
    const isSprint = race.race_type === 'sprint';
    const slots = isSprint ? SPRINT_SLOTS : MAIN_SLOTS;
    const rows = results.get(race.id);
    const where = new Map((rows ?? []).map((r) => [r.driver_id, r]));
    const finishedOf = (id: number | null): Finished | null => {
      const r = id ? where.get(id) : undefined;
      return r ? { position: r.position, status: normalizeStatus(r.status) } : null;
    };

    const picks: PagePick[] = Array.from({ length: slots }, (_, i) => {
      const id: number | null = p[`position_${i + 1}`] ?? null;
      const hit = rows ? judgePick(i + 1, id ? where.get(id)?.position : undefined, slots) : null;
      if (hit === 'exact') stats.exact++;
      if (hit === 'near') stats.near++;
      return { position: i + 1, driver: driver(id), hit, finished: finishedOf(id) };
    });

    const firstOutId = rows && !isSprint ? firstOutDriverId(rows) : null;
    let dnfPick: PageRace['prediction']['dnf_pick'] = null;
    if (!isSprint && p.dnf_pick && driver(p.dnf_pick)) {
      const hit = rows ? firstOutId === p.dnf_pick : null;
      dnfPick = { driver: driver(p.dnf_pick)!, hit, finished: finishedOf(p.dnf_pick) };
      if (rows) {
        stats.first_retirement_races++;
        if (hit) stats.first_retirement_right++;
      }
    } else if (!isSprint && rows) {
      stats.first_retirement_races++;
    }

    races.push({
      race: {
        id: race.id,
        round: race.round,
        race_name: race.race_name,
        race_type: isSprint ? 'sprint' : 'main',
        race_date: new Date(race.race_date).toISOString(),
      },
      slots,
      result: rows
        ? {
            top: Array.from({ length: slots }, (_, i) => ({
              position: i + 1,
              driver: driver(rows.find((r) => r.position === i + 1)?.driver_id),
            })),
            first_out: driver(firstOutId),
          }
        : null,
      prediction: { picks, dnf_pick: dnfPick, points: rows ? Number(p.points_earned) || 0 : null },
    });
  }

  return {
    player: {
      id: player.id,
      nickname: player.nickname,
      avatar_url: player.avatar_url ?? null,
      rank: standing === -1 ? standings.length + 1 : standing + 1,
      total_points: standing === -1 ? 0 : Number(standings[standing].points),
    },
    poule_size: standings.length,
    stats,
    races,
  };
};
