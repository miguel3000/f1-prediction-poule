import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser } from '../../testing/testDb';
import { createGroupRoutes } from '../groups';
import authRoutes from '../auth';
import adminRoutes from '../admin';

type U = { id: number; nickname: string };
const servers: Server[] = [];

const startApp = (mount: (app: express.Express) => void) =>
  new Promise<string>((resolve) => {
    const app = express();
    app.use(express.json());
    mount(app);
    const server = app.listen(0, () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });

let base = '';
before(async () => {
  await resetTestDatabase();
  base = await startApp((app) => {
    app.use('/api/groups', createGroupRoutes());
    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);
  });
});
after(async () => {
  // fetch keeps connections alive; without this the test process would wait for them to time out
  servers.forEach((s) => {
    s.closeAllConnections();
    s.close();
  });
  await closeTestDatabase();
});

const tokenFor = (u: U) => jwt.sign({ userId: u.id, email: 'x@example.invalid' }, process.env.JWT_SECRET!);
const call = async (url: string, method: string, user?: U, body?: unknown) => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, text, json };
};
const api = (method: string, path: string, user?: U, body?: unknown) => call(`${base}${path}`, method, user, body);
let n = 0;
const uniqueName = () => `Http Group ${++n} ${Math.random().toString(36).slice(2, 7)}`;
const newStarterGroup = async () => {
  const owner = await createTestUser({ canStartGroups: true });
  const res = await api('POST', '/api/groups', owner, { name: uniqueName() });
  return { owner, group: res.json as { id: number; name: string; inviteCode: string } };
};

test('create_is_403_without_the_switch_and_201_with_it', async () => {
  const player = await createTestUser();
  assert.equal((await api('POST', '/api/groups', player, { name: uniqueName() })).status, 403);
  const starter = await createTestUser({ canStartGroups: true });
  const created = await api('POST', '/api/groups', starter, { name: uniqueName() });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.json).sort(), ['id', 'inviteCode', 'name']);
  assert.equal((await api('POST', '/api/groups', starter)).status, 400);
});

test('taken_name_is_409_with_a_readable_message', async () => {
  const { group } = await newStarterGroup();
  const other = await createTestUser({ canStartGroups: true });
  const clash = await api('POST', '/api/groups', other, { name: group.name.toUpperCase() });
  assert.equal(clash.status, 409);
  assert.equal(clash.json.error, 'That group name is already taken');
});

test('preview_has_no_auth_and_reveals_only_the_name', async () => {
  const { group } = await newStarterGroup();
  const res = await api('GET', `/api/groups/join/${group.inviteCode}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { name: group.name });
});

test('unknown_and_reset_codes_return_the_same_404_body', async () => {
  const { owner, group } = await newStarterGroup();
  const old = group.inviteCode;
  await api('POST', `/api/groups/${group.id}/new-link`, owner);
  const unknown = await api('GET', `/api/groups/join/${'z'.repeat(32)}`);
  const reset = await api('GET', `/api/groups/join/${old}`);
  const malformed = await api('GET', '/api/groups/join/short');
  assert.equal(unknown.status, 404);
  assert.equal(reset.status, 404);
  assert.equal(malformed.status, 404);
  assert.equal(unknown.text, reset.text);
  assert.equal(unknown.text, malformed.text);
});

test('preview_is_rate_limited_after_20_requests_in_a_minute', async () => {
  const limitedBase = await startApp((app) => app.use('/api/groups', createGroupRoutes()));
  const statuses: number[] = [];
  for (let i = 0; i < 21; i++) statuses.push((await call(`${limitedBase}/api/groups/join/${'q'.repeat(32)}`, 'GET')).status);
  assert.ok(statuses.slice(0, 20).every((s) => s === 404));
  assert.equal(statuses[20], 429);
});

test('join_then_mine_lists_the_group_without_the_code_for_a_member', async () => {
  const { owner, group } = await newStarterGroup();
  const friend = await createTestUser();
  const joined = await api('POST', '/api/groups/join', friend, { code: group.inviteCode, playsInMain: false });
  assert.equal(joined.status, 200);
  assert.deepEqual(joined.json, { groupId: group.id, name: group.name, alreadyMember: false });
  assert.equal((await api('POST', '/api/groups/join', friend, { code: group.inviteCode })).json.alreadyMember, true);
  assert.equal((await api('POST', '/api/groups/join', friend, { code: 'nope-nope-nope-nope-nope-nope' })).status, 404);
  assert.equal((await api('POST', '/api/groups/join', friend, { code: group.inviteCode, playsInMain: 'yes' })).status, 400);

  const mine = await api('GET', '/api/groups/mine', friend);
  assert.equal(mine.json.playsInMain, false);
  assert.equal(mine.json.groups.length, 1);
  assert.equal(mine.json.groups[0].inviteCode, null);
  const ownersMine = await api('GET', '/api/groups/mine', owner);
  assert.equal(ownersMine.json.groups[0].inviteCode, group.inviteCode);
});

test('members_endpoint_is_404_for_non_members', async () => {
  const { owner, group } = await newStarterGroup();
  const stranger = await createTestUser();
  assert.equal((await api('GET', `/api/groups/${group.id}/members`, stranger)).status, 404);
  const ok = await api('GET', `/api/groups/${group.id}/members`, owner);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.map((m: any) => m.id), [owner.id]);
  assert.ok(!ok.text.includes('@'));
});

test('owner_manages_the_group_over_http', async () => {
  const { owner, group } = await newStarterGroup();
  const member = await createTestUser();
  await api('POST', '/api/groups/join', member, { code: group.inviteCode });
  const taken = await newStarterGroup();

  assert.equal((await api('PATCH', `/api/groups/${group.id}`, owner, { name: taken.group.name })).status, 409);
  assert.equal((await api('PATCH', `/api/groups/${group.id}`, member, { name: uniqueName() })).status, 403);
  const renamed = await api('PATCH', `/api/groups/${group.id}`, owner, { name: 'Renamed Over Http' });
  assert.equal(renamed.status, 200);
  const link = await api('POST', `/api/groups/${group.id}/new-link`, owner);
  assert.equal(link.status, 200);
  assert.notEqual(link.json.inviteCode, group.inviteCode);

  assert.equal((await api('POST', `/api/groups/${group.id}/leave`, owner)).status, 403);
  assert.equal((await api('POST', `/api/groups/${group.id}/leave`, member)).status, 200);
  await api('POST', '/api/groups/join', member, { code: link.json.inviteCode });
  assert.equal((await api('DELETE', `/api/groups/${group.id}/members/${member.id}`, owner)).status, 200);
  assert.equal((await api('DELETE', `/api/groups/${group.id}`, member)).status, 404);
  assert.equal((await api('DELETE', `/api/groups/${group.id}`, owner)).status, 200);
  assert.equal((await query('SELECT 1 FROM groups WHERE id = $1', [group.id])).rows.length, 0);
});

test('profile_reports_the_new_fields_and_plays_in_main_can_be_toggled', async () => {
  const player = await createTestUser();
  const profile = await api('GET', '/api/auth/profile', player);
  assert.equal(profile.json.can_start_groups, false);
  assert.equal(profile.json.plays_in_main, true);
  assert.equal((await api('PUT', '/api/auth/plays-in-main', player, { value: false })).status, 200);
  assert.equal((await api('GET', '/api/auth/profile', player)).json.plays_in_main, false);
  assert.equal((await api('PUT', '/api/auth/plays-in-main', player, { value: 'no' })).status, 400);
});

test('admin_switch_requires_a_boolean_and_an_admin', async () => {
  const player = await createTestUser();
  const admin = await createTestUser({ isAdmin: true });
  assert.equal((await api('PUT', `/api/admin/users/${player.id}/group-starter`, player, { enabled: true })).status, 403);
  assert.equal((await api('PUT', `/api/admin/users/${player.id}/group-starter`, admin, { enabled: 'yes' })).status, 400);
  assert.equal((await api('PUT', `/api/admin/users/${player.id}/group-starter`, admin, { enabled: true })).status, 200);
  assert.equal((await api('GET', '/api/auth/profile', player)).json.can_start_groups, true);
  const users = await api('GET', '/api/admin/users', admin);
  assert.equal(users.json.find((u: any) => u.id === player.id).can_start_groups, true);
});

test('admin_can_see_and_manage_all_groups_over_http', async () => {
  const { owner, group } = await newStarterGroup();
  const member = await createTestUser();
  const admin = await createTestUser({ isAdmin: true });
  await api('POST', '/api/groups/join', member, { code: group.inviteCode });

  assert.equal((await api('GET', '/api/admin/groups', owner)).status, 403);
  const listed = await api('GET', '/api/admin/groups', admin);
  const mine = listed.json.find((g: any) => g.id === group.id);
  assert.equal(mine.ownerNickname, owner.nickname);
  assert.deepEqual(mine.members.map((m: any) => m.id).sort(), [owner.id, member.id].sort());
  assert.ok(!listed.text.includes('@'));

  assert.equal((await api('PUT', `/api/admin/groups/${group.id}/owner`, admin, { userId: member.id })).status, 200);
  assert.equal((await api('DELETE', `/api/admin/groups/${group.id}/members/${owner.id}`, admin)).status, 200);
  assert.equal((await api('DELETE', `/api/admin/groups/${group.id}`, admin)).status, 200);
});
