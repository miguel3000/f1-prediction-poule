# Weekend Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On race weekends, read the FIA's decision documents and email the owner when one probably changes predictions (driver change, grid drop, pit-lane start, exclusion), with a Pitlane list of everything seen.

**Architecture:** A cron script (every 10 min, gated to a window before each main race) fetches the FIA documents page, stores every document in `fia_documents`, reads the PDFs whose titles look relevant with `pdftotext`, classifies them with a pure parser, and emails new flags to `ADMIN_EMAIL`. A second detector in the live-feed service compares the feed's driver list with our drivers table at qualifying and race start. The Pitlane gets a card with a "Check now" button.

**Tech Stack:** Node/TypeScript backend, `node:test` against the throwaway Postgres (`scripts/test-db.sh`), `pdftotext` (poppler) called with `execFile`, React Pitlane card.

**Spec:** `docs/superpowers/specs/2026-10-31-weekend-flags-design.md`

## Global Constraints

- Window: from **6 days before a main race until its prediction lock** (`predictionLockTime`, default 1 minute before the start). Documents published before the window start are ignored.
- Cron every **10 minutes**; the script does nothing outside the window.
- Titles decide what is read: driver changes, revised entry lists, infringements, decisions, summons, power-unit reports. Everything else is stored as `skipped`.
- Severity `flag` = driver change, grid drop (with places), pit-lane start, disqualification/exclusion, or a feed driver-list difference. `seen` = everything else that was read. Only `flag` is emailed.
- Fail-safe: a driver-change document is flagged from its title alone; an infringement/decision that cannot be understood is retried and flagged after **three** attempts with the PDF link.
- Email goes to `ADMIN_EMAIL`, **English only**, one email per run; a failed send leaves `flag_emailed_at` empty so the next run retries.
- Three failed runs in a row inside the window send one "watcher is failing" email.
- The feed detector looks at **Qualifying and Race** sessions only, never practice.
- Players see nothing; nothing is changed automatically; no player email address appears anywhere.
- `poppler-utils` is added to the Docker image; no npm PDF library.
- Stored times are UTC; the FIA listing's `dd.mm.yy hh:mm` is Europe/Amsterdam time (the page labels it CET).

## Review Focus

- The FIA page changes shape or returns no expanded event block: the run must be recorded as **failed**, never as "0 new documents".
- A "Recalled - Doc 13 ..." title: stored as `skipped` and never flagged.
- `pdftotext` missing, or a corrupt/huge PDF: the document stays retryable, the run does not crash, the fail-safe flag still happens after three attempts.
- The first run in the middle of a weekend finds many existing documents: all flags go out in one email, and a second run sends nothing.
- Daylight-saving boundary: window and publication times are compared in UTC.

---

### Task 1: Parser for the listing, titles and document text

**Files:**
- Create: `backend/src/services/fiaDocumentsParser.ts`, `backend/src/services/__tests__/fiaDocumentsParser.test.ts`
- Create fixtures: `backend/src/services/__tests__/fixtures/fia/listing.html` (the expanded "Mexico City Grand Prix" event block of the FIA page, saved from `/tmp/flags-recon/fia.html`, trimmed to that block inside minimal wrapper markup) and `driver_change.txt`, `bottas_pu_elements.txt`, `verstappen_incident.txt`, `hadjar_misconduct.txt`, `survival_cell.txt`, `pu_report.txt` (the `pdftotext -layout` output already in `/tmp/flags-recon/pdfs/*.txt`)

**Interfaces:**
- Produces, all in `fiaDocumentsParser.ts`:
  - `type DocKind = 'driver_change' | 'entry_list' | 'infringement' | 'decision' | 'summons' | 'pu_report' | 'other'`
  - `interface ListedDocument { url: string; docNumber: number | null; title: string; publishedAt: Date }`
  - `parseListing(html: string): { event: string; documents: ListedDocument[] } | null` (null when there is no expanded event block). `url` is absolute (`https://www.fia.com` + href). Titles have tags stripped and whitespace collapsed; the "Doc N - " prefix is removed from `title` and kept as `docNumber`.
  - `classifyTitle(title: string): { read: boolean; kind: DocKind }`
  - `interface ParsedFacts { severity: 'flag' | 'seen'; understood: boolean; summary: string; facts: Record<string, unknown> }`
  - `parseDocumentText(kind: DocKind, text: string): ParsedFacts`

- [ ] **Step 1: Write the failing tests** (named, with the real fixtures):
  - `listing_gives_the_event_and_every_document_with_its_utc_time`: event `Mexico City Grand Prix`, 41 documents, document 42 "Infringment - Car 77 - Pit Lane Speeding" published `31.10.26 19:09` = `2026-10-31T18:09:00Z`, urls absolute, `docNumber` 42, no "Doc 42" in the title.
  - `a_page_without_an_expanded_event_block_is_null`.
  - `titles_decide_what_is_read`: read = true for "Decision - Driver Change TGR Haas F1 Team" (`driver_change`), "Revised Entry List" (`entry_list`), "Infringement - Car 77 - PU elements", "Infringment - Car 14 - Pit Lane Speeding" (`infringement`), "Summons - Car 6 - Alleged misconduct" (`summons`), "New PU Elements for this Competition" (`pu_report`); read = false for "Free Practice 2 Classification", "Timetable V2", "Curfew", "Competition Visa", "Infringement - Free Practice 1 Deleted Lap Times", "FP1 and FP2 Scrutineering", "Race Director Notes - SC2 - SC1 Times", "Recalled - Doc 13 - New PU Elements for this Competition".
  - `driver_change_names_both_drivers_and_is_a_flag`: originalNumber 31 / "Esteban Ocon", replacementNumber 50 / "Ryo Hirakawa", `severity: 'flag'`, summary mentions both names.
  - `a_fifty_place_drop_is_a_flag_with_the_places`: Bottas, car 77, `gridDrop: 50`.
  - `a_drop_written_in_words_is_read`: Verstappen, car 3, `gridDrop: 1`, flag.
  - `a_formal_warning_is_seen_not_flagged`: Hadjar, `severity: 'seen'`, `understood: true`.
  - `text_without_a_decision_is_not_understood`: `understood: false` for the survival-cell report under kind `infringement` and for empty text.
  - `pit_lane_start_and_exclusion_wording_is_a_flag` (synthetic one-line decisions: "Start from the pit lane", "Disqualified from the Qualifying", "Excluded from the results").
- [ ] **Step 2: Run** `cd backend && npm test`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the interface above. Number words one to ten are read as digits; the `Decision` field runs until the `Reason` field; the listing is read with plain regular expressions on the structure seen in the fixture (`event-title active`, `document-row`, `title`, `published`).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: parser for the FIA documents"`.

### Task 2: Tables, window and storage

**Files:**
- Modify: `backend/src/database/schema.sql`, `backend/src/database/migrate.ts`
- Create: `backend/src/services/fiaDocumentsService.ts`, `backend/src/services/__tests__/fiaDocumentsStore.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces in `fiaDocumentsService.ts`:
  - tables `fia_documents(id, url UNIQUE, source 'fia'|'feed', event, doc_number, title, published_at, first_seen_at, status 'pending'|'read'|'skipped'|'failed', kind, severity 'flag'|'seen'|NULL, summary, facts JSONB, attempts INT, read_error, flag_emailed_at)` and `fia_checks(id, ran_at, ok, found, added, error, alerted BOOLEAN)`
  - `interface WatchWindow { raceId: number; raceName: string; start: Date; end: Date }`
  - `getWatchWindow(now: Date): Promise<WatchWindow | null>`
  - `storeListed(event: string, docs: ListedDocument[], window: WatchWindow): Promise<number>` (inserts new rows inside the window, returns how many were new; existing urls untouched)
  - `getUnsentFlags(): Promise<FlagRow[]>`, `markFlagsEmailed(ids: number[]): Promise<void>`
  - `recordFeedFlag(key: string, title: string, summary: string, facts: object): Promise<boolean>` (true when new)
  - `recordCheck(r: {ok: boolean; found: number; added: number; error?: string}): Promise<void>`, `shouldAlertWatcherFailure(now: Date): Promise<boolean>`
  - `listDocuments(limit: number)` and `getLastCheck()`

- [ ] **Step 1: Write the failing tests:** `window_runs_from_six_days_before_a_main_race_until_its_lock` (a main race in 5 days is in the window, in 7 days is not, one 30 seconds before its lock is in, one after the lock is not; sprint rows are ignored); `documents_before_the_window_start_are_not_stored`; `storing_the_same_listing_twice_adds_nothing`; `flags_are_sent_once_after_marking`; `a_feed_flag_is_recorded_once_per_key`; `three_failed_checks_in_a_row_alert_once` (a success in between resets; the alert is not repeated; a check outside any window never alerts).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the tables (schema.sql and migrate.ts, same shape; log `fia_documents ensured.`) and the functions above.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: tables, watch window and storage"`.

### Task 3: The check run

**Files:**
- Modify: `backend/src/services/fiaDocumentsService.ts`
- Create: `backend/src/services/__tests__/fiaDocumentsCheck.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: `interface CheckDeps { fetchListing: () => Promise<string>; fetchPdfText: (url: string) => Promise<string>; now?: () => Date }`, `interface CheckResult { ran: boolean; ok: boolean; found: number; added: number; flagged: number; error?: string }`, `runCheck(deps: CheckDeps): Promise<CheckResult>`.

- [ ] **Step 1: Write the failing tests** using the Task 1 fixtures and injected IO, a seeded main race whose window contains the fixture's times: `outside_the_window_nothing_is_fetched` (`ran: false`, the fake fetch is never called); `a_new_weekend_listing_is_read_and_classified` (the Bottas, Verstappen and Haas documents become `flag` rows with their facts, Hadjar becomes `seen`, classifications become `skipped`, `fetchPdfText` is called only for read titles); `a_second_run_adds_nothing_and_reads_nothing_again`; `a_driver_change_is_flagged_from_its_title_when_the_pdf_cannot_be_read` (fetchPdfText throws); `an_unreadable_infringement_is_retried_then_flagged_after_three_attempts` (attempts 1 and 2: not flagged, status `failed`; attempt 3: `flag` with the PDF link); `a_driver_change_says_when_the_stand_in_is_missing_from_our_drivers_table` (facts include `standInInTable: false` and `originalInTable: true` when only car 31 exists); `a_page_without_an_event_block_is_a_failed_run` (`ok: false`, one `fia_checks` row, nothing stored); `a_recalled_document_is_skipped`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `runCheck`: gate on `getWatchWindow`, fetch and `parseListing`, `storeListed`, then read every `pending` or retryable `failed` row whose kind is read-worthy (a row whose attempts reached three is final), classify with `parseDocumentText`, enrich driver changes from the drivers table by car number, record a `fia_checks` row.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: the check run"`.

### Task 4: The email to the owner

**Files:**
- Modify: `backend/src/services/emailService.ts`, `backend/src/services/fiaDocumentsService.ts`
- Create: `backend/src/services/__tests__/fiaFlagEmail.test.ts`

**Interfaces:**
- Consumes: Task 2 `getUnsentFlags`, `markFlagsEmailed`, `shouldAlertWatcherFailure`.
- Produces: `sendFlagsDigest(to: string, flags: FlagForEmail[]): Promise<boolean>`, `sendWatcherFailureNotice(to: string, error: string | null): Promise<boolean>` in `emailService.ts`; `emailPendingFlags(now: Date): Promise<{ sent: number }>` in `fiaDocumentsService.ts`.

- [ ] **Step 1: Write the failing tests** with the stubbed mail transport used by the existing email tests: `one_email_lists_every_new_flag_with_places_link_and_dutch_time` (subject names the event and the number of flags, body has the driver, "50 grid positions", the PDF link, the time as `20:09` Dutch time for a stored UTC `18:09` on 31 Oct 2026 (CET)); `names_and_titles_are_escaped`; `a_driver_change_flag_shows_the_suggested_action` ("Drivers not racing" card; "not in our driver table" for a missing stand-in); `a_failed_send_leaves_the_flags_unsent_and_the_next_run_sends_them`; `nothing_is_sent_when_there_is_nothing_new`; `three_failed_checks_send_one_watcher_notice`; `the_recipient_is_ADMIN_EMAIL_and_no_player_address_appears`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** with the existing `emailDocument`, `emailBanner`, `escapeHtml` and brand constants; wording in English (not in the player dictionary); `emailPendingFlags` also sends the watcher notice when `shouldAlertWatcherFailure` says so.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: email to the owner"`.

### Task 5: Real IO, the cron script and the image

**Files:**
- Create: `backend/src/services/fiaDocumentsIo.ts`, `backend/src/scripts/checkFiaDocuments.ts`, `check-fia-documents.sh`, `backend/src/services/__tests__/fiaDocumentsIo.test.ts`, fixture `backend/src/services/__tests__/fixtures/fia/driver_change.pdf` (the real 123 KB document 36)
- Modify: `crontab`, `Dockerfile`, `CLAUDE.md` (cron list)

**Interfaces:**
- Produces: `fetchFiaListing(): Promise<string>` (GET the documents page, 15 s timeout, browser-style User-Agent), `fetchFiaPdfText(url: string): Promise<string>` (download with a 20 MB cap, `execFile('pdftotext', ['-layout', '-', '-'])`, 15 s timeout, rejects on failure); the script runs `runCheck` then `emailPendingFlags` and exits 0/1.

- [ ] **Step 1: Write the failing tests:** `the_real_pdf_gives_its_text` (skipped with a message when `pdftotext` is not installed): text contains "Ryo Hirakawa"; `a_non_pdf_body_is_rejected`; `a_missing_tool_is_an_error_not_a_hang`; `a_download_over_the_cap_is_rejected` (injected fetcher).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the IO module (download function injectable for the tests) and the script; add `check-fia-documents.sh` (same shape as the other shell wrappers, logs to the cron log), the crontab line `*/10 * * * * /app/check-fia-documents.sh`, `poppler-utils` in the Dockerfile `apk add`, and the COPY line for the wrapper.
- [ ] **Step 4: Run** `npm test` and `sh -n check-fia-documents.sh`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: real IO, cron script and image"`.

### Task 6: The live-feed driver-list detector

**Files:**
- Create: `backend/src/services/driverListCheck.ts`, `backend/src/services/__tests__/driverListCheck.test.ts`
- Modify: `backend/src/services/liveTimingService.ts`

**Interfaces:**
- Consumes: Task 2 `recordFeedFlag`.
- Produces: `diffDriverList(feedDriverList: Record<string, any>, ours: Array<{ driver_number: number; name: string }>): { unknown: Array<{ number: number; name: string }>; absent: Array<{ number: number; name: string }> }`; `checkFeedDriverList(state: Record<string, any>): Promise<void>` (does nothing unless `SessionInfo.Type` is Qualifying or Race and a watch window is active; records one `feed` flag keyed by session and the differing numbers).

- [ ] **Step 1: Write the failing tests:** `a_feed_driver_we_do_not_have_is_unknown` (50 / Ryo HIRAKAWA); `one_of_ours_missing_from_the_feed_is_absent` (31); `identical_lists_give_nothing`; `non_driver_entries_in_the_feed_list_are_ignored`; `practice_sessions_record_nothing`; `qualifying_with_a_difference_records_one_flag_and_asking_again_adds_none`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement**; call `checkFeedDriverList(state)` after the initial snapshot in `liveTimingService.ts`, never awaited and always wrapped in `.catch` (an unhandled rejection would stop the container).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: live-feed driver-list check"`.

### Task 7: Admin API and the Pitlane card

**Files:**
- Create: `backend/src/controllers/flagsController.ts`, `backend/src/controllers/__tests__/flagsAdmin.test.ts`
- Modify: `backend/src/routes/admin.ts`, `frontend/src/pages/Admin.tsx`

**Interfaces:**
- Consumes: Tasks 2 to 5.
- Produces: `GET /api/admin/flags` returning `{ window: {raceName, start, end} | null, lastCheck: {ranAt, ok, error} | null, documents: Array<{id, title, kind, severity, status, summary, publishedAt, url, emailed}> }` (latest 60, flags first, newest first); `POST /api/admin/flags/check` running the real check and emailing, returning `{ ran, ok, added, flagged, emailed, error? }`.

- [ ] **Step 1: Write the failing tests:** a non-admin gets 403; `the_list_shows_flags_first_and_the_last_check`; `check_now_outside_the_window_says_it_did_not_run`; `check_now_uses_the_injected_io_and_emails_the_new_flags` (the controller accepts injected IO for tests).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the controller and routes, and the Pitlane card "Race weekend flags": flags in yellow with the summary and a PDF link, seen rows dimmed, a "Check now" button with the result line, the last-check time (red notice when the last run failed), "No race weekend right now" outside the window. Brand patterns of the other cards; 320 px.
- [ ] **Step 4: Run** `npm test`, `cd frontend && npx tsc --noEmit && npm run build`. Then verify locally in the browser with a throwaway database and injected sample data: card at 320 px and desktop, a flag row, a seen row, the failure notice.
- [ ] **Step 5: Commit** `git commit -m "Weekend flags: Pitlane card and admin API"`.

### Task 8: Docs

**Files:**
- Modify: `decisions.md`, `CLAUDE.md`

- [ ] **Step 1: Write** the rules into `decisions.md` (a "Weekend flags" part under section 3 with window, severities, fail-safe, no player-facing output, the log row) and the tables and cron line into `CLAUDE.md`.
- [ ] **Step 2: Run** the whole suite and the frontend build. Expected: all green.
- [ ] **Step 3: Commit** `git commit -m "Weekend flags: docs"`.

---

## Self-review

**Spec coverage:** window, memory, titles, severity, fail-safe, driver-change hint, email, Pitlane card, self-watch, feed detector, non-goals (Tasks 1 to 8). Cadence and image change (Task 5). **Gaps:** none found.
**Type consistency:** `DocKind`, `ListedDocument`, `ParsedFacts`, `CheckDeps`, `CheckResult`, `FlagRow`, `WatchWindow` are used with the same names in every task.
**Proportion:** the plan states test names and signatures; bodies are left to the implementer.
