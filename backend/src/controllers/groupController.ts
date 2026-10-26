import { Request, Response } from 'express';
import { query } from '../config/database';
import * as groups from '../services/groupService';
import { GroupError, Actor } from '../services/groupService';

// Thin HTTP layer over services/groupService.ts. Reused by the poule-scoped endpoints, which map
// the same GroupError codes through sendGroupError.

const STATUS: Record<groups.GroupErrorCode, number> = {
  name_invalid: 400,
  name_taken: 409,
  not_allowed: 403,
  forbidden: 403,
  invalid_code: 404,
  not_found: 404,
};

export const sendGroupError = (res: Response, error: unknown) => {
  if (error instanceof GroupError) return res.status(STATUS[error.code]).json({ error: error.message });
  console.error('Group error:', error);
  return res.status(500).json({ error: 'Something went wrong' });
};

const userIdOf = (req: Request): number => (req as any).userId;
const idParam = (req: Request, name = 'id'): number => parseInt(req.params[name], 10);

const actorOf = async (req: Request): Promise<Actor> => {
  const id = userIdOf(req);
  const row = await query('SELECT is_admin FROM users WHERE id = $1', [id]);
  return { id, isAdmin: row.rows[0]?.is_admin === true };
};

// Wraps a handler so every GroupError becomes its HTTP status.
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      sendGroupError(res, error);
    }
  };

export const createGroupHandler = handle(async (req, res) => {
  const name = req.body?.name;
  if (typeof name !== 'string') return res.status(400).json({ error: 'A group name is required' });
  const created = await groups.createGroup(await actorOf(req), name);
  res.status(201).json(created);
});

export const myGroups = handle(async (req, res) => {
  const id = userIdOf(req);
  const user = await query('SELECT plays_in_main FROM users WHERE id = $1', [id]);
  res.json({ playsInMain: user.rows[0]?.plays_in_main !== false, groups: await groups.listMyGroups(id) });
});

export const previewInvite = handle(async (req, res) => {
  const preview = await groups.previewByCode(req.params.code);
  if (!preview) throw new GroupError('invalid_code');
  res.json(preview);
});

export const joinWithCode = handle(async (req, res) => {
  const { code, playsInMain } = req.body || {};
  if (playsInMain !== undefined && typeof playsInMain !== 'boolean') {
    return res.status(400).json({ error: 'playsInMain must be true or false' });
  }
  res.json(await groups.joinGroup(userIdOf(req), code, playsInMain));
});

export const renameGroupHandler = handle(async (req, res) => {
  const name = req.body?.name;
  if (typeof name !== 'string') return res.status(400).json({ error: 'A group name is required' });
  await groups.renameGroup(await actorOf(req), idParam(req), name);
  res.json({ name: groups.normalizeGroupName(name).name });
});

export const newLink = handle(async (req, res) => {
  res.json({ inviteCode: await groups.resetInviteCode(await actorOf(req), idParam(req)) });
});

export const deleteGroupHandler = handle(async (req, res) => {
  await groups.deleteGroup(await actorOf(req), idParam(req));
  res.json({ ok: true });
});

export const members = handle(async (req, res) => {
  res.json(await groups.listMembers(await actorOf(req), idParam(req)));
});

export const removeMemberHandler = handle(async (req, res) => {
  await groups.removeMember(await actorOf(req), idParam(req), idParam(req, 'userId'));
  res.json({ ok: true });
});

export const leave = handle(async (req, res) => {
  await groups.leaveGroup(userIdOf(req), idParam(req));
  res.json({ ok: true });
});

// ---- Admin (behind authenticateAdmin) ----

export const adminListGroups = handle(async (_req, res) => {
  res.json(await groups.listAllGroupsForAdmin());
});

export const adminDeleteGroup = handle(async (req, res) => {
  await groups.deleteGroup({ id: userIdOf(req), isAdmin: true }, idParam(req));
  res.json({ ok: true });
});

export const adminRemoveMember = handle(async (req, res) => {
  await groups.removeMember({ id: userIdOf(req), isAdmin: true }, idParam(req), idParam(req, 'userId'));
  res.json({ ok: true });
});

export const adminReassignOwner = handle(async (req, res) => {
  const userId = req.body?.userId;
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'A user id is required' });
  await groups.reassignOwner({ id: userIdOf(req), isAdmin: true }, idParam(req), userId);
  res.json({ ok: true });
});
