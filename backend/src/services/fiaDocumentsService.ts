import { query } from '../config/database';
import { predictionLockTime } from '../utils/predictionLock';
import { sendFlagsDigest, sendWatcherFailureNotice } from './emailService';
import { parseListing, classifyTitle, parseDocumentText, type ListedDocument, type DocKind } from './fiaDocumentsParser';

// Weekend flags: what the watcher remembers (fia_documents, fia_checks) and when it is allowed to work.
// Everything that must survive a redeploy lives in the database (container logs do not).

export interface WatchWindow {
  raceId: number;
  raceName: string;
  start: Date;
  end: Date;
}

export interface FlagRow {
  id: number;
  title: string;
  kind: string | null;
  summary: string | null;
  facts: Record<string, any>;
  url: string;
  publishedAt: Date;
  event: string | null;
  source: 'fia' | 'feed';
}

const WINDOW_DAYS = 6;

// The watcher works from six days before the next main race until its prediction lock: papers
// published later cannot change a prediction any more. Sprint rows do not open a window.
export const getWatchWindow = async (now: Date): Promise<WatchWindow | null> => {
  const next = await query(
    `SELECT id, race_name, race_date FROM races
     WHERE race_type = 'main' AND race_date >= $1
     ORDER BY race_date LIMIT 1`,
    [now]
  );
  const race = next.rows[0];
  if (!race) return null;
  const start = new Date(new Date(race.race_date).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const end = predictionLockTime(race.race_date);
  if (now.getTime() < start.getTime() || now.getTime() >= end.getTime()) return null;
  return { raceId: race.id, raceName: race.race_name, start, end };
};

// Stores documents published inside the window that are not known yet; returns how many were new.
// Known documents (by URL) are left exactly as they are.
export const storeListed = async (event: string, docs: ListedDocument[], window: WatchWindow): Promise<number> => {
  let added = 0;
  for (const d of docs) {
    if (d.publishedAt.getTime() < window.start.getTime() || d.publishedAt.getTime() > window.end.getTime()) continue;
    const result = await query(
      `INSERT INTO fia_documents (url, source, event, doc_number, title, published_at)
       VALUES ($1, 'fia', $2, $3, $4, $5)
       ON CONFLICT (url) DO NOTHING`,
      [d.url, event, d.docNumber, d.title, d.publishedAt]
    );
    added += result.rowCount ?? 0;
  }
  return added;
};

const toFlagRow = (r: any): FlagRow => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  summary: r.summary,
  facts: r.facts ?? {},
  url: r.url,
  publishedAt: new Date(r.published_at),
  event: r.event,
  source: r.source,
});

export const getUnsentFlags = async (): Promise<FlagRow[]> => {
  const result = await query(
    `SELECT id, title, kind, summary, facts, url, published_at, event, source
     FROM fia_documents
     WHERE severity = 'flag' AND flag_emailed_at IS NULL
     ORDER BY published_at, id`
  );
  return result.rows.map(toFlagRow);
};

export const markFlagsEmailed = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  await query('UPDATE fia_documents SET flag_emailed_at = NOW() WHERE id = ANY($1)', [ids]);
};

// A difference found in the live feed. The key makes the same finding count once.
export const recordFeedFlag = async (
  key: string,
  title: string,
  summary: string,
  facts: Record<string, unknown>
): Promise<boolean> => {
  const result = await query(
    `INSERT INTO fia_documents (url, source, title, published_at, status, kind, severity, summary, facts)
     VALUES ($1, 'feed', $2, NOW(), 'read', 'driver_list', 'flag', $3, $4)
     ON CONFLICT (url) DO NOTHING`,
    [`feed:${key}`, title, summary, JSON.stringify(facts)]
  );
  return (result.rowCount ?? 0) === 1;
};

export const recordCheck = async (r: { ok: boolean; found: number; added: number; error?: string }): Promise<void> => {
  await query('INSERT INTO fia_checks (ok, found, added, error) VALUES ($1, $2, $3, $4)', [
    r.ok,
    r.found,
    r.added,
    r.error ?? null,
  ]);
};

// True once per streak of three or more failed runs in a row, and only inside a watch window.
export const shouldAlertWatcherFailure = async (now: Date): Promise<boolean> => {
  if (!(await getWatchWindow(now))) return false;
  const recent = (await query('SELECT id, ok, alerted FROM fia_checks ORDER BY id DESC LIMIT 50')).rows;
  let streak = 0;
  let alreadyAlerted = false;
  for (const row of recent) {
    if (row.ok) break;
    streak++;
    if (row.alerted) alreadyAlerted = true;
  }
  if (streak < 3 || alreadyAlerted) return false;
  await query('UPDATE fia_checks SET alerted = TRUE WHERE id = $1', [recent[0].id]);
  return true;
};

export const getLastCheck = async () => {
  const row = (await query('SELECT ran_at, ok, found, added, error FROM fia_checks ORDER BY id DESC LIMIT 1')).rows[0];
  return row ? { ranAt: new Date(row.ran_at), ok: row.ok as boolean, found: row.found as number, added: row.added as number, error: (row.error ?? null) as string | null } : null;
};

// Flags first, then the newest documents.
export const listDocuments = async (limit: number) => {
  const result = await query(
    `SELECT id, title, kind, severity, status, summary, published_at, url, flag_emailed_at, source, attempts
     FROM fia_documents
     ORDER BY (severity = 'flag') DESC NULLS LAST, published_at DESC, id DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((r: any) => ({
    id: r.id as number,
    title: r.title as string,
    kind: r.kind as string | null,
    severity: r.severity as 'flag' | 'seen' | null,
    status: r.status as string,
    summary: r.summary as string | null,
    publishedAt: new Date(r.published_at),
    url: r.url as string,
    emailed: r.flag_emailed_at !== null,
    source: r.source as 'fia' | 'feed',
    attempts: r.attempts as number,
  }));
};

// ---- The check run -------------------------------------------------------------------------------

export interface CheckDeps {
  fetchListing: () => Promise<string>;
  fetchPdfText: (url: string) => Promise<string>;
  now?: () => Date;
}

export interface CheckResult {
  ran: boolean;
  ok: boolean;
  found: number;
  added: number;
  flagged: number;
  error?: string;
}

const MAX_ATTEMPTS = 3;

// Whether the drivers of a driver change are in our drivers table: the stand-in missing is exactly
// the gap that left Hirakawa out of the picker.
const driverChangeInTable = async (facts: Record<string, unknown>, raceId: number) => {
  const has = async (number: unknown) =>
    typeof number === 'number' &&
    (
      await query(
        `SELECT 1 FROM drivers WHERE driver_number = $1 AND season = (SELECT season FROM races WHERE id = $2)`,
        [number, raceId]
      )
    ).rows.length > 0;
  return { originalInTable: await has(facts.originalNumber), standInInTable: await has(facts.replacementNumber) };
};

// Opens every stored document that still has to be read. Returns how many became flags.
const readPending = async (deps: CheckDeps, window: WatchWindow): Promise<number> => {
  const pending = (
    await query(
      `SELECT id, title, url, attempts FROM fia_documents
       WHERE source = 'fia' AND status IN ('pending', 'failed') AND attempts < $1
       ORDER BY published_at, id`,
      [MAX_ATTEMPTS]
    )
  ).rows;

  let flagged = 0;
  for (const doc of pending) {
    const { read, kind } = classifyTitle(doc.title);
    if (!read) {
      await query("UPDATE fia_documents SET status = 'skipped', kind = 'other' WHERE id = $1", [doc.id]);
      continue;
    }

    let parsed: ReturnType<typeof parseDocumentText> | null = null;
    let failure: string | null = null;
    try {
      parsed = parseDocumentText(kind, await deps.fetchPdfText(doc.url));
      if (!parsed.understood) failure = 'The document text could not be understood';
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    if (parsed && parsed.understood) {
      const facts: Record<string, unknown> = { ...parsed.facts };
      if (kind === 'driver_change') Object.assign(facts, await driverChangeInTable(facts, window.raceId));
      await query(
        `UPDATE fia_documents SET status = 'read', kind = $2, severity = $3, summary = $4, facts = $5, read_error = NULL
         WHERE id = $1`,
        [doc.id, kind, parsed.severity, parsed.summary, JSON.stringify(facts)]
      );
      if (parsed.severity === 'flag') flagged++;
      continue;
    }

    // Could not read it. A driver change is flagged from its title at once; anything else is retried and,
    // when it still cannot be read, flagged (unread) rather than ignored.
    const attempts = doc.attempts + 1;
    if (kind === 'driver_change') {
      await query(
        `UPDATE fia_documents SET status = 'read', kind = $2, severity = 'flag', attempts = $3, read_error = $4,
           summary = $5, facts = $6 WHERE id = $1`,
        [doc.id, kind, attempts, failure, `Driver change (details could not be read, see the document): ${doc.title}`, JSON.stringify({ unreadable: true })]
      );
      flagged++;
    } else if (attempts >= MAX_ATTEMPTS && (kind === 'infringement' || kind === 'decision')) {
      await query(
        `UPDATE fia_documents SET status = 'failed', kind = $2, severity = 'flag', attempts = $3, read_error = $4,
           summary = $5, facts = $6 WHERE id = $1`,
        [doc.id, kind, attempts, failure, `Could not read: ${doc.title}`, JSON.stringify({ unreadable: true })]
      );
      flagged++;
    } else {
      await query(
        `UPDATE fia_documents SET status = 'failed', kind = $2, attempts = $3, read_error = $4 WHERE id = $1`,
        [doc.id, kind as DocKind, attempts, failure]
      );
    }
  }
  return flagged;
};

// One pass of the watcher: inside the window, fetch the listing, store what is new, open what is worth
// opening. Never throws; a failure is recorded as a failed run.
export const runCheck = async (deps: CheckDeps): Promise<CheckResult> => {
  const now = deps.now ? deps.now() : new Date();
  const window = await getWatchWindow(now);
  if (!window) return { ran: false, ok: true, found: 0, added: 0, flagged: 0 };

  try {
    const listing = parseListing(await deps.fetchListing());
    if (!listing) throw new Error('The FIA page has no expanded event block (the page may have changed)');
    const added = await storeListed(listing.event, listing.documents, window);
    const flagged = await readPending(deps, window);
    await recordCheck({ ok: true, found: listing.documents.length, added });
    return { ran: true, ok: true, found: listing.documents.length, added, flagged };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordCheck({ ok: false, found: 0, added: 0, error: message });
    return { ran: true, ok: false, found: 0, added: 0, flagged: 0, error: message };
  }
};

// ---- The email to the owner ----------------------------------------------------------------------

// Mails every flag that has not been mailed yet, and, once per streak of failed runs, a notice that
// the watcher itself is failing. A mail that does not go out changes nothing, so the next run tries again.
export const emailPendingFlags = async (now: Date): Promise<{ sent: number }> => {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    console.error('ADMIN_EMAIL not configured — cannot send weekend flags');
    return { sent: 0 };
  }

  let sent = 0;
  const flags = await getUnsentFlags();
  if (flags.length > 0 && (await sendFlagsDigest(to, flags))) {
    await markFlagsEmailed(flags.map((f) => f.id));
    sent = flags.length;
  }

  if (await shouldAlertWatcherFailure(now)) {
    const last = await getLastCheck();
    if (!(await sendWatcherFailureNotice(to, last?.error ?? null))) {
      // Not delivered: allow the next run to send it.
      await query(
        `UPDATE fia_checks SET alerted = FALSE WHERE id = (SELECT id FROM fia_checks WHERE alerted ORDER BY id DESC LIMIT 1)`
      );
    }
  }
  return { sent };
};
