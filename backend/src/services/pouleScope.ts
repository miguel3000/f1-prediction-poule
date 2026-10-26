import { query } from '../config/database';
import { GroupError } from './groupService';

// Which players a standings / stats / predictions request is about: the main poule or one group.
// Every poule-aware query restricts itself to `userIds`, so scoping lives in this one place.

export type PouleScope = { kind: 'main' | 'group'; groupId: number | null; userIds: number[] };

// `poule` is 'main' or a group id (the ?poule= query parameter). Missing means the main poule, or,
// for a player who plays only in groups, their first group by name.
export const resolvePoule = async (viewerId: number, poule: string | undefined): Promise<PouleScope> => {
  const viewer = (await query('SELECT plays_in_main FROM users WHERE id = $1', [viewerId])).rows[0];
  if (!viewer) throw new GroupError('not_found');

  let target = poule;
  if (target === undefined || target === '') {
    if (viewer.plays_in_main) {
      target = 'main';
    } else {
      const first = await query(
        `SELECT g.id FROM group_members m JOIN groups g ON g.id = m.group_id
         WHERE m.user_id = $1 ORDER BY lower(g.name) LIMIT 1`,
        [viewerId]
      );
      if (first.rows.length === 0) throw new GroupError('not_found');
      target = String(first.rows[0].id);
    }
  }

  if (target === 'main') {
    // A group-only player does not see the main poule at all.
    if (!viewer.plays_in_main) throw new GroupError('forbidden');
    const users = await query('SELECT id FROM users WHERE plays_in_main = TRUE');
    return { kind: 'main', groupId: null, userIds: users.rows.map((r: any) => r.id) };
  }

  // A group the viewer is not in looks exactly like one that does not exist.
  if (!/^\d{1,9}$/.test(target)) throw new GroupError('not_found');
  const groupId = parseInt(target, 10);
  const mine = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, viewerId]);
  if (mine.rows.length === 0) throw new GroupError('not_found');
  const users = await query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId]);
  return { kind: 'group', groupId, userIds: users.rows.map((r: any) => r.user_id) };
};
