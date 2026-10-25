# decisions.md — rules and templates for working on Poule Position

Read this before changing anything. It is the single place for the choices already made
(so they are not re-litigated) and the templates to start from (so new work looks like the
old work). Where it disagrees with `CLAUDE.md` or `PROJECT_SUMMARY.md`, **this file wins**:
those describe the structure, this describes what was decided.

Keep it alive: when the user makes a new decision or corrects a mistake, add it here in the
same change and say so in the reply. Never delete a rule because it is inconvenient; if one
is wrong, change it and note why in the log at the bottom.

---

## 1. How we work

### The people and the backlog
- The user directs one feature at a time. Do what was asked; do not start the next Pit Wall
  item on your own. "Add X to the Pit Wall" means add it, nothing more.
- **The Pit Wall** is the backlog: the claude.ai Artifact `https://claude.ai/artifact/57BKKkVpcHrk6ZM4XAMDD1`,
  database collection `items`, fields `id`, `title`, `note`, `section`, `order`, `done`.
  - `section` must be one of `legal`, `locale`, `product`, `content`, `growth`, `comms`,
    `scoring`, `brand`. The page only draws those eight; an item in any other section is
    invisible.
  - `order` continues after the highest one already in that section.
  - When something ships, set `done: true` and rewrite `note` to say what is live, from when,
    and what is not covered. Notes describe the result, not the plan.
- There is also a player-facing Pit Wall inside the app (`/pitwall`); it is separate and only
  for players the admin gave access.

### Before you start
1. `git fetch && git log HEAD..origin/main --oneline` (or `git pull`) in the Mac clone. The Pi
   has its own checkout and has been ahead of the Mac clone before.
2. Read the files you are about to change. Match the surrounding code: comment density,
   naming, idiom.
3. If the work builds on calendar, schedule or results data, see section 3 first.

### Never do without an explicit yes in the chat
- Send anything to players (welcome, apology, newsletter, test mails to a real player address).
  Mail to the admin address (`kimi@pouleposition.nl`) about the site itself is fine.
- Delete players, predictions, results or points. Re-running a sync that replaces results counts.
- Change the sender, the DNS, the Cloudflare tunnel or anything outside this repo and the Pi
  checkout. If the change is theirs to make (DNS, Cloudflare, Search Console), give the steps.
- Put a real player's email address in a screen, a log line, a newsletter or a chat reply that
  does not need it (see section 6).

### Verify, and say what you verified
The user is tired of being the tester. For every change:
1. Typecheck and build: `npm run build` in `frontend/` and `backend/` (whichever changed).
2. Deploy (below), then check the live site: container healthy, the page or endpoint answers.
3. Look at it. Use the built-in browser at phone width (375, and 320 for headers and tables) and
   desktop; check both languages. Look for contradictions on screen, not only whether the new
   part renders.
4. Anything that needs a login: use a **throwaway account**, created with
   `POST /api/auth/register-password` and removed with `DELETE /api/auth/account` afterwards.
   Never use a real player's account or address. Do not leave test rows behind.
5. Data features: audit the stored data against the official source (section 3).
6. In the reply, state plainly what was verified and what was not (for example "Dutch text not
   read by a native speaker", "admin screen not opened, no admin login"). No hedging on what is
   verified, no claims about what is not.

### Deploy
```bash
# Mac clone
cd /Users/pumpkin/Claude/f1-prediction-poule
git add <files> && git commit -m "..." && git push origin main

# Pi (KetchupPI) — key auth, no password
ssh -p 314 pedropatata@192.168.1.118 \
  'cd /home/pedropatata/f1-prediction-poule && git pull origin main && docker compose build && docker compose up -d'

# Verify
ssh -p 314 pedropatata@192.168.1.118 "docker ps --filter name=f1-app --format '{{.Status}}'"   # expect (healthy)
curl -s -A "Mozilla/5.0 Chrome/120" -o /dev/null -w '%{http_code}\n' https://pouleposition.nl/
```
- Migrations run on every container start (`docker-entrypoint.sh`), so they must be idempotent.
- Env changes live in `backend/.env` on the Pi (not in git). Back it up first
  (`cp backend/.env backend/.env.bak-<what>`), then `docker compose up -d --force-recreate app`.
  Never print secrets.
- A redeploy recreates the container: **container logs and the cron log are lost**. Anything that
  must survive (email outcomes, check results) goes in the database.
- Commits end with the attribution line the session gives. Do not commit
  `poule-position-brand/` or stray design files.

### Tooling habits (each of these has bitten before)
- macOS: `sed -i ''` needs an empty suffix; unquoted globs fail in zsh. Prefer a short Python
  script for multi-line edits.
- `curl` against the live site needs a browser User-Agent or Cloudflare may refuse it.
- Built-in browser pane tab ids change after a restart; list tabs first. Setting a checkbox by
  tool does not update React state; click it.
- `transition-all` on buttons freezes mid-animation in a hidden pane, so measurements look
  wrong. Finish animations (`document.getAnimations().forEach(a => a.finish())`) before measuring.

---

## 2. The game

- **Main race**: predict the top 10. **Sprint**: predict the top 8. Drag-and-drop or tap.
- **Points are from the position you predicted**: main 25, 18, 15, 12, 10, 8, 6, 4, 2, 1; sprint
  8, 7, 6, 5, 4, 3, 2, 1.
  - Exact position: full points.
  - One place off (±1): `Math.round(base * 0.5)`.
  - Anything else: 0.
- **First retirement**: main races only, **mandatory** (the server rejects a main prediction
  without it), +25 if right. First out is the DNF classified last. DNS and disqualified do not
  count as retirements (`utils/resultStatus.ts` is the one place that decides this).
- Predictions lock `PREDICTION_LOCK_MINUTES` before the start (default 1). A missed-prediction
  reminder goes out about 1 hour before; if a player still has nothing, their last prediction is
  copied in and they are told exactly what was copied. The copy also takes their last first-retirement pick.
- Results are **provisional** first (points calculated and emailed after the race), **final**
  24 hours later (penalties). The final run never changes stored results on unconfirmed data.
- The prediction list is in **qualifying order**, labelled Sprint Quali or Qualifying; no
  position numbers or three-letter codes (tried, removed). Any driver missing from the data is
  appended so every driver is always pickable. About an hour before each start the **real
  starting grid, penalties applied**, is known and the list switches to it, labelled "Starting
  grid" (an open page switches by itself). Sources, in this order: F1's own live timing feed (the
  GridPos per car, which the app is already connected to and which fills `starting_grid` about an
  hour before the start; first real test: US GP, 25 Oct 2026), then the 5-minute cron
  `syncStartingGrid`, which asks OpenF1's position feed. OpenF1's free tier only serves a session
  once it is over, so that route mostly helps after the fact; its own `starting_grid` endpoint has
  no 2026 data and Jolpi only has the grid after the race. After the race the OpenF1 position feed
  matched Jolpi's real grid for every race checked. If neither source has a grid 20 minutes before
  a start, the admin gets one email and the list keeps the qualifying order. Penalties announced
  earlier are not known to us before that moment. Scoring is unaffected: you predict finishing positions.
- **Gaston Mazzacane -ai-** is the AI player. When the user types **PREDICTION**, give his pick for
  the next race straight away, no questions: figure out which race, research real form and any
  qualifying already driven, give the ordered list (top 10 plus a first-retirement pick for a
  main race, top 8 for a sprint) and cite what you found. The user enters it themselves and says
  "Done, form filled". If it is unclear whether they want the sprint or the main race, ask that one thing.
- Season points reset on 1 January (cron). Season predictions are a future pre-season event.

---

## 3. Data and results

- **Derive, never hard-code.** The calendar, which weekends have a sprint, session times: all
  from the official schedule (Jolpi), never from a list of round numbers. A hard-coded sprint
  list once put five fake sprint weekends on the Races page (10 Oct).
- After building on schedule or results data, audit every round against the source and report
  what was checked.
- **Sources**: Jolpi/Ergast (schedule, results; no sprint-qualifying or practice endpoint; can
  lag), OpenF1 (sessions, results; positions can be text like "RT"; `dnf` flag is set for
  drivers with no final-segment time, so do not filter on it), the F1 live-timing feed.
- **Results cross-check** (`services/resultCheckService.ts`): apply when 2+ sources agree on the
  scored positions and the first retirement; hold and email the admin when they disagree; a
  single source waits (race 2.5 h, sprint 1.5 h) and then applies with a warning; the final run
  keeps what is stored. A manual force from the Pitlane uses priority Jolpi, OpenF1, live feed.
- **Never wipe before validating.** Results are replaced in one transaction
  (`utils/replaceResults.ts`); a failed sync leaves the old rows alone. Sort null-safe.
- **Sprint results live in `sprint_results`, main results in `race_results`.** Any query asking
  "does this race have results?" must look at the right table (a job that
  looked in the wrong table re-synced every past sprint every Monday and emailed an alert, 12 Oct).
- Scheduled jobs stay quiet about old races (alerts only for races from the last 3 days).
- Cron jobs: see the template in section 8. Qualifying: every 10 minutes Fri–Sun, Jolpi then
  OpenF1, one admin email if still missing 3 hours after the session.

---

## 4. Email

- **Sender**: `Kimi | Poule Position <kimi@pouleposition.nl>` (`EMAIL_FROM`). Everything is sent
  from and received at that address. `ADMIN_EMAIL` is `kimi@pouleposition.nl` too; the old Gmail
  address is retired.
- **To**: use `recipient(nickname, email)` so the player's mail app shows the nickname.
- **Signature** on every email to a player: two empty lines, `Kimi.` (with the full stop), one
  empty line, the small logo and `www.pouleposition.nl`. `emailDocument` adds it. Admin-only mails
  pass `{ signature: false }`.
- **Language**: every player email exists in English and Dutch, chosen by `users.language`
  (English if never chosen). Wording lives in `services/emailI18n.ts`; both dictionaries need
  every key. Dutch is informal ("je"), plain and a little humorous where it fits (the late-welcome
  apology is a pit-stop joke).
- **Subjects**: results emails start with `SPOILER ALERT - ` so nobody sees the result in a
  notification. Strip CR/LF from anything player-written that goes into a subject.
- **Escape** everything player-written (`escapeHtml`); nicknames in headers go through
  `recipient()`.
- **Look**: yellow banner via `emailBanner`, alternating `BRAND_BLUE` / `BRAND_NAVY` rows, light
  colour scheme declared (Gmail Android force-dark). Announcement mails carry an unsubscribe link;
  transactional mails (reset, welcome, confirmations, results) do not.
- **Spoilers in result emails** (provisional, final, personal): the results, points and totals are
  hidden by default in every email app. Do not use blur: it only works in Apple Mail, Samsung
  Email and Thunderbird, and would show everything in Gmail, Outlook and Yahoo (Can I email data).
  Wrap spoiler content in `spoilerSection()` and pass `{ spoiler: true }` to `emailDocument()`:
  the real content is hidden with an inline `display: none` (survives apps that strip `<style>`),
  readers see a grey-bar placeholder instead, apps that support `:checked` get a tap-to-reveal
  button, and everyone gets a button to the site. The real content goes last in the HTML after a
  hidden preheader, because inbox previews can read `display: none` text. Check a new result mail
  with the three-case test: full, no reveal rules (Gmail-like), no `<style>` at all; none may show
  a result by default.
- **Caps**: at most 10 sign-ups an hour trigger mail (the form needs no verification, so it could
  otherwise mail strangers in bulk).
- **Sign-up and departure mails are logged** in `email_log` (`services/emailLog.ts`): welcome mail
  to the player, new-member and member-left notices to the admin. Failures are retried
  automatically (5 attempts) and visible in the Pitlane. New mails of this kind use `sendLogged`.
- Tokens: unsubscribe and reset tokens carry a `purpose` and are rejected as login sessions.
  Reset tokens last 1 hour and die when the password changes.

---

## 5. Site, brand and language

- **Palette** (flat, nothing else for decoration): yellow `#FFD81A`, blue `#2596C7`, dark blue
  `#005277`, page `#121012`, cards `#191517` / `#1F1A1D`, white text. Functional exceptions only:
  tyre compounds, sector colours on live timing, error red on validation. The earlier pink/teal
  design is gone.
- **Shape**: sharp corners, no gradients, no glow, no shadows for decoration, no emoji as
  markers on the site (emails may use them sparingly).
- **Type**: Bebas Neue (`font-brand`) for banners and page titles, Big Shoulders Display
  (`font-f1`) for headings and names, Saira (`font-sans`) for body text, Michroma
  (`font-f1-badge`) for numbers and badges.
- **Patterns to reuse**: yellow number square + blue name bar; alternating blue/dark-blue rows;
  yellow table header (black text); the skewed signature bars; `card-f1`, `btn-f1-primary`,
  `btn-f1-secondary`, `input-f1`. Status chips: yellow = needs attention or pending, white on
  dark blue = done, dimmed = skipped or declined.
- **Two languages, always.** Every visible string goes through `t('…')`; `nl` must contain every
  `en` key (the type checker enforces it). Not translated: the Pitlane, news articles, race
  control messages, driver and race names. Dutch is informal ("je/jij"). Have a native speaker
  read longer Dutch texts; say when that has not happened.
- **Mobile first.** Check 375 px and 320 px. The header is tight (logo, language switch, share,
  login, menu); adding anything there means re-measuring it in Dutch, logged out.
- **Menu**: How to Play and FAQ are in the main menu for everyone; Rules, About, Privacy in the
  footer list; the Pitlane for admins only. The menu button is blue with yellow stripes at the far
  left of the header (word MENU on desktop only) and the menu opens from the left.
- **Header layout**: menu button, logo, then language / share / login or avatar. On desktop the
  logo is exactly in the middle and the page links are on a second row; on phones the logo is
  centred in the space between the menu button and the right-hand buttons (they are too wide for
  an exact middle at 360 px). Check 320 px in Dutch, logged out, after any change.
- **Share**: the header share button shares the current page if it is public (`/`, `/about`,
  `/tutorial`, `/rules`, `/privacy`), otherwise the home page, always with `?lang=`. It uses the
  path only, never the query string. A new public page is added to `SHAREABLE` in `utils/share.ts`.
- **Public pages** are indexed (sitemap, server-rendered head); everything behind a login is
  `noindex`. `pouleposition.nl` is the one canonical address; `f1.miguelm.nl` only redirects (301)
  until the user removes it.
- **Copy**: write from the player's side ("Your prediction is saved"), say what happens, no
  jargon, no apologies in error messages.

---

## 6. Privacy

- Players' email addresses are never public: not on a public page, not in a newsletter, not in a
  shared link, not in a chat reply unless the user needs it.
- A new player can be mentioned by **nickname**. Their address stays out.
- The Pitlane is admin-only but still shows addresses only where it needs them (the user list).
  The Sign-up Emails log and card keep **no** addresses: the welcome mail looks the address up
  from the account when it is sent, the admin notices carry it only until delivered, and mail
  server errors have addresses masked (`services/emailLog.ts`). New logs, alerts and admin cards
  follow the same rule: nickname yes, address no.
- No account enumeration in login, reset or sign-up responses.
- The privacy page already promises deletion of an account and its data; account deletion must
  keep doing that.

---

## 7. Replies to the user

Short, concrete, in the user's language. In this order when it applies:
1. What is now true (live, where).
2. How it works, in a few lines, in player terms.
3. What was verified, and how.
4. What was **not** verified or is a guess.
5. The next decision, if one is theirs (one question, not a menu).

If something went wrong: say what, why, and what changed so it does not repeat. If the user was
caught by my mistake, say so plainly and fix the cause, not only the symptom.

---

## 8. Templates

### 8.1 A new email to players
1. Add keys to **both** `en` and `nl` in `backend/src/services/emailI18n.ts` (`thing.subject`,
   `thing.banner`, `thing.intro`, …).
2. Add the sender in `backend/src/services/emailService.ts`:
```ts
export const sendThing = async (email: string, nickname: string, language?: string | null): Promise<void> => {
  const lang = normalizeLang(language);
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: recipient(nickname, email),
    subject: et(lang, 'thing.subject', { name: nickname.replace(/[\r\n]+/g, ' ').trim() }).slice(0, 200),
    html: emailDocument(
      `
      ${emailHeader}
      ${emailBanner(et(lang, 'thing.banner'), { bg: BRAND_YELLOW })}
      <p>${et(lang, 'common.hello', { name: escapeHtml(nickname) })}</p>
      <p style="line-height: 1.5;">${et(lang, 'thing.intro')}</p>
    `,
      lang
    ),
  };
  await transporter.sendMail(mailOptions); // throws; the caller records and retries
};
```
3. If it follows sign-up or leaving, send it through `sendLogged` (add a kind to `email_log`).
4. Results mails: subject starts `SPOILER ALERT - ` and the results go in `spoilerSection()` (section 4). Admin-only mails: `{ signature: false }`, to `ADMIN_EMAIL`.
5. Test by sending to a throwaway address the user owns, in both languages, and look at it in a
   mail client. Never send a test to a real player.

### 8.2 A new public page
1. `frontend/src/pages/Thing.tsx`, route in `App.tsx`.
2. Strings in `frontend/src/i18n/locales/{en,nl}/thing.ts`, registered in both `index.ts` files;
   `meta.thing.title` and `meta.thing.desc` in both `meta.ts`.
3. Server head: add the path to `PUBLIC_PAGES` in `backend/src/utils/seoMeta.ts`; client head:
   `PUBLIC_PAGES` in `frontend/src/components/PageMeta.tsx`; `frontend/public/sitemap.xml`.
4. Menu or footer entry in `components/Navigation.tsx` (and `Footer.tsx`).
5. Add the path to `SHAREABLE` in `frontend/src/utils/share.ts`.
6. Check at 375 and 320 px, both languages, and that a logged-out visit works.
A page behind a login: wrap in `<ProtectedRoute>`, no sitemap or seoMeta entry.

### 8.3 A new database table
Both places, idempotent:
```sql
-- backend/src/database/schema.sql
CREATE TABLE IF NOT EXISTS thing (
  id SERIAL PRIMARY KEY,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
```ts
// backend/src/database/migrate.ts — inside runMigration, before "Drop magic_links"
console.log('Checking for thing table...');
await query(`CREATE TABLE IF NOT EXISTS thing (...)`);
console.log('thing ensured.');
```
Deploying runs it. Confirm in the container log: `thing ensured.`

### 8.4 A new scheduled job
1. `backend/src/scripts/thing.ts` (compiled to `dist/scripts/thing.js`); log with a `[CRON]` prefix;
   `process.exit(0)` when done, `process.exit(1)` on error; never throw out of the loop over items.
2. `thing.sh` in the repo root:
```sh
#!/bin/sh
cd /app
echo "[$(date)] Starting thing..."
node dist/scripts/thing.js >> /var/log/cron.log 2>&1
echo "[$(date)] thing completed"
```
3. `COPY thing.sh /app/thing.sh` in the `Dockerfile` (next to the others) and a line in `crontab`
   with a comment saying when and why. Times are UTC (Dutch summer time is UTC+2).
4. The cron log is wiped on Tuesday and on every redeploy. Alerts and state go to the database.
5. Run the script once by hand on the Pi (`docker exec f1-app node dist/scripts/thing.js`) and
   check it does nothing it should not.

### 8.5 An admin endpoint and Pitlane card
- Controller function in `controllers/adminController.ts` with explicit columns and a `try/catch`
  returning `{ error }`; route in `routes/admin.ts` behind `authenticateAdmin`.
- Card in `frontend/src/pages/Admin.tsx`: `card-f1`, title, one-line explanation, Refresh button,
  alternating blue/dark-blue rows, status chips as in section 5. Blur or leave out personal data.

### 8.6 A Pit Wall entry
```json
{ "id": "kebab-case-id", "section": "product", "order": 18, "done": false,
  "title": "Short, in player or owner terms",
  "note": "What it is and why, in two or three sentences. No plan, no code." }
```
When shipped: `done: true` and a note in past tense with the date, what is live and what is not covered.

### 8.7 A commit
```
<What changed, in one line a player or the owner would understand>

<Why, and anything non-obvious: what was wrong, what is now guaranteed.>

Co-Authored-By: <the attribution line the session gives>
```

### 8.8 A newsletter / announcement to all players
- Goes through the admin broadcast (`/api/admin/broadcast`), which already adds the banner,
  signature and unsubscribe link. Send nothing without the user reading the final text first.
- English and Dutch, each player gets their own language.
- Structure: one-line hook, "What's new" as 4–6 short items in player terms (what you can now
  do, not what we built), one short section on anything that needs explaining (for example the
  Pit Wall: what it is, who has access, how to submit an idea), a button to the site, sign-off.
- New players may be welcomed by nickname. Never an email address.

### 8.9 A prediction for Gaston
```
<Race name> — <Sprint | Main race>   (<what real data it is based on: qualifying, practice, form>)
1. <driver>   2. <driver>   …   10. <driver>
First retirement: <driver>            (main race only)
Why: <two or three lines, sources named>
```

---

## 9. Open items and known gaps

- Dutch texts written by Claude (privacy policy, tutorial, FAQ, emails) have not been read by a
  native speaker.
- `f1.miguelm.nl` redirects to `pouleposition.nl`; the user removes the DNS record and the tunnel
  entry when its traffic is gone.
- Sign-up emails to `moeders` and `SpaceAnanas` before 12 Oct were not logged; later ones are.

---

## 10. Log of decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-25 | The word PREDICTION means: give Gaston's pick for the next race, no questions | The user got tired of re-asking each race weekend |
| 2026-10-05 | Results are replaced in one transaction, validated first | A forced re-sync wiped Bahrain/Malaysia results |
| 2026-10-05 | Emails go out from "Kimi \| Poule Position" with the Kimi. signature | Personal tone; replies reach the owner |
| 2026-10-06 | Results are cross-checked across Jolpi, OpenF1 and the live feed | One source had been wrong or late |
| 2026-10-08 | First-retirement pick is mandatory for main races | Optional picks made the bonus meaningless |
| 2026-10-10 | Sprint weekends come from the official schedule, never a round list | US GP showed as a sprint; the user was "tired of checking up on you" |
| 2026-10-11 | Qualifying order loads automatically (Jolpi, then OpenF1, every 10 min Fri–Sun) | Saturday's qualifying never reached the prediction page |
| 2026-10-11 | All mail, sent and received, uses kimi@pouleposition.nl; the Gmail admin address is retired | One mailbox for the owner |
| 2026-10-11 | Sign-up and departure mails are logged in the database and retried | A missing notice could not be traced after a redeploy |
| 2026-10-12 | Weekly sync looks in `sprint_results` for sprints; no scheduled alerts for races older than 3 days | It re-synced every sprint each Monday and emailed about Miami |
| 2026-10-12 | `decisions.md` is the rulebook; Claude reads it first | The user wants the rules written down, not remembered |
| 2026-10-25 | The prediction list switches to the real starting grid (penalties applied) once OpenF1's feed shows it, about an hour before the start | In 6 of 17 races the grid differed from qualifying within the top 10 (Singapore: Russell P6 to P19) |
| 2026-10-12 | Season progression is shown as a season replay (slider through the races, yellow number square + blue bars), not a line chart | Twelve lines are unreadable on a phone; the owner picked it from three prototypes |
| 2026-10-12 | Result emails hide the results by default in every app, with tap-to-reveal where the app supports it and a button to the site everywhere | Blur only works in 3 of the common apps and half the players use Gmail; the owner chose "hidden everywhere, tap to reveal where possible" |
| 2026-10-12 | The Sign-up Emails log keeps no player email addresses | A new player can be mentioned by nickname, the address must not be exposed |
