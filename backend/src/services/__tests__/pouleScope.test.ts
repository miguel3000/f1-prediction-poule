import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser } from '../../testing/testDb';
import { createGroup, joinGroup, GroupError } from '../groupService';
import { resolvePoule } from '../pouleScope';

before(async () => {
  await resetTestDatabase();
});
after(async () => {
  await closeTestDatabase();
});

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (e: any) => e instanceof GroupError && e.code === code);
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

test('main_is_every_player_who_plays_in_main', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const hidden = await createTestUser({ playsInMain: false });
  const scope = await resolvePoule(a.id, 'main');
  assert.equal(scope.kind, 'main');
  assert.equal(scope.groupId, null);
  assert.ok(scope.userIds.includes(a.id) && scope.userIds.includes(b.id));
  assert.ok(!scope.userIds.includes(hidden.id));
});

test('a_group_is_exactly_its_members_and_missing_means_main', async () => {
  const owner = await createTestUser({ canStartGroups: true });
  const member = await createTestUser();
  const outsider = await createTestUser();
  const group = await createGroup({ id: owner.id, isAdmin: false }, 'Scope Unit');
  await joinGroup(member.id, group.inviteCode);

  const scope = await resolvePoule(owner.id, String(group.id));
  assert.equal(scope.kind, 'group');
  assert.equal(scope.groupId, group.id);
  assert.deepEqual(sorted(scope.userIds), sorted([owner.id, member.id]));
  assert.equal((await resolvePoule(outsider.id, undefined)).kind, 'main');
  assert.equal((await resolvePoule(outsider.id, '')).kind, 'main');
});

test('asking_for_a_group_you_are_not_in_or_a_bad_id_is_not_found', async () => {
  const owner = await createTestUser({ canStartGroups: true });
  const outsider = await createTestUser();
  const group = await createGroup({ id: owner.id, isAdmin: false }, 'Private Unit');
  await rejectsWith(resolvePoule(outsider.id, String(group.id)), 'not_found');
  await rejectsWith(resolvePoule(outsider.id, 'abc'), 'not_found');
  await rejectsWith(resolvePoule(outsider.id, '99999999'), 'not_found');
});

test('a_group_only_player_gets_forbidden_for_main_and_defaults_to_their_first_group', async () => {
  const owner = await createTestUser({ canStartGroups: true });
  const solo = await createTestUser();
  const z = await createGroup({ id: owner.id, isAdmin: false }, 'Zulu Crew');
  const a = await createGroup({ id: owner.id, isAdmin: false }, 'Alpha Crew');
  await joinGroup(solo.id, z.inviteCode, false);
  await joinGroup(solo.id, a.inviteCode);
  await rejectsWith(resolvePoule(solo.id, 'main'), 'forbidden');
  const fallback = await resolvePoule(solo.id, undefined);
  assert.equal(fallback.groupId, a.id); // first by name
});

test('a_player_with_no_poule_at_all_is_not_found', async () => {
  const nobody = await createTestUser({ playsInMain: false });
  await rejectsWith(resolvePoule(nobody.id, undefined), 'not_found');
  assert.equal((await query('SELECT 1 FROM users WHERE id = $1', [nobody.id])).rows.length, 1);
});
