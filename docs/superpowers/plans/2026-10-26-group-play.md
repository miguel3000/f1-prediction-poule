# Group Play (private poules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let friend groups run their own poule (own standings, an invite link, predictions visible once a race has started) next to the existing main poule, without changing how anyone predicts or scores.

**Architecture:** Two new tables (`groups`, `group_members`) and two new columns on `users` (`plays_in_main`, `can_start_groups`). A `groupService` holds the rules; thin controllers expose them. Every standings/stats/predictions-list query takes a *poule* (`main` or a group id) and is restricted to that poule's player ids by one helper, `resolvePoule`, so scoping lives in one place. Points keep coming from `predictions.points_earned` and `sprint_predictions.points_earned`.

**Tech Stack:** Node 18 (Docker) / Express / TypeScript / PostgreSQL 15 (backend), React 18 / Vite / Tailwind (frontend), `node:test` for backend tests against a local Postgres, browser checks against a local stack for the frontend.

**Spec:** `docs/superpowers/specs/2026-10-26-group-play-design.md`. Read it and `decisions.md` before starting.

## Global Constraints

- Group names: unique case-insensitively, 3 to 40 characters after trimming; a taken name is refused with a clear message.
- Invite link `/join/<code>`: code is unguessable (≥ 128 bits of randomness), reusable until the starter makes a new one (the old one then stops working), visible only to the starter.
- Only players with `can_start_groups` can start groups (off by default; the owner switches it in the Pitlane). Everyone can join through a link.
- Joining through a link asks "also play in the main poule?"; default yes. `plays_in_main` defaults to TRUE for every existing user and can be changed on the Profile page.
- A player who plays only in a group is absent from every main-poule list (Standings, season replay, player stats, Stats-page top scorers, main predictions list) and does not see the main poule.
- Standings and points: visible within a poule always. Others' predictions: only from the moment predictions lock (`race_date` minus `PREDICTION_LOCK_MINUTES`, default 1), within the poule being viewed, main poule included.
- One prediction per player per race, counting everywhere that player plays. Scoring, deadlines and prediction screens do not change.
- Never expose an email address in any response, screen, log or email body to another player.
- Every visible string exists in English and Dutch (`nl` has every `en` key); brand look (flat, blue/dark blue/yellow); check 320 px; group names are player-written, so escape them wherever they are shown, emails included.
- Migrations are idempotent (`IF NOT EXISTS`) and run on every container start. Test with throwaway accounts on localhost and delete them. Nothing is sent to real players.
- Deploy only when the owner says so: push, then the Pi steps in `decisions.md`. (GitHub pushes may fail on some networks; commit locally and push later.)

## Review Focus

1. **Wrong, old or reset invite codes, and guessing.** Unknown, malformed and reset codes all give the same "invalid" answer; the preview endpoint is rate-limited. (Tasks 2, 3)
2. **Group names.** "Pit Stop", "pit stop " and "PIT STOP" collide; two simultaneous creates cannot both win; names with `<script>` or quotes are shown and emailed as text. (Tasks 1, 2, 4)
3. **Opt-out leaks.** A group-only player must not appear in Standings, season history, player stats, the Stats-page top scorers or the main predictions list; ranks and "diff to leader" are computed inside the poule. (Tasks 5, 6)
4. **Visibility boundary and other people's poules.** Predictions are refused one second before the lock and shown at the lock; asking for a poule you are not in (changing `?poule=` to another group's id) is refused. (Tasks 5, 6)
5. **Deleting and leaving.** An owner who deletes their account leaves an ownerless group that still works and shows in the Pitlane; leaving twice, joining twice and removing the owner's own membership are harmless. (Tasks 2, 11)

---

## File Structure

Backend (create): `src/services/groupService.ts` (rules, no HTTP), `src/services/pouleScope.ts` (`resolvePoule`), `src/controllers/groupController.ts`, `src/routes/groups.ts`, `src/controllers/poulePredictionsController.ts`, `src/testing/testDb.ts`, `src/**/__tests__/*.test.ts`. Modify: `database/schema.sql`, `database/migrate.ts`, `controllers/authController.ts`, `controllers/leaderboardController.ts`, `controllers/statsController.ts`, `controllers/adminController.ts`, `routes/admin.ts`, `routes/races.ts`, `server.ts`, `services/emailService.ts`, `services/emailI18n.ts`, `services/emailLog.ts`.
Frontend (create): `pages/Groups.tsx`, `pages/JoinGroup.tsx`, `components/PouleSelector.tsx`, `components/PoulePredictions.tsx`, `i18n/locales/{en,nl}/groups.ts`. Modify: `services/api.ts`, `App.tsx`, `components/Navigation.tsx`, `pages/Auth.tsx`, `pages/Tutorial.tsx`, `pages/Leaderboard.tsx`, `pages/Profile.tsx`, `pages/Admin.tsx`, `i18n/locales/{en,nl}/index.ts`.

---

### Task 1: Test harness and database layer

**Files:**
- Create: `docker-compose.test.yml`, `backend/src/testing/testDb.ts`, `backend/src/database/__tests__/groupSchema.test.ts`
- Modify: `backend/src/database/schema.sql`, `backend/src/database/migrate.ts`, `backend/package.json`

**Interfaces:**
- Produces: `resetTestDatabase(): Promise<void>` and `closeTestDatabase(): Promise<void>` in `testing/testDb.ts`; `createTestUser(opts?: { nickname?: string; email?: string; canStartGroups?: boolean; playsInMain?: boolean; isAdmin?: boolean }): Promise<{ id: number; nickname: string }>`, `seedSeason(): Promise<{ driverIds: number[]; pastRaceId: number; futureRaceId: number; pastSprintId: number }>` (10 drivers for 2026 with numbers 1 to 10, a main race dated in the past, a main race in the future and a sprint in the past, status `completed` for the past ones) and `addPrediction(userId: number, raceId: number, driverIds: number[], pointsEarned: number, dnfPickDriverId?: number): Promise<void>` (writes `predictions` for a main race, `sprint_predictions` for a sprint) in the same file; npm script `npm test` in `backend/`; tables `groups(id, name, name_key UNIQUE, owner_id NULL, invite_code UNIQUE, created_at)` and `group_members(group_id, user_id, joined_at, PRIMARY KEY (group_id, user_id))`; columns `users.plays_in_main BOOLEAN NOT NULL DEFAULT TRUE`, `users.can_start_groups BOOLEAN NOT NULL DEFAULT FALSE`.

- [ ] **Step 1: Test setup.** `docker-compose.test.yml` runs `postgres:15-alpine` as `f1-postgres-test` on host port 5433 (db `f1_test`, user `f1user`, password `f1password`). `backend/package.json` gets `"test": "tsc && DATABASE_URL=postgresql://f1user:f1password@localhost:5433/f1_test JWT_SECRET=test-secret FRONTEND_URL=http://localhost node --test $(find dist -name '*.test.js')"`. `resetTestDatabase` drops and recreates the `public` schema, then runs `node dist/database/migrate.js` with the same `DATABASE_URL` (spawnSync) so tests see the real schema.
- [ ] **Step 2: Write the failing tests** in `groupSchema.test.ts`: `groups_name_is_unique_ignoring_case` (insert "Pit Stop" and name_key `pit stop`, then "pit stop " trimmed key `pit stop` → unique violation `23505`); `deleting_a_user_removes_memberships_but_keeps_the_group_ownerless` (owner deleted → `groups.owner_id IS NULL`, member rows for that user gone); `deleting_a_group_removes_its_memberships`; `new_columns_have_the_spec_defaults` (`plays_in_main` true, `can_start_groups` false for a fresh user); `migration_is_idempotent` (run `migrate.js` twice, exit 0 both times).
- [ ] **Step 3: Run** `docker compose -f docker-compose.test.yml up -d` then `cd backend && npm test`. Expected: FAIL (tables and columns missing).
- [ ] **Step 4: Implement** the tables and columns in `schema.sql` and an ensure-block in `migrate.ts` (before the "Drop magic_links" block, log lines in the existing style). `owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL`; `group_members` FKs `ON DELETE CASCADE`; index on `group_members(user_id)`.
- [ ] **Step 5: Run** `npm test`. Expected: PASS (5 tests).
- [ ] **Step 6: Commit** `git add docker-compose.test.yml backend && git commit -m "Group play: test harness and tables"`.

### Task 2: Group service (the rules)

**Files:**
- Create: `backend/src/services/groupService.ts`, `backend/src/services/__tests__/groupService.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, `createTestUser`.
- Produces (all in `groupService.ts`):
  - `class GroupError extends Error { code: 'name_invalid' | 'name_taken' | 'not_allowed' | 'invalid_code' | 'not_found' | 'forbidden' }`
  - `type Actor = { id: number; isAdmin: boolean }`
  - `createGroup(actor: Actor, name: string): Promise<{ id: number; name: string; inviteCode: string }>`
  - `previewByCode(code: string): Promise<{ name: string } | null>`
  - `joinGroup(userId: number, code: string, playsInMain?: boolean): Promise<{ groupId: number; name: string; alreadyMember: boolean }>`
  - `leaveGroup(userId: number, groupId: number): Promise<void>`
  - `renameGroup(actor: Actor, groupId: number, name: string): Promise<void>`
  - `resetInviteCode(actor: Actor, groupId: number): Promise<string>`
  - `deleteGroup(actor: Actor, groupId: number): Promise<void>`
  - `removeMember(actor: Actor, groupId: number, userId: number): Promise<void>`
  - `reassignOwner(actor: Actor, groupId: number, newOwnerId: number): Promise<void>` (admin only; new owner must be a member)
  - `listMyGroups(userId: number): Promise<Array<{ id: number; name: string; isOwner: boolean; memberCount: number; inviteCode: string | null }>>` (`inviteCode` only when the caller is the owner)
  - `listMembers(actor: Actor, groupId: number): Promise<Array<{ id: number; nickname: string; avatar_url: string | null }>>` (members and admins only; never email)
  - `listAllGroupsForAdmin(): Promise<Array<{ id: number; name: string; ownerId: number | null; ownerNickname: string | null; members: Array<{ id: number; nickname: string }> }>>`
  - `normalizeGroupName(name: string): { name: string; key: string }` (trim, collapse inner whitespace, `key` = lower-cased; throws `name_invalid` outside 3–40 characters)

- [ ] **Step 1: Write the failing tests** (`node:test`, real DB, `resetTestDatabase` in `before`): `create_requires_can_start_groups` (not_allowed); `create_makes_the_owner_a_member_and_returns_a_long_code` (code length ≥ 32 chars, different on every group); `names_collide_ignoring_case_and_spaces` ("Pit Stop" then " pit  stop " → `name_taken`); `simultaneous_creates_with_the_same_name_yield_one_group` (`Promise.all` of two → exactly one fulfilled, one `name_taken`); `name_length_is_3_to_40` (2 and 41 chars → `name_invalid`, 3 and 40 fine); `names_are_stored_as_text` (`<b>x</b>"'` stored and returned unchanged); `preview_returns_only_the_name_and_null_for_unknown_malformed_or_reset_codes`; `join_is_idempotent_and_sets_plays_in_main_only_when_given`; `join_with_a_reset_code_fails_with_invalid_code`; `leave_twice_is_harmless`; `owner_cannot_leave_and_must_delete_or_be_reassigned` (`forbidden`; plan call: the owner stays until the group is deleted or an admin reassigns it); `ownerless_group_still_accepts_joins_and_lists_members` (after the owner's account is deleted); `only_owner_or_admin_can_rename_reset_delete_remove`; `members_listing_is_for_members_and_admins_only_and_has_no_email_field`; `reassign_needs_admin_and_a_member`; `list_my_groups_shows_the_code_only_to_the_owner`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the interface above. Codes: `crypto.randomBytes(24).toString('base64url')`. Uniqueness: rely on the `name_key` unique index and map error `23505` to `name_taken` (no check-then-insert). All access checks happen in the service so controllers stay thin.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Group play: group service"`.

### Task 3: Group HTTP API, admin switch, profile fields

**Files:**
- Create: `backend/src/controllers/groupController.ts`, `backend/src/routes/groups.ts`, `backend/src/routes/__tests__/groups.test.ts`
- Modify: `backend/src/server.ts` (mount `/api/groups`), `backend/src/controllers/authController.ts` (`getProfile` adds `can_start_groups`, `plays_in_main`; new `setPlaysInMain`), `backend/src/routes/auth.ts`, `backend/src/controllers/adminController.ts` (`setGroupStarter`, `getAllUsers` selects `can_start_groups`), `backend/src/routes/admin.ts`

**Interfaces:**
- Consumes: Task 2 service, `authenticate` and `authenticateAdmin` middleware.
- Produces (HTTP, JSON): `POST /api/groups {name}` → 201 `{id, name, inviteCode}`; `GET /api/groups/mine` → `{ playsInMain: boolean, groups: [...listMyGroups] }`; `GET /api/groups/join/:code` (no login, rate-limited 20 per minute per IP) → `{name}` or 404 `{error: 'Invite link is not valid'}`; `POST /api/groups/join {code, playsInMain?}` → `{groupId, name, alreadyMember}`; `PATCH /api/groups/:id {name}`; `POST /api/groups/:id/new-link` → `{inviteCode}`; `DELETE /api/groups/:id`; `GET /api/groups/:id/members`; `DELETE /api/groups/:id/members/:userId`; `POST /api/groups/:id/leave`; `PUT /api/auth/plays-in-main {value: boolean}`; `PUT /api/admin/users/:id/group-starter {enabled: boolean}`; `GET /api/admin/groups`; `DELETE /api/admin/groups/:id`; `DELETE /api/admin/groups/:id/members/:userId`; `PUT /api/admin/groups/:id/owner {userId}`. `GroupError` codes map to 400 (`name_invalid`), 409 (`name_taken`, message "That group name is already taken"), 403 (`not_allowed`, `forbidden`), 404 (`invalid_code`, `not_found`).

- [ ] **Step 1: Write the failing tests** (an Express app built in the test from `routes/groups.ts` plus a JWT signed with `JWT_SECRET`; `fetch` against `app.listen(0)`): `create_is_403_without_the_switch_and_201_with_it`; `taken_name_is_409_with_a_readable_message`; `preview_has_no_auth_and_reveals_only_the_name`; `unknown_and_reset_codes_return_the_same_404_body` (byte-identical bodies); `preview_is_rate_limited_after_20_requests_in_a_minute` (21st → 429); `join_then_mine_lists_the_group_without_the_code_for_a_member`; `members_endpoint_is_403_for_non_members`; `profile_reports_the_new_fields_and_plays_in_main_can_be_toggled`; `admin_switch_requires_a_boolean_and_an_admin`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** controllers as thin wrappers (`groupController.ts` exports one handler per route; a shared `sendGroupError(res, error)`); rate limiter with `express-rate-limit` like the ones in `server.ts`; the admin handlers follow `setPitwallAccess`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Group play: API, admin switch, profile fields"`.

### Task 4: Registering through a link and the welcome email line

**Files:**
- Modify: `backend/src/controllers/authController.ts` (`registerWithPassword`, `sendSignupEmails`), `backend/src/services/emailService.ts` (`sendWelcomeEmail`), `backend/src/services/emailI18n.ts`, `backend/src/services/emailLog.ts` (`WelcomePayload`), test: `backend/src/controllers/__tests__/registerWithLink.test.ts`

**Interfaces:**
- Consumes: Task 2 `joinGroup`, `previewByCode`.
- Produces: `registerWithPassword` accepts optional `joinCode: string` and `playsInMain: boolean`; response adds `joinedGroup?: { id: number; name: string }`; `sendWelcomeEmail(email, nickname, language, opts: { late?: boolean; groupName?: string })`; `WelcomePayload` gains `groupName?: string`; email keys `welcome.group` (EN `You joined the group {group}.`, NL `Je bent lid geworden van de groep {group}.`).

- [ ] **Step 1: Write the failing tests** with a fake mail transport (stub `nodemailer.createTransport` before importing `emailService`, capture `sendMail` arguments): `register_with_a_valid_code_creates_user_membership_and_returns_joinedGroup`; `register_with_an_invalid_code_is_400_and_creates_no_user`; `plays_in_main_false_is_stored`; `welcome_mail_names_the_group_and_escapes_it` (group named `<b>x</b>` appears as `&lt;b&gt;x&lt;/b&gt;` in the HTML); `welcome_mail_without_a_group_is_unchanged`; `failed_welcome_retry_still_names_the_group` (the `email_log` payload contains `groupName`).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Verify the code first with `previewByCode`, then create the user and call `joinGroup`; if joining fails after the user exists, delete that user and answer 500, so nobody is left half-registered. The group line goes between the greeting and the intro; `groupName` is passed through `sendLogged('welcome', ...)` payload.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Group play: register through an invite link"`.

### Task 5: Poule scoping for standings, season history, player stats, top scorers

**Files:**
- Create: `backend/src/services/pouleScope.ts`, `backend/src/services/__tests__/pouleScope.test.ts`, `backend/src/controllers/__tests__/leaderboardScope.test.ts`
- Modify: `backend/src/controllers/leaderboardController.ts` (`getLeaderboard`, `getTopThree`, `getUserRank`, `getSeasonHistory`, `getPlayerStats`), `backend/src/controllers/statsController.ts` (top scorers, the query reading `users`)

**Interfaces:**
- Produces in `pouleScope.ts`: `type PouleScope = { kind: 'main' | 'group'; groupId: number | null; userIds: number[] }` and `resolvePoule(viewerId: number, poule: string | undefined): Promise<PouleScope>` — `poule` is `'main'` or a group id; missing means main if the viewer plays in main, otherwise their first group; throws `GroupError('forbidden')` if the viewer is not in that poule (also for `main` when `plays_in_main` is false) and `GroupError('not_found')` for a bad id or a viewer with no poule. Main scope = users with `plays_in_main`; group scope = members of the group.
- Every endpoint above accepts `?poule=` and returns 403/404 using the same error mapping.

- [ ] **Step 1: Write the failing tests** with seeded users, one race with predictions and points: `main_scope_excludes_group_only_players`; `group_scope_has_only_members`; `non_member_asking_for_a_group_is_403`; `group_only_player_asking_for_main_is_403`; `ranks_and_diff_to_leader_are_computed_inside_the_poule`; `last_race_rank_is_inside_the_poule`; `season_history_users_are_only_the_poule`; `player_stats_users_are_only_the_poule`; `top_scorers_on_the_stats_page_exclude_group_only_players`; `default_poule_is_main_or_the_first_group_for_a_group_only_player`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Restrict each query with `u.id = ANY($n)` before any window function; the CTEs that rank "last race" and the season-history pivot must also read only the scope's users. Without `?poule=` the result for an all-opted-in database equals today's output (add `main_scope_equals_the_old_output_when_everyone_plays_in_main`).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Group play: poule-scoped standings and stats"`.

### Task 6: Everyone's predictions once the race has started

**Files:**
- Create: `backend/src/controllers/poulePredictionsController.ts`, `backend/src/controllers/__tests__/poulePredictions.test.ts`
- Modify: `backend/src/routes/races.ts`

**Interfaces:**
- Consumes: `resolvePoule` (Task 5).
- Produces: `GET /api/races/:id/predictions?poule=` (login required) → 200 `{ locked: true, race: {id, race_type, race_name}, predictions: Array<{ user: { id: number; nickname: string; avatar_url: string | null }; picks: Array<{ position: number; driver: { id: number; name: string; name_acronym: string | null; team: string } | null }>; dnf_pick: { id: number; name: string } | null; points_earned: number | null }> }`; before the lock → 403 `{ error: 'Predictions are visible once the race has started' }`. Main races read `predictions` (10 positions, DNF pick), sprints read `sprint_predictions` (8 positions, no DNF pick). Only poule members with a prediction are listed.

- [ ] **Step 1: Write the failing tests:** `refused_one_second_before_the_lock` and `shown_at_the_lock` (race dated so the lock is controlled; `PREDICTION_LOCK_MINUTES` = 1); `sprint_returns_8_picks_without_dnf`; `lists_only_poule_members_who_predicted`; `group_only_player_is_absent_from_the_main_list`; `viewer_not_in_the_poule_gets_403`; `response_contains_no_email_anywhere` (JSON-stringify the body and assert no `@`-address and no `email` key).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `getPoulePredictions(req, res)`; lock moment `new Date(race.race_date).getTime() - Number(process.env.PREDICTION_LOCK_MINUTES || 1) * 60_000`, the same rule as `predictionController.submitPrediction`. Route: `router.get('/:id/predictions', authenticate, getPoulePredictions)` next to the other `/:id/...` routes in `routes/races.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Group play: predictions visible once the race has started"`.

### Task 7: Frontend foundations and the Groups page

**Files:**
- Create: `frontend/src/pages/Groups.tsx`, `frontend/src/i18n/locales/en/groups.ts`, `frontend/src/i18n/locales/nl/groups.ts`
- Modify: `frontend/src/services/api.ts`, `frontend/src/i18n/locales/{en,nl}/index.ts`, `frontend/src/App.tsx` (route `/groups`, protected), `frontend/src/components/Navigation.tsx` (menu entry "Groups" for logged-in players)

**Interfaces:**
- Produces in `api.ts`: `getMyGroups()`, `createGroup(name)`, `renameGroup(id, name)`, `newGroupLink(id)`, `deleteGroup(id)`, `getGroupMembers(id)`, `removeGroupMember(id, userId)`, `leaveGroup(id)`, `previewInvite(code)`, `joinGroup(code, playsInMain?)`, `setPlaysInMain(value)`, each returning the axios promise of the endpoint in Task 3; types `MyGroup`, `GroupMember`. The user object gains `can_start_groups?: boolean` and `plays_in_main?: boolean` (check `AuthContext.ts` and the `user` state type in `App.tsx`). Translation keys all start with `groups.`.

- [ ] **Step 1: Implement** the Groups page: list of "my groups" (name, member count, "Owner" chip); for owners a block with the invite link `https://pouleposition.nl/join/<code>` (use `window.location.origin`), a Share button reusing `shareLink` from `utils/share.ts` (text from `groups.shareText`), "New link" (confirm first), rename, member list with remove buttons (owner) and "Leave" (members), delete (owner, confirm). A "Start a group" form (name field, validation messages from the API, including the taken-name message) only when `user.can_start_groups`. Brand look: alternating blue/dark-blue rows, yellow buttons.
- [ ] **Step 2: Verify locally.** Local stack for this and the later frontend tasks: `docker compose -f docker-compose.test.yml up -d`; in `backend/`, `DATABASE_URL=postgresql://f1user:f1password@localhost:5433/f1_test JWT_SECRET=dev FRONTEND_URL=http://localhost:3003 node dist/database/migrate.js` once, seed with `seedSeason` (a small script `npx ts-node src/testing/seedLocal.ts` that calls it), then the same env with `npm run dev`; in `frontend/`, a temporary `vite.local.config.ts` that proxies `/api` to `http://localhost:5000`, started with `--config vite.local.config.ts` (delete it afterwards). With two throwaway accounts (register through the API; make one a starter with `UPDATE users SET can_start_groups = TRUE`): the starter creates "Pit Stop", sees the link and Share, tries "pit stop" and sees the taken-name message, renames it, makes a new link; the other account (not a starter) has no "Start a group" button and sees no link. Check English and Dutch at 320 px and desktop. Delete the throwaway users.
- [ ] **Step 3: Commit** `git commit -m "Group play: Groups page"`.

### Task 8: The join flow and the tutorial referral

**Files:**
- Create: `frontend/src/pages/JoinGroup.tsx`
- Modify: `frontend/src/App.tsx` (public route `/join/:code`), `frontend/src/pages/Auth.tsx` (accept `?join=<code>`, send `joinCode` and `playsInMain` on register, show the notice and the checkbox), `frontend/src/pages/Tutorial.tsx` (banner from router state), `frontend/src/i18n/locales/{en,nl}/groups.ts`

**Interfaces:**
- Consumes: `previewInvite`, `joinGroup`, the register response `joinedGroup` (Task 4).
- Produces: navigation contract: a new player who registered through a link goes to `/tutorial` with router state `{ joinedGroup: { id, name } }`; an existing player who accepts goes to `/leaderboard?poule=<groupId>`.

- [ ] **Step 1: Implement.** `JoinGroup` loads the preview (invalid → a clear "This invite link is not valid" page with a link home). Logged in: shows "Join *name*?", a checkbox "Also play in the main poule" (ticked), and a Join button; already a member → "You are already in *name*" with a link to the standings. Logged out: shows the group name and two buttons to `/auth?join=<code>` (register) and `/auth?join=<code>&mode=login`. After a login with `join`, the page returns to `/join/<code>`. In `Auth` register mode with `join`, show "You are joining *name*" and the checkbox (ticked); send `joinCode` and `playsInMain`. Tutorial banner: "You joined *name*" (escaped by React), dismissible.
- [ ] **Step 2: Verify locally** (same stack and throwaway accounts): new player through the link lands on How to Play with the banner; existing player lands on the group standings; invalid and reset links show the invalid page; unticking the checkbox keeps the player out of the main list (check in Task 9). English, Dutch, 320 px. Delete the throwaway users.
- [ ] **Step 3: Commit** `git commit -m "Group play: join flow and tutorial referral"`.

### Task 9: Standings poule selector, replay and the Profile switch

**Files:**
- Create: `frontend/src/components/PouleSelector.tsx`
- Modify: `frontend/src/pages/Leaderboard.tsx`, `frontend/src/services/api.ts` (`getLeaderboard`, `getSeasonHistory`, `getPlayerStats` accept `poule?: string`), `frontend/src/pages/Profile.tsx`, `frontend/src/i18n/locales/{en,nl}/groups.ts`

**Interfaces:**
- Consumes: `getMyGroups()` (poules: `main` when `playsInMain`, then each group), Task 5 `?poule=`.
- Produces: `<PouleSelector poules value onChange />` (segmented control or select, readable at 320 px); the Standings page keeps the choice in the URL (`?poule=`), defaults like `resolvePoule`, and passes it to all three calls; the season replay and player stats follow it. Profile gets a "Play in the main poule" switch calling `setPlaysInMain`.

- [ ] **Step 1: Implement** as above. A player with only one poule sees no selector.
- [ ] **Step 2: Verify locally** with throwaway accounts and a seeded race with predictions and points: main shows opted-in players only; the group shows its members; switching updates standings, replay and stats; a group-only player sees only their groups; the Profile switch moves a player in and out of main; a bad `?poule=` shows a friendly message. English, Dutch, 320 px.
- [ ] **Step 3: Commit** `git commit -m "Group play: poule selector on Standings, Profile switch"`.

### Task 10: Predictions list on the Standings page

**Files:**
- Create: `frontend/src/components/PoulePredictions.tsx`
- Modify: `frontend/src/pages/Leaderboard.tsx`, `frontend/src/services/api.ts` (`getPoulePredictions(raceId, poule)`), `frontend/src/i18n/locales/{en,nl}/groups.ts`

**Interfaces:**
- Consumes: Task 6 endpoint, the selected poule, the races list (`getRaces`) filtered to races whose lock has passed.
- Produces: a "Predictions" section under the standings: a race picker (default: the latest started race), then one row per player with 10 (or 8) driver acronyms in order, the DNF pick for main races, and the points once known; horizontally scrollable on phones with the name column fixed; a friendly note when nobody predicted.

- [ ] **Step 1: Implement.** Reuse brand patterns (yellow position squares, blue bars). Never show anything for a race that is not locked (the picker only lists started races).
- [ ] **Step 2: Verify locally:** a race whose lock has passed shows the poule's picks; a future race is not offered; group and main lists differ as expected; 320 px and desktop, both languages.
- [ ] **Step 3: Commit** `git commit -m "Group play: everyone's predictions once a race has started"`.

### Task 11: Pitlane

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`, `frontend/src/i18n` (Admin is English only; no keys needed)

**Interfaces:**
- Consumes: `PUT /api/admin/users/:id/group-starter`, `GET/DELETE /api/admin/groups…`, `PUT /api/admin/groups/:id/owner` (Task 3); the `User` interface gains `can_start_groups?: boolean`.

- [ ] **Step 1: Implement.** In the user list next to the Pit Wall switch: "Groups: ON/OFF" toggle. A "Groups" card (same style as "Sign-up Emails"): each group with owner nickname (or "No owner" in yellow with a "Reassign" control listing its members), member nicknames (never emails), remove-member and delete-group buttons with a confirm.
- [ ] **Step 2: Verify locally** with an admin throwaway account (`UPDATE users SET is_admin = TRUE`): switch on and off; an ownerless group (delete the owner's account) shows "No owner" and can be reassigned; remove a member; delete a group. Delete the throwaway users.
- [ ] **Step 3: Commit** `git commit -m "Group play: Pitlane switch and Groups card"`.

### Task 12: Docs, rollout and the first real test group

**Files:**
- Modify: `decisions.md`, `CLAUDE.md` (database tables list)

- [ ] **Step 1: Write** the rules into `decisions.md`: a "Groups" part under section 2 (unique names, link behaviour, opt-out rules, visibility once the race has started) and the privacy rule in section 6; add the table names to `CLAUDE.md`.
- [ ] **Step 2: Deploy only on the owner's word:** `git push`, the Pi steps in `decisions.md`; check the migration line `groups ensured.` in the container log; then in the live Pitlane the owner switches "Groups" on for the first starter; the starter makes a test group; check the join link with a throwaway account, then delete it.
- [ ] **Step 3: Update the Pit Wall item** "Group / team play" (note what is live and what is not covered); commit `git commit -m "Group play: docs"`.

---

## Self-review

**Spec coverage:** groups, unique names, starter switch (Tasks 1–3, 11); link, reset, preview, joining, already-in (2, 3, 8); opt-in/out, default yes, Profile switch, group-only absence (1, 3, 5, 9); new-player tutorial referral and welcome line (4, 8); standings selector, replay, stats (5, 9); predictions once started, main poule included (6, 10); management, leave, admin overview, ownerless groups (2, 3, 7, 11); groups across seasons (nothing season-specific is stored, so no task needed); emails unchanged except one line (4); constraints (global). **Gaps:** none found.
**Type consistency:** `GroupError` codes, `Actor`, `PouleScope`, `resolvePoule`, `joinGroup`, `listMyGroups` and the `?poule=` parameter are used with the same names in every task.
**Proportion:** about 3 times the spec's length, because each task carries its test names and signatures; no function bodies.
