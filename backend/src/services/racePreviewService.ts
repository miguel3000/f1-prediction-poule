import { query } from '../config/database';
import * as jolpiService from './jolpiService';
import type { JolpiRace } from './jolpiService';
import { weekendSessions } from './weekendSchedule';
import { sendRacePreviewEmail, RacePreviewData } from './emailService';
import { predictionLockMinutes } from '../utils/predictionLock';
import { unsubscribeUrlFor } from '../utils/unsubscribeLink';

// The Thursday race weekend preview (decisions.md, "Race weekend preview"): one mail per race weekend
// to every player who has not unsubscribed from announcements, with the schedule in Dutch time, which
// predictions are still missing and the circuit. It is sent for the next main race that starts
// within PREVIEW_DAYS_AHEAD days, and the log in race_preview_log makes every run resumable: a run
// that stops half way, or the next hourly run, mails only the players who have not had it yet.

export const PREVIEW_DAYS_AHEAD = 4; // Thursday 08:00 UTC to a Sunday evening race is about 3.5 days
export const AUTO_SETTING = 'race_preview_auto'; // 'on' lets the Thursday job send without being asked

export interface PreviewDeps {
  now?: () => Date;
  getCalendar?: (season: number) => Promise<JolpiRace[]>;
  send?: (
    to: { email: string; nickname: string; language: string | null },
    data: RacePreviewData,
    unsubscribeUrl: string
  ) => Promise<boolean>;
}

const clock = (deps: PreviewDeps) => (deps.now ? deps.now() : new Date());

export const isAutoOn = async (): Promise<boolean> => {
  const result = await query('SELECT value FROM app_settings WHERE key = $1', [AUTO_SETTING]);
  return result.rows[0]?.value === 'on';
};

export const setAuto = async (on: boolean): Promise<void> => {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [AUTO_SETTING, on ? 'on' : 'off']
  );
};

export interface PreviewWeekend {
  raceId: number;
  sprintRaceId: number | null; // only on a sprint weekend
  raceName: string;
  raceStart: Date;
  calendar: JolpiRace; // the official calendar entry: sessions and circuit
}

// The weekend a preview is due for: the next main race that has not started and starts within
// PREVIEW_DAYS_AHEAD days. Null when there is none (an off week, or the season is over).
export const findPreviewWeekend = async (deps: PreviewDeps = {}): Promise<PreviewWeekend | null> => {
  const now = clock(deps);
  const until = new Date(now.getTime() + PREVIEW_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const race = await query(
    `SELECT id, season, round, race_name, race_date FROM races
     WHERE race_type = 'main' AND status = 'upcoming'
       AND race_date > ($1::timestamptz AT TIME ZONE 'UTC') AND race_date <= ($2::timestamptz AT TIME ZONE 'UTC')
     ORDER BY race_date ASC LIMIT 1`,
    [now.toISOString(), until.toISOString()]
  );
  if (race.rows.length === 0) return null;
  const row = race.rows[0];

  const sprint = await query(
    `SELECT id FROM races WHERE season = $1 AND round = $2 AND race_type = 'sprint' AND status = 'upcoming'`,
    [row.season, row.round]
  );

  const calendar = await (deps.getCalendar ?? jolpiService.getRaces)(row.season);
  const entry = calendar.find((r) => parseInt(r.round, 10) === row.round);
  if (!entry) throw new Error(`The official calendar has no round ${row.round} for ${row.season}`);

  return {
    raceId: row.id,
    sprintRaceId: sprint.rows[0]?.id ?? null,
    raceName: entry.raceName,
    raceStart: new Date(row.race_date),
    calendar: entry,
  };
};

export interface PreviewRecipient {
  id: number;
  email: string;
  nickname: string;
  language: string | null;
  raceSaved: boolean;
  sprintSaved: boolean;
}

// Players who have not unsubscribed and have not had this preview yet, with what they still have to
// predict. `all` ignores the log (a test to one player); `nicknames` narrows the list (case-insensitive).
export const listRecipients = async (
  weekend: PreviewWeekend,
  opts: { all?: boolean; nicknames?: string[]; userId?: number } = {}
): Promise<PreviewRecipient[]> => {
  const result = await query(
    `SELECT u.id, u.email, u.nickname, u.language,
            EXISTS (SELECT 1 FROM predictions p WHERE p.user_id = u.id AND p.race_id = $1) AS race_saved,
            EXISTS (SELECT 1 FROM sprint_predictions sp WHERE sp.user_id = u.id AND sp.race_id = $2) AS sprint_saved
     FROM users u
     WHERE ($3::int IS NOT NULL OR u.email_opt_out = FALSE)
       AND ($3::int IS NULL OR u.id = $3::int)
       AND ($4::boolean OR NOT EXISTS (SELECT 1 FROM race_preview_log l WHERE l.race_id = $1 AND l.user_id = u.id))
     ORDER BY u.nickname`,
    [weekend.raceId, weekend.sprintRaceId, opts.userId ?? null, opts.all ?? false]
  );
  const wanted = opts.nicknames?.map((n) => n.trim().toLowerCase());
  return result.rows
    .filter((r) => !wanted || wanted.includes(r.nickname.toLowerCase()))
    .map((r) => ({
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      language: r.language,
      raceSaved: r.race_saved,
      sprintSaved: r.sprint_saved,
    }));
};

// What one player sees: the weekend, plus their own saved or missing predictions
export const previewDataFor = (weekend: PreviewWeekend, who: PreviewRecipient): RacePreviewData => {
  const c = weekend.calendar;
  return {
    raceName: c.raceName,
    circuitId: c.Circuit.circuitId,
    circuitName: c.Circuit.circuitName,
    locality: c.Circuit.Location.locality,
    country: c.Circuit.Location.country,
    sessions: weekendSessions(c).map((s) => ({ key: s.key, startsAt: new Date(s.startsAt) })),
    predictions: [
      ...(weekend.sprintRaceId ? [{ kind: 'sprint' as const, saved: who.sprintSaved }] : []),
      { kind: 'race' as const, saved: who.raceSaved },
    ],
    lockMinutes: predictionLockMinutes(),
  };
};

const sender = (deps: PreviewDeps) =>
  deps.send ?? ((to, data, url) => sendRacePreviewEmail(to.email, to.nickname, to.language, data, url));

export interface PreviewRunResult {
  raceName: string | null; // null: no weekend is due
  sent: number;
  failed: string[]; // nicknames, to retry
}

// Sends the preview to everyone who has not had it, one by one, recording each success so that a
// run which fails half way is simply continued by the next one.
export const sendRacePreviews = async (
  deps: PreviewDeps = {},
  opts: { nicknames?: string[] } = {}
): Promise<PreviewRunResult> => {
  const weekend = await findPreviewWeekend(deps);
  if (!weekend) return { raceName: null, sent: 0, failed: [] };

  const send = sender(deps);
  const recipients = await listRecipients(weekend, { nicknames: opts.nicknames });
  let sent = 0;
  const failed: string[] = [];
  for (const who of recipients) {
    let ok = false;
    try {
      ok = await send(who, previewDataFor(weekend, who), unsubscribeUrlFor(who.id));
    } catch (error) {
      console.error('Race weekend preview failed for', who.nickname, error);
    }
    if (!ok) {
      failed.push(who.nickname);
      continue;
    }
    sent++;
    await query(
      'INSERT INTO race_preview_log (race_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [weekend.raceId, who.id]
    );
  }
  return { raceName: weekend.raceName, sent, failed };
};

// What the hourly Thursday job runs: nothing at all while the owner's switch is off
export const runAutomaticPreview = async (
  deps: PreviewDeps = {}
): Promise<PreviewRunResult & { switchedOff: boolean }> => {
  if (!(await isAutoOn())) return { raceName: null, sent: 0, failed: [], switchedOff: true };
  return { ...(await sendRacePreviews(deps)), switchedOff: false };
};

// The preview as one player would get it, to that player's own address, recorded nowhere.
// Used by the Pitlane "send me a test" and the script's --preview.
export const sendRacePreviewTest = async (
  match: { userId: number } | { nickname: string },
  deps: PreviewDeps = {}
): Promise<{ raceName: string; to: string } | null> => {
  const weekend = await findPreviewWeekend(deps);
  if (!weekend) return null;
  const [who] = await listRecipients(weekend, {
    all: true,
    ...('userId' in match ? { userId: match.userId } : { nicknames: [match.nickname] }),
  });
  if (!who) return null;
  const ok = await sender(deps)(who, previewDataFor(weekend, who), unsubscribeUrlFor(who.id));
  if (!ok) throw new Error('The test mail could not be sent');
  return { raceName: weekend.raceName, to: who.nickname };
};

// For the Pitlane card and --dry-run: what would go out, without sending
export interface PreviewStatus {
  autoOn: boolean;
  weekend: { raceName: string; raceStart: string; sprint: boolean } | null;
  waiting: number; // players who would get it now
  alreadySent: number;
  problem?: string; // why the weekend could not be worked out (the official calendar), if it could not
}

export const previewStatus = async (deps: PreviewDeps = {}): Promise<PreviewStatus> => {
  const autoOn = await isAutoOn();
  let weekend: PreviewWeekend | null;
  try {
    weekend = await findPreviewWeekend(deps);
  } catch (error) {
    return { autoOn, weekend: null, waiting: 0, alreadySent: 0, problem: error instanceof Error ? error.message : 'Unknown error' };
  }
  if (!weekend) return { autoOn, weekend: null, waiting: 0, alreadySent: 0 };
  const waiting = (await listRecipients(weekend)).length;
  const sent = await query('SELECT COUNT(*)::int AS n FROM race_preview_log WHERE race_id = $1', [weekend.raceId]);
  return {
    autoOn,
    weekend: { raceName: weekend.raceName, raceStart: weekend.raceStart.toISOString(), sprint: weekend.sprintRaceId !== null },
    waiting,
    alreadySent: sent.rows[0].n,
  };
};
