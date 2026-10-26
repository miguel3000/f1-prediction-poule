import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser } from '../../testing/testDb';
import {
  GroupError,
  normalizeGroupName,
  createGroup,
  previewByCode,
  joinGroup,
  leaveGroup,
  renameGroup,
  resetInviteCode,
  deleteGroup,
  removeMember,
  reassignOwner,
  listMyGroups,
  listMembers,
  listAllGroupsForAdmin,
} from '../groupService';

before(async () => {
  await resetTestDatabase();
});
after(async () => {
  await closeTestDatabase();
});

type U = { id: number; nickname: string };
const actor = (u: U, isAdmin = false) => ({ id: u.id, isAdmin });
const starter = () => createTestUser({ canStartGroups: true });
const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (e: any) => e instanceof GroupError && e.code === code);
let n = 0;
const uniqueName = () => `Group ${++n} ${Math.random().toString(36).slice(2, 7)}`;
const makeGroup = async (owner?: U, name = uniqueName()) => {
  const o = owner ?? (await starter());
  return { owner: o, group: await createGroup(actor(o), name) };
};

test('create_requires_can_start_groups', async () => {
  const player = await createTestUser();
  await rejectsWith(createGroup(actor(player), uniqueName()), 'not_allowed');
});

test('create_makes_the_owner_a_member_and_returns_a_long_code', async () => {
  const a = await makeGroup();
  const b = await makeGroup();
  assert.ok(a.group.inviteCode.length >= 32);
  assert.notEqual(a.group.inviteCode, b.group.inviteCode);
  const row = (await query('SELECT owner_id FROM groups WHERE id = $1', [a.group.id])).rows[0];
  assert.equal(row.owner_id, a.owner.id);
  const members = await query('SELECT user_id FROM group_members WHERE group_id = $1', [a.group.id]);
  assert.deepEqual(members.rows.map((r: any) => r.user_id), [a.owner.id]);
});

test('names_collide_ignoring_case_and_spaces', async () => {
  const first = await makeGroup(undefined, 'Pit Stop');
  assert.ok(first.group.id);
  const other = await starter();
  await rejectsWith(createGroup(actor(other), ' pit  stop '), 'name_taken');
  await rejectsWith(createGroup(actor(other), 'PIT STOP'), 'name_taken');
});

test('simultaneous_creates_with_the_same_name_yield_one_group', async () => {
  const a = await starter();
  const b = await starter();
  const results = await Promise.allSettled([createGroup(actor(a), 'Race Condition'), createGroup(actor(b), 'race condition')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof GroupError && rejected.reason.code === 'name_taken');
  assert.equal((await query("SELECT 1 FROM groups WHERE name_key = 'race condition'")).rows.length, 1);
});

test('name_length_is_3_to_40', async () => {
  const o = await starter();
  for (const bad of ['', '  ', 'ab', 'x'.repeat(41)]) await rejectsWith(createGroup(actor(o), bad), 'name_invalid');
  assert.equal((await createGroup(actor(o), 'abc')).name, 'abc');
  assert.equal((await createGroup(actor(o), 'y'.repeat(40))).name.length, 40);
  assert.deepEqual(normalizeGroupName('  Pit   Stop  '), { name: 'Pit Stop', key: 'pit stop' });
});

test('names_are_stored_as_text', async () => {
  const nasty = `<b>x</b>"'`;
  const { group, owner } = await makeGroup(undefined, nasty);
  assert.equal(group.name, nasty);
  assert.equal((await query('SELECT name FROM groups WHERE id = $1', [group.id])).rows[0].name, nasty);
  assert.equal((await listMyGroups(owner.id))[0].name, nasty);
});

test('preview_returns_only_the_name_and_null_for_unknown_malformed_or_reset_codes', async () => {
  const { group, owner } = await makeGroup();
  const preview = await previewByCode(group.inviteCode);
  assert.deepEqual(preview, { name: group.name });
  for (const bad of ['nope', '', 'x'.repeat(200), "' OR 1=1 --", 'a'.repeat(32)]) assert.equal(await previewByCode(bad), null);
  const fresh = await resetInviteCode(actor(owner), group.id);
  assert.equal(await previewByCode(group.inviteCode), null);
  assert.deepEqual(await previewByCode(fresh), { name: group.name });
});

test('join_is_idempotent_and_sets_plays_in_main_only_when_given', async () => {
  const { group } = await makeGroup();
  const friend = await createTestUser();
  const first = await joinGroup(friend.id, group.inviteCode, false);
  assert.deepEqual(first, { groupId: group.id, name: group.name, alreadyMember: false });
  const playsInMain = async () => (await query('SELECT plays_in_main FROM users WHERE id = $1', [friend.id])).rows[0].plays_in_main;
  assert.equal(await playsInMain(), false);
  const again = await joinGroup(friend.id, group.inviteCode);
  assert.equal(again.alreadyMember, true);
  assert.equal(await playsInMain(), false);
  await joinGroup(friend.id, group.inviteCode, true);
  assert.equal(await playsInMain(), true);
  assert.equal((await query('SELECT COUNT(*)::int AS c FROM group_members WHERE group_id = $1', [group.id])).rows[0].c, 2);
});

test('join_with_a_reset_code_fails_with_invalid_code', async () => {
  const { group, owner } = await makeGroup();
  const friend = await createTestUser();
  await resetInviteCode(actor(owner), group.id);
  await rejectsWith(joinGroup(friend.id, group.inviteCode), 'invalid_code');
  await rejectsWith(joinGroup(friend.id, 'not-a-code'), 'invalid_code');
});

test('leave_twice_is_harmless', async () => {
  const { group } = await makeGroup();
  const friend = await createTestUser();
  await joinGroup(friend.id, group.inviteCode);
  await leaveGroup(friend.id, group.id);
  await assert.doesNotReject(leaveGroup(friend.id, group.id));
  assert.equal((await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [group.id, friend.id])).rows.length, 0);
});

test('owner_cannot_leave_and_must_delete_or_be_reassigned', async () => {
  const { group, owner } = await makeGroup();
  await rejectsWith(leaveGroup(owner.id, group.id), 'forbidden');
});

test('ownerless_group_still_accepts_joins_and_lists_members', async () => {
  const { group, owner } = await makeGroup();
  const early = await createTestUser();
  await joinGroup(early.id, group.inviteCode);
  await query('DELETE FROM users WHERE id = $1', [owner.id]);
  const late = await createTestUser();
  await joinGroup(late.id, group.inviteCode);
  const members = await listMembers(actor(late), group.id);
  assert.deepEqual(members.map((m) => m.id).sort(), [early.id, late.id].sort());
  const listed = (await listAllGroupsForAdmin()).find((g) => g.id === group.id)!;
  assert.equal(listed.ownerId, null);
  assert.equal(listed.ownerNickname, null);
});

test('only_owner_or_admin_can_rename_reset_delete_remove', async () => {
  const { group, owner } = await makeGroup();
  const member = await createTestUser();
  const stranger = await createTestUser();
  const admin = await createTestUser({ isAdmin: true });
  await joinGroup(member.id, group.inviteCode);

  // A member without owner rights is forbidden; a stranger does not even learn the group exists.
  await rejectsWith(renameGroup(actor(member), group.id, uniqueName()), 'forbidden');
  await rejectsWith(resetInviteCode(actor(member), group.id), 'forbidden');
  await rejectsWith(removeMember(actor(member), group.id, owner.id), 'forbidden');
  await rejectsWith(deleteGroup(actor(member), group.id), 'forbidden');
  await rejectsWith(renameGroup(actor(stranger), group.id, uniqueName()), 'not_found');
  await rejectsWith(deleteGroup(actor(stranger), group.id), 'not_found');

  // The owner's own membership cannot be removed.
  await rejectsWith(removeMember(actor(owner), group.id, owner.id), 'forbidden');

  await renameGroup(actor(owner), group.id, 'Renamed By Owner');
  await resetInviteCode(actor(admin, true), group.id);
  await removeMember(actor(owner), group.id, member.id);
  assert.equal((await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [group.id, member.id])).rows.length, 0);
  await deleteGroup(actor(admin, true), group.id);
  assert.equal((await query('SELECT 1 FROM groups WHERE id = $1', [group.id])).rows.length, 0);
});

test('members_listing_is_for_members_and_admins_only_and_has_no_email_field', async () => {
  const { group, owner } = await makeGroup();
  const stranger = await createTestUser();
  const admin = await createTestUser({ isAdmin: true });
  await rejectsWith(listMembers(actor(stranger), group.id), 'not_found');
  for (const viewer of [actor(owner), actor(admin, true)]) {
    const members = await listMembers(viewer, group.id);
    assert.deepEqual(Object.keys(members[0]).sort(), ['avatar_url', 'id', 'nickname']);
    assert.ok(!JSON.stringify(members).includes('@'));
  }
});

test('reassign_needs_admin_and_a_member', async () => {
  const { group, owner } = await makeGroup();
  const member = await createTestUser();
  const outsider = await createTestUser();
  const admin = await createTestUser({ isAdmin: true });
  await joinGroup(member.id, group.inviteCode);
  await rejectsWith(reassignOwner(actor(owner), group.id, member.id), 'forbidden');
  await rejectsWith(reassignOwner(actor(admin, true), group.id, outsider.id), 'not_found');
  await reassignOwner(actor(admin, true), group.id, member.id);
  assert.equal((await query('SELECT owner_id FROM groups WHERE id = $1', [group.id])).rows[0].owner_id, member.id);
});

test('list_my_groups_shows_the_code_only_to_the_owner', async () => {
  const { group, owner } = await makeGroup();
  const member = await createTestUser();
  await joinGroup(member.id, group.inviteCode);
  const mine = (await listMyGroups(owner.id)).find((g) => g.id === group.id)!;
  assert.equal(mine.inviteCode, group.inviteCode);
  assert.equal(mine.isOwner, true);
  assert.equal(mine.memberCount, 2);
  const theirs = (await listMyGroups(member.id)).find((g) => g.id === group.id)!;
  assert.equal(theirs.inviteCode, null);
  assert.equal(theirs.isOwner, false);
});
