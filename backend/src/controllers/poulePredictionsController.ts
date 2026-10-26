import { Request, Response } from 'express';
import { query } from '../config/database';
import { resolvePoule } from '../services/pouleScope';
import { GroupError } from '../services/groupService';
import { sendGroupError } from './groupController';
import { isPredictionLocked } from '../utils/predictionLock';

// Everyone's picks for a race within one poule, but only once the race has started (predictions
// are locked). Never anything about a player beyond nickname and avatar. See group play spec.
export const getPoulePredictions = async (req: Request, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    const race = Number.isInteger(raceId)
      ? (await query('SELECT id, race_name, race_type, race_date, status FROM races WHERE id = $1', [raceId])).rows[0]
      : undefined;
    if (!race) return res.status(404).json({ error: 'Race not found' });

    // Who may ask is decided first, so a poule you are not in never reveals whether a race has started.
    const poule = typeof req.query.poule === 'string' ? req.query.poule : undefined;
    const scope = await resolvePoule((req as any).userId, poule);

    if (!isPredictionLocked(race.race_date)) {
      return res.status(403).json({ error: 'Predictions are visible once the race has started' });
    }

    const isSprint = race.race_type === 'sprint';
    const slots = isSprint ? 8 : 10;
    const positionColumns = Array.from({ length: slots }, (_, i) => `p.position_${i + 1}`).join(', ');
    const rows = (
      await query(
        `SELECT u.id AS user_id, u.nickname, u.avatar_url, ${positionColumns},
                ${isSprint ? 'NULL::int' : 'p.dnf_pick'} AS dnf_pick, p.points_earned
         FROM ${isSprint ? 'sprint_predictions' : 'predictions'} p
         JOIN users u ON u.id = p.user_id
         WHERE p.race_id = $1 AND p.user_id = ANY($2)
         ORDER BY p.points_earned DESC NULLS LAST, lower(u.nickname)`,
        [raceId, scope.userIds]
      )
    ).rows;

    const driverIds = new Set<number>();
    for (const r of rows) {
      for (let i = 1; i <= slots; i++) if (r[`position_${i}`]) driverIds.add(r[`position_${i}`]);
      if (r.dnf_pick) driverIds.add(r.dnf_pick);
    }
    const drivers = new Map<number, { id: number; name: string; name_acronym: string | null; team: string }>(
      (
        await query('SELECT id, name, name_acronym, team FROM drivers WHERE id = ANY($1)', [[...driverIds]])
      ).rows.map((d: any) => [d.id, { id: d.id, name: d.name, name_acronym: d.name_acronym ?? null, team: d.team }])
    );

    const scored = ['completed', 'provisional'].includes(race.status);
    res.json({
      locked: true,
      race: { id: race.id, race_type: race.race_type, race_name: race.race_name },
      predictions: rows.map((r: any) => ({
        user: { id: r.user_id, nickname: r.nickname, avatar_url: r.avatar_url ?? null },
        picks: Array.from({ length: slots }, (_, i) => ({
          position: i + 1,
          driver: drivers.get(r[`position_${i + 1}`]) ?? null,
        })),
        dnf_pick: r.dnf_pick
          ? { id: r.dnf_pick, name: drivers.get(r.dnf_pick)?.name ?? '', name_acronym: drivers.get(r.dnf_pick)?.name_acronym ?? null }
          : null,
        points_earned: scored ? Number(r.points_earned) || 0 : null,
      })),
    });
  } catch (error) {
    if (error instanceof GroupError) return sendGroupError(res, error);
    console.error('Get poule predictions error:', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
};
