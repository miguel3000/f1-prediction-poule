import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../config/database';
import { resetTestDatabase, closeTestDatabase, createTestUser, runMigration } from '../../testing/testDb';

before(async () => {
  await resetTestDatabase();
});
after(async () => {
  await closeTestDatabase();
});

const insertGroup = (name: string, nameKey: string, code: string, ownerId: number | null) =>
  query(
    'INSERT INTO groups (name, name_key, owner_id, invite_code) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, nameKey, ownerId, code]
  );

test('groups_name_is_unique_ignoring_case', async () => {
  const owner = await createTestUser();
  await insertGroup('Pit Stop', 'pit stop', 'code-unique-1', owner.id);
  await assert.rejects(insertGroup('pit stop ', 'pit stop', 'code-unique-2', owner.id), (error: any) => error.code === '23505');
});

test('deleting_a_user_removes_memberships_but_keeps_the_group_ownerless', async () => {
  const owner = await createTestUser();
  const member = await createTestUser();
  const group = (await insertGroup('Ownerless', 'ownerless', 'code-ownerless', owner.id)).rows[0].id;
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2), ($1, $3)', [group, owner.id, member.id]);

  await query('DELETE FROM users WHERE id = $1', [owner.id]);

  const groups = await query('SELECT owner_id FROM groups WHERE id = $1', [group]);
  assert.equal(groups.rows.length, 1);
  assert.equal(groups.rows[0].owner_id, null);
  const members = await query('SELECT user_id FROM group_members WHERE group_id = $1', [group]);
  assert.deepEqual(members.rows.map((r: any) => r.user_id), [member.id]);
});

test('deleting_a_group_removes_its_memberships', async () => {
  const owner = await createTestUser();
  const group = (await insertGroup('Short Lived', 'short lived', 'code-short', owner.id)).rows[0].id;
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group, owner.id]);

  await query('DELETE FROM groups WHERE id = $1', [group]);

  const members = await query('SELECT 1 FROM group_members WHERE group_id = $1', [group]);
  assert.equal(members.rows.length, 0);
});

test('new_columns_have_the_spec_defaults', async () => {
  const user = await createTestUser();
  const row = (await query('SELECT plays_in_main, can_start_groups FROM users WHERE id = $1', [user.id])).rows[0];
  assert.equal(row.plays_in_main, true);
  assert.equal(row.can_start_groups, false);
});

test('migration_is_idempotent', () => {
  assert.doesNotThrow(() => runMigration());
  assert.doesNotThrow(() => runMigration());
});
