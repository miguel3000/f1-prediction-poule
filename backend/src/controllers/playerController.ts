import { Request, Response } from 'express';
import { resolvePoule } from '../services/pouleScope';
import { GroupError } from '../services/groupService';
import { seasonFromQuery } from '../services/season';
import { getPlayerPage } from '../services/playerPredictionsService';
import { sendGroupError } from './groupController';

// One player's predictions against the results (the player page). Who may look at whom is decided by
// the poule, exactly as for the standings: the viewer's own right to the poule first, then whether
// the player is in it. A player outside it looks the same as one that does not exist.
export const getPlayerPredictions = async (req: Request, res: Response) => {
  try {
    const poule = typeof req.query.poule === 'string' ? req.query.poule : undefined;
    const scope = await resolvePoule((req as any).userId, poule);
    const season = await seasonFromQuery(req.query.season);

    const targetId = /^\d{1,9}$/.test(req.params.id) ? parseInt(req.params.id, 10) : NaN;
    if (!Number.isInteger(targetId) || !scope.userIds.includes(targetId)) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const page = await getPlayerPage(targetId, scope.userIds, season);
    if (!page) return res.status(404).json({ error: 'Player not found' });
    res.json(page);
  } catch (error) {
    if (error instanceof GroupError) return sendGroupError(res, error);
    console.error('Get player predictions error:', error);
    res.status(500).json({ error: 'Failed to get the player' });
  }
};
