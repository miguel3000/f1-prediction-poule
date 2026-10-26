import crypto from 'crypto';
import { query, getClient } from '../config/database';

// The rules of group play (private poules): who may start a group, names, invite links, joining,
// leaving and management. No HTTP in here; controllers only translate. See
// docs/superpowers/specs/2026-10-26-group-play-design.md.

export type GroupErrorCode = 'name_invalid' | 'name_taken' | 'not_allowed' | 'invalid_code' | 'not_found' | 'forbidden';

const MESSAGES: Record<GroupErrorCode, string> = {
  name_invalid: 'Group names must be 3 to 40 characters',
  name_taken: 'That group name is already taken',
  not_allowed: 'You are not allowed to start groups',
  invalid_code: 'Invite link is not valid',
  not_found: 'Group not found',
  forbidden: 'You are not allowed to do that',
};

export class GroupError extends Error {
  constructor(public readonly code: GroupErrorCode) {
    super(MESSAGES[code]);
    this.name = 'GroupError';
  }
}

export type Actor = { id: number; isAdmin: boolean };
export type GroupSummary = { id: number; name: string; isOwner: boolean; memberCount: number; inviteCode: string | null };
export type MemberSummary = { id: number; nickname: string; avatar_url: string | null };
export type AdminGroup = {
  id: number;
  name: string;
  ownerId: number | null;
  ownerNickname: string | null;
  members: Array<{ id: number; nickname: string }>;
};

// 24 random bytes: 192 bits, 32 URL-safe characters.
const newCode = (): string => crypto.randomBytes(24).toString('base64url');
const CODE_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export const normalizeGroupName = (raw: string): { name: string; key: string } => {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const key = name.toLowerCase();
  const length = (s: string) => [...s].length;
  if (length(name) < 3 || length(name) > 40 || length(key) > 40) throw new GroupError('name_invalid');
  return { name, key };
};

const isUniqueViolation = (error: any, constraintPart: string): boolean =>
  error?.code === '23505' && String(error?.constraint || '').includes(constraintPart);

export const createGroup = async (
  actor: Actor,
  rawName: string
): Promise<{ id: number; name: string; inviteCode: string }> => {
  const user = await query('SELECT can_start_groups FROM users WHERE id = $1', [actor.id]);
  if (user.rows[0]?.can_start_groups !== true) throw new GroupError('not_allowed');
  const { name, key } = normalizeGroupName(rawName);

  for (let attempt = 0; ; attempt++) {
    const inviteCode = newCode();
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const created = await client.query(
        'INSERT INTO groups (name, name_key, owner_id, invite_code) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, key, actor.id, inviteCode]
      );
      await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [created.rows[0].id, actor.id]);
      await client.query('COMMIT');
      return { id: created.rows[0].id, name, inviteCode };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      // The unique index decides who wins a race for a name; no check-then-insert.
      if (isUniqueViolation(error, 'name_key')) throw new GroupError('name_taken');
      if (isUniqueViolation(error, 'invite_code') && attempt < 2) continue;
      throw error;
    } finally {
      client.release();
    }
  }
};

export const previewByCode = async (code: string): Promise<{ name: string } | null> => {
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) return null;
  const result = await query('SELECT name FROM groups WHERE invite_code = $1', [code]);
  return result.rows.length > 0 ? { name: result.rows[0].name } : null;
};

export const joinGroup = async (
  userId: number,
  code: string,
  playsInMain?: boolean
): Promise<{ groupId: number; name: string; alreadyMember: boolean }> => {
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) throw new GroupError('invalid_code');
  const group = await query('SELECT id, name FROM groups WHERE invite_code = $1', [code]);
  if (group.rows.length === 0) throw new GroupError('invalid_code');

  const inserted = await query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id',
    [group.rows[0].id, userId]
  );
  if (typeof playsInMain === 'boolean') {
    await query('UPDATE users SET plays_in_main = $1 WHERE id = $2', [playsInMain, userId]);
  }
  return { groupId: group.rows[0].id, name: group.rows[0].name, alreadyMember: inserted.rows.length === 0 };
};

// A player who is not in the group (and is not an admin) is told it does not exist, so group ids
// cannot be probed; a member without owner rights is told they may not.
const loadGroupFor = async (groupId: number, actor: Actor, level: 'member' | 'owner') => {
  if (!Number.isInteger(groupId)) throw new GroupError('not_found');
  const group = (await query('SELECT id, name, owner_id FROM groups WHERE id = $1', [groupId])).rows[0];
  if (!group) throw new GroupError('not_found');
  if (actor.isAdmin) return group;
  const isOwner = group.owner_id === actor.id;
  const isMember =
    isOwner ||
    (await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, actor.id])).rows.length > 0;
  if (!isMember) throw new GroupError('not_found');
  if (level === 'owner' && !isOwner) throw new GroupError('forbidden');
  return group;
};

export const leaveGroup = async (userId: number, groupId: number): Promise<void> => {
  const group = Number.isInteger(groupId)
    ? (await query('SELECT owner_id FROM groups WHERE id = $1', [groupId])).rows[0]
    : undefined;
  if (!group) throw new GroupError('not_found');
  // The owner stays until the group is deleted or an admin reassigns it.
  if (group.owner_id === userId) throw new GroupError('forbidden');
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
};

export const renameGroup = async (actor: Actor, groupId: number, rawName: string): Promise<void> => {
  await loadGroupFor(groupId, actor, 'owner');
  const { name, key } = normalizeGroupName(rawName);
  try {
    await query('UPDATE groups SET name = $1, name_key = $2 WHERE id = $3', [name, key, groupId]);
  } catch (error) {
    if (isUniqueViolation(error, 'name_key')) throw new GroupError('name_taken');
    throw error;
  }
};

export const resetInviteCode = async (actor: Actor, groupId: number): Promise<string> => {
  await loadGroupFor(groupId, actor, 'owner');
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    try {
      await query('UPDATE groups SET invite_code = $1 WHERE id = $2', [code, groupId]);
      return code;
    } catch (error) {
      if (isUniqueViolation(error, 'invite_code') && attempt < 2) continue;
      throw error;
    }
  }
};

export const deleteGroup = async (actor: Actor, groupId: number): Promise<void> => {
  await loadGroupFor(groupId, actor, 'owner');
  await query('DELETE FROM groups WHERE id = $1', [groupId]);
};

export const removeMember = async (actor: Actor, groupId: number, userId: number): Promise<void> => {
  const group = await loadGroupFor(groupId, actor, 'owner');
  if (group.owner_id === userId) throw new GroupError('forbidden');
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
};

export const reassignOwner = async (actor: Actor, groupId: number, newOwnerId: number): Promise<void> => {
  if (!actor.isAdmin) throw new GroupError('forbidden');
  await loadGroupFor(groupId, actor, 'owner');
  const member = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, newOwnerId]);
  if (member.rows.length === 0) throw new GroupError('not_found');
  await query('UPDATE groups SET owner_id = $1 WHERE id = $2', [newOwnerId, groupId]);
};

export const listMyGroups = async (userId: number): Promise<GroupSummary[]> => {
  const result = await query(
    `SELECT g.id, g.name, g.owner_id, g.invite_code,
            (SELECT COUNT(*)::int FROM group_members m2 WHERE m2.group_id = g.id) AS member_count
     FROM groups g
     JOIN group_members m ON m.group_id = g.id AND m.user_id = $1
     ORDER BY lower(g.name)`,
    [userId]
  );
  return result.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    isOwner: r.owner_id === userId,
    memberCount: r.member_count,
    inviteCode: r.owner_id === userId ? r.invite_code : null,
  }));
};

export const listMembers = async (actor: Actor, groupId: number): Promise<MemberSummary[]> => {
  await loadGroupFor(groupId, actor, 'member');
  const result = await query(
    `SELECT u.id, u.nickname, u.avatar_url
     FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1
     ORDER BY lower(u.nickname)`,
    [groupId]
  );
  return result.rows.map((r: any) => ({ id: r.id, nickname: r.nickname, avatar_url: r.avatar_url ?? null }));
};

export const listAllGroupsForAdmin = async (): Promise<AdminGroup[]> => {
  const groups = await query(
    `SELECT g.id, g.name, g.owner_id, o.nickname AS owner_nickname
     FROM groups g LEFT JOIN users o ON o.id = g.owner_id
     ORDER BY lower(g.name)`
  );
  const members = await query(
    `SELECT m.group_id, u.id, u.nickname
     FROM group_members m JOIN users u ON u.id = m.user_id
     ORDER BY lower(u.nickname)`
  );
  return groups.rows.map((g: any) => ({
    id: g.id,
    name: g.name,
    ownerId: g.owner_id ?? null,
    ownerNickname: g.owner_nickname ?? null,
    members: members.rows.filter((m: any) => m.group_id === g.id).map((m: any) => ({ id: m.id, nickname: m.nickname })),
  }));
};
