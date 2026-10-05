import { query } from '../config/database';
import * as jolpiService from './jolpiService';
import * as openF1Service from './openF1Service';
import { getLiveClassification } from './raceClassificationService';
import { normalizeStatus, dbStatusFor, NormalizedStatus } from '../utils/resultStatus';
import { replaceRaceResults, ResultRow } from '../utils/replaceResults';
import { sendResultsCheckAlert } from './emailService';

// Results cross-check: fetches a race's classification from several
// independent sources, compares what decides the points (the scored top
// positions and the first retirement) and decides whether the results can be
// trusted. See decideRace() for the policy.

export type SourceName = 'jolpi' | 'openf1' | 'f1live';

// When two sources are equally trustworthy, rows come from the first of these.
const PRIORITY: SourceName[] = ['jolpi', 'openf1', 'f1live'];
const LABELS: Record<SourceName, string> = { jolpi: 'Jolpi (Ergast)', openf1: 'OpenF1', f1live: 'F1 live timing' };

const MAIN_POINTS: Record<number, number> = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
const SPRINT_POINTS: Record<number, number> = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

export interface RaceRef {
  id: number;
  season: number;
  round: number;
  race_name: string;
  race_date: any;
  race_type: 'main' | 'sprint';
}

export interface SourceRow {
  number: number;
  position: number;
  status: NormalizedStatus;
  rawStatus?: string;
  points?: number;
}

export interface SourceResult {
  source: SourceName;
  label: string;
  available: boolean;
  note?: string;
  rows: SourceRow[];
}

interface Signature {
  top: number[];
  firstOut: number | null;
}

export type Verdict = 'confirmed' | 'single' | 'conflict' | 'none';

export interface Difference {
  source: SourceName;
  what: string;
}

export interface Analysis {
  verdict: Verdict;
  scored: number;
  sources: Array<{ source: SourceName; label: string; available: boolean; note?: string; top: number[]; firstOut: number | null }>;
  consensus: Signature | null;
  // The source whose rows match the consensus on everything that scores
  chosen: SourceName | null;
  differences: Difference[];
}

const isSprintRace = (race: RaceRef) => race.race_type === 'sprint';
const scoredPositions = (race: RaceRef) => (isSprintRace(race) ? 8 : 10);

// ---------- fetching ----------

async function fetchJolpi(race: RaceRef): Promise<SourceResult> {
  const base = { source: 'jolpi' as const, label: LABELS.jolpi };
  try {
    jolpiService.clearRaceCache(race.season, race.round);
    const results: any[] = isSprintRace(race)
      ? await jolpiService.getSprintResults(race.season, race.round)
      : await jolpiService.getRaceResults(race.season, race.round);
    const rows = results
      .map((r) => ({
        number: parseInt(r.number, 10),
        position: parseInt(r.position, 10),
        status: normalizeStatus(r.status),
        rawStatus: r.status as string,
        points: parseFloat(r.points ?? '0'),
      }))
      .filter((r) => Number.isInteger(r.number) && Number.isInteger(r.position));
    return rows.length > 0 ? { ...base, available: true, rows } : { ...base, available: false, rows: [], note: 'No results published yet' };
  } catch (error: any) {
    return { ...base, available: false, rows: [], note: `Unavailable (${error?.response?.status || error?.message || 'error'})` };
  }
}

async function fetchOpenF1(race: RaceRef): Promise<SourceResult> {
  const base = { source: 'openf1' as const, label: LABELS.openf1 };
  try {
    const sessionKey = isSprintRace(race)
      ? await openF1Service.getSprintSessionKey(race.season, race.race_date)
      : await openF1Service.getRaceSessionKey(race.season, race.race_date);
    if (!sessionKey) return { ...base, available: false, rows: [], note: 'Session not found' };

    const results = await openF1Service.getRaceResults(sessionKey);
    if (results.length === 0) return { ...base, available: false, rows: [], note: 'No results published yet' };

    // Drivers who were not classified come back with position null: number them
    // after the last classified finisher, in feed order.
    let next = Math.max(0, ...results.map((r) => r.position ?? 0)) + 1;
    const rows: SourceRow[] = results.map((r) => ({
      number: Number(r.driver_number),
      position: r.position ?? next++,
      status: r.dsq ? 'dsq' : r.dnf ? 'dnf' : r.dns ? 'dns' : 'finished',
      points: Number(r.points ?? 0),
    }));
    return { ...base, available: true, rows };
  } catch (error: any) {
    return { ...base, available: false, rows: [], note: `Unavailable (${error?.response?.status || error?.message || 'error'})` };
  }
}

async function fetchLive(race: RaceRef): Promise<SourceResult> {
  const base = { source: 'f1live' as const, label: LABELS.f1live };
  try {
    const stored = await getLiveClassification(race.season, race.round, race.race_type);
    if (!stored) return { ...base, available: false, rows: [], note: 'Not captured from the live feed' };
    const rows: SourceRow[] = stored.rows.map((r) => ({
      number: r.driver_number,
      position: r.position,
      status: r.status,
    }));
    return {
      ...base,
      available: true,
      rows,
      note: stored.final ? undefined : 'Captured before the session was finalised',
    };
  } catch (error: any) {
    return { ...base, available: false, rows: [], note: `Unavailable (${error?.message || 'error'})` };
  }
}

export const fetchSources = async (race: RaceRef): Promise<SourceResult[]> => {
  // Independent sources: one being slow or down must not hold up the others.
  return Promise.all([fetchJolpi(race), fetchOpenF1(race), fetchLive(race)]);
};

// ---------- comparing ----------

const signatureOf = (source: SourceResult, race: RaceRef): Signature => {
  const sorted = [...source.rows].sort((a, b) => a.position - b.position);
  const top = sorted.filter((r) => r.position <= scoredPositions(race)).map((r) => r.number);
  // Same rule the scoring uses: among retirements, the one classified last went out first.
  // There is no first-retirement bonus in sprints.
  let firstOut: number | null = null;
  if (!isSprintRace(race)) {
    const dnfs = sorted.filter((r) => r.status === 'dnf');
    if (dnfs.length > 0) firstOut = dnfs[dnfs.length - 1].number;
  }
  return { top, firstOut };
};

const keyOfTop = (s: Signature) => s.top.join(',');

// Most common value (needs at least two sources to count as agreement).
const majority = <T>(values: T[], key: (v: T) => string): { value: T; count: number } | null => {
  const counts = new Map<string, { value: T; count: number }>();
  for (const v of values) {
    const k = key(v);
    const entry = counts.get(k);
    if (entry) entry.count++;
    else counts.set(k, { value: v, count: 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return best && best.count >= 2 ? best : null;
};

export const analyzeSources = (race: RaceRef, sources: SourceResult[]): Analysis => {
  const scored = scoredPositions(race);
  const available = sources.filter((s) => s.available && s.rows.length >= scored);
  const sigs = new Map<SourceName, Signature>();
  for (const s of available) sigs.set(s.source, signatureOf(s, race));

  const summary = sources.map((s) => {
    const sig = sigs.get(s.source);
    return {
      source: s.source,
      label: s.label,
      available: sigs.has(s.source),
      note: s.available && !sigs.has(s.source) ? 'Too few results to compare' : s.note,
      top: sig?.top ?? [],
      firstOut: sig?.firstOut ?? null,
    };
  });

  const none: Analysis = { verdict: 'none', scored, sources: summary, consensus: null, chosen: null, differences: [] };
  if (available.length === 0) return none;
  if (available.length === 1) {
    const only = available[0];
    return { ...none, verdict: 'single', consensus: sigs.get(only.source)!, chosen: only.source };
  }

  const topMajority = majority([...sigs.values()], keyOfTop);
  const outMajority = majority([...sigs.values()], (s) => String(s.firstOut));
  if (!topMajority || !outMajority) {
    return { ...none, verdict: 'conflict', differences: describeDifferences(sigs, null) };
  }

  const consensus: Signature = { top: topMajority.value.top, firstOut: outMajority.value.firstOut };
  const chosen =
    PRIORITY.find((name) => {
      const sig = sigs.get(name);
      return sig && keyOfTop(sig) === keyOfTop(consensus) && sig.firstOut === consensus.firstOut;
    }) ?? null;

  return {
    verdict: chosen ? 'confirmed' : 'conflict',
    scored,
    sources: summary,
    consensus,
    chosen,
    differences: describeDifferences(sigs, consensus),
  };
};

function describeDifferences(sigs: Map<SourceName, Signature>, consensus: Signature | null): Difference[] {
  // Without a consensus, compare everything against the highest-priority source present.
  const reference =
    consensus ?? sigs.get(PRIORITY.find((n) => sigs.has(n))!) ?? { top: [], firstOut: null };
  const out: Difference[] = [];
  for (const [source, sig] of sigs) {
    const parts: string[] = [];
    const len = Math.max(sig.top.length, reference.top.length);
    for (let i = 0; i < len; i++) {
      if (sig.top[i] !== reference.top[i]) {
        parts.push(`P${i + 1}: #${sig.top[i] ?? '–'} (expected #${reference.top[i] ?? '–'})`);
      }
    }
    if (sig.firstOut !== reference.firstOut) {
      parts.push(`first retirement: ${sig.firstOut ? `#${sig.firstOut}` : 'none'} (expected ${reference.firstOut ? `#${reference.firstOut}` : 'none'})`);
    }
    if (parts.length > 0) out.push({ source, what: parts.slice(0, 4).join('; ') });
  }
  return out;
}

// ---------- deciding ----------

export type CheckMode = 'provisional' | 'final' | 'manual';
export type Action = 'apply' | 'wait' | 'hold';

export interface Decision {
  action: Action;
  analysis: Analysis;
  sources: SourceResult[];
  // The source the rows to store come from (when action is 'apply')
  rowsFrom: SourceName | null;
  reason: string;
  // Something worth telling the admin even though results were applied
  warning: string | null;
}

// How long after the start a session is normally fully over and published.
const expectedPublishMs = (race: RaceRef) => (isSprintRace(race) ? 90 : 150) * 60 * 1000;

const sourceByPriority = (sources: SourceResult[]) =>
  PRIORITY.map((n) => sources.find((s) => s.source === n && s.available && s.rows.length > 0)).find(Boolean) ?? null;

export const decideRace = async (
  race: RaceRef,
  mode: CheckMode,
  opts: { force?: boolean } = {}
): Promise<Decision> => {
  const sources = await fetchSources(race);
  const analysis = analyzeSources(race, sources);
  const done = (action: Action, rowsFrom: SourceName | null, reason: string, warning: string | null = null): Decision => ({
    action,
    analysis,
    sources,
    rowsFrom,
    reason,
    warning,
  });

  const names = analysis.sources.filter((s) => s.available).map((s) => s.label).join(', ');

  switch (analysis.verdict) {
    case 'confirmed': {
      const dissent = analysis.differences.length > 0
        ? `${analysis.differences.map((d) => LABELS[d.source]).join(', ')} disagree${analysis.differences.length === 1 ? 's' : ''} with the other sources`
        : null;
      return done('apply', analysis.chosen, `Confirmed by ${names}`, dissent);
    }

    case 'single': {
      const only = sourceByPriority(sources)!;
      // Final processing may only keep what is already stored, never change it on one source.
      if (mode === 'final') return finalOrHold(race, analysis, sources, done);
      const waitedLongEnough = Date.now() >= new Date(race.race_date).getTime() + expectedPublishMs(race);
      if (mode === 'manual' || waitedLongEnough) {
        return done('apply', only.source, `Only ${only.label} has results`, `Only ${only.label} had results, so they could not be cross-checked.`);
      }
      return done('wait', null, `Only ${only.label} has results so far, waiting for a second source`);
    }

    case 'conflict': {
      if (mode === 'final') return finalOrHold(race, analysis, sources, done);
      if (opts.force && mode === 'manual') {
        const best = sourceByPriority(sources)!;
        return done('apply', best.source, 'Sources disagree; applied on your force', `Sources disagreed, so ${best.label} was used because the sync was forced.`);
      }
      return done('hold', null, 'Sources disagree, nothing applied');
    }

    default:
      return done('wait', null, 'No source has results yet');
  }
};

// Final processing re-checks results a day later. Anything the sources agree on is
// applied; if they cannot agree, results are only kept as they are — never changed.
async function finalOrHold(
  race: RaceRef,
  analysis: Analysis,
  sources: SourceResult[],
  done: (a: Action, from: SourceName | null, reason: string, warning?: string | null) => Decision
): Promise<Decision> {
  const stored = await loadStoredSignature(race);
  if (stored) {
    const match = PRIORITY.find((name) => {
      const src = sources.find((s) => s.source === name && s.available);
      if (!src) return false;
      const sig = signatureOf(src, race);
      return keyOfTop(sig) === keyOfTop(stored) && sig.firstOut === stored.firstOut;
    });
    if (match) return done('apply', match, 'Sources could not be confirmed against each other, but match the stored results');
  }
  return done('hold', null, 'Sources disagree with the stored results and with each other, results not changed');
}

async function loadStoredSignature(race: RaceRef): Promise<Signature | null> {
  const table = isSprintRace(race) ? 'sprint_results' : 'race_results';
  const result = await query(
    `SELECT rr.position, rr.status, d.driver_number
     FROM ${table} rr JOIN drivers d ON d.id = rr.driver_id
     WHERE rr.race_id = $1 ORDER BY rr.position ASC`,
    [race.id]
  );
  if (result.rows.length === 0) return null;
  const rows: SourceRow[] = result.rows.map((r: any) => ({
    number: r.driver_number,
    position: r.position,
    status: normalizeStatus(r.status),
  }));
  return signatureOf({ source: 'jolpi', label: 'stored', available: true, rows }, race);
}

// ---------- read-only comparison for the Pitlane ----------

export interface Comparison {
  race: { id: number; round: number; name: string; type: 'main' | 'sprint'; status: string };
  scored: number;
  verdict: Verdict;
  wouldDo: { action: Action; reason: string; warning: string | null; rowsFrom: SourceName | null };
  sources: Array<{
    source: SourceName;
    label: string;
    available: boolean;
    note?: string;
    top: Array<{ number: number; name: string }>;
    firstOut: { number: number; name: string } | null;
  }>;
  stored: { top: Array<{ number: number; name: string }>; firstOut: { number: number; name: string } | null } | null;
  differences: Array<{ label: string; what: string }>;
}

// Fetches and compares every source for one race without changing anything.
export const compareRace = async (race: RaceRef & { status: string }): Promise<Comparison> => {
  const decision = await decideRace(race, 'manual');
  const stored = await loadStoredSignature(race);

  const names = await query('SELECT driver_number, name FROM drivers WHERE season = $1', [race.season]);
  const nameOf = new Map<number, string>(names.rows.map((d: any) => [d.driver_number, d.name]));
  const withName = (n: number) => ({ number: n, name: nameOf.get(n) ?? `#${n}` });

  return {
    race: { id: race.id, round: race.round, name: race.race_name, type: race.race_type, status: race.status },
    scored: decision.analysis.scored,
    verdict: decision.analysis.verdict,
    wouldDo: { action: decision.action, reason: decision.reason, warning: decision.warning, rowsFrom: decision.rowsFrom },
    sources: decision.analysis.sources.map((s) => ({
      source: s.source,
      label: s.label,
      available: s.available,
      note: s.note,
      top: s.top.map(withName),
      firstOut: s.firstOut ? withName(s.firstOut) : null,
    })),
    stored: stored
      ? { top: stored.top.map(withName), firstOut: stored.firstOut ? withName(stored.firstOut) : null }
      : null,
    differences: decision.analysis.differences.map((d) => ({ label: LABELS[d.source], what: d.what })),
  };
};

// ---------- applying ----------

export interface AppliedResult {
  inserted: number;
  podium: Array<{ position: number; driverName: string; points: number }>;
  unknownNumbers: number[];
}

// Stores the chosen source's rows (validated, one transaction) and returns what
// the emails need. Throws without touching existing results if anything is invalid.
export const applyDecision = async (race: RaceRef, decision: Decision): Promise<AppliedResult> => {
  if (decision.action !== 'apply' || !decision.rowsFrom) {
    throw new Error('Decision does not allow applying results');
  }
  const source = decision.sources.find((s) => s.source === decision.rowsFrom)!;
  const isSprint = isSprintRace(race);
  const pointsMap = isSprint ? SPRINT_POINTS : MAIN_POINTS;

  const driversResult = await query('SELECT id, driver_number, name FROM drivers WHERE driver_number = ANY($1) AND season = $2', [
    source.rows.map((r) => r.number),
    race.season,
  ]);
  const drivers = new Map<number, { id: number; name: string }>(
    driversResult.rows.map((d: any) => [d.driver_number, { id: d.id, name: d.name }])
  );

  const rows: ResultRow[] = [];
  const unknownNumbers: number[] = [];
  const podium: AppliedResult['podium'] = [];
  const maxPositions = scoredPositions(race);

  for (const r of [...source.rows].sort((a, b) => a.position - b.position)) {
    const driver = drivers.get(r.number);
    if (!driver) {
      unknownNumbers.push(r.number);
      continue;
    }
    // Sources without points (the live feed) get the standard F1 points for the position.
    const points = r.points ?? (r.status === 'finished' || r.status === 'dnf' ? pointsMap[r.position] ?? 0 : 0);
    rows.push({ driverId: driver.id, position: r.position, points, status: r.rawStatus ?? dbStatusFor(r.status) });
    if (r.position <= maxPositions) {
      podium.push({ position: r.position, driverName: driver.name, points: pointsMap[r.position] || 0 });
    }
  }

  const inserted = await replaceRaceResults(isSprint ? 'sprint_results' : 'race_results', race.id, rows);
  return { inserted, podium, unknownNumbers };
};

// ---------- telling the admin ----------

// Emails the admin about a check outcome, but only when that outcome differs from
// the one they were last told about for this race (the cron runs every 5 minutes).
export const notifyAdminOfDecision = async (race: RaceRef, mode: CheckMode, decision: Decision): Promise<void> => {
  try {
    const needsAttention = decision.action === 'hold' || decision.warning !== null;
    const signature = JSON.stringify({
      mode,
      action: decision.action,
      verdict: decision.analysis.verdict,
      differences: decision.analysis.differences,
      sources: decision.analysis.sources.map((s) => [s.source, s.top.join(','), s.firstOut]),
    });

    const existing = await query('SELECT notified_signature FROM result_checks WHERE race_id = $1', [race.id]);
    const lastNotified = existing.rows[0]?.notified_signature ?? null;

    await query(
      `INSERT INTO result_checks (race_id, verdict, detail, notified_signature, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (race_id) DO UPDATE SET verdict = EXCLUDED.verdict, detail = EXCLUDED.detail, updated_at = NOW()`,
      [race.id, decision.analysis.verdict, JSON.stringify({ mode, action: decision.action, reason: decision.reason }), lastNotified]
    );

    if (!needsAttention || lastNotified === signature) return;

    const names = await query('SELECT driver_number, name FROM drivers WHERE season = $1', [race.season]);
    const driverNames: Record<number, string> = {};
    for (const d of names.rows) driverNames[d.driver_number] = d.name;

    const sent = await sendResultsCheckAlert({
      driverNames,
      raceName: race.race_name,
      isSprint: isSprintRace(race),
      season: race.season,
      mode,
      action: decision.action,
      reason: decision.reason,
      warning: decision.warning,
      scored: decision.analysis.scored,
      sources: decision.analysis.sources,
      differences: decision.analysis.differences.map((d) => ({ label: LABELS[d.source], what: d.what })),
    });
    if (sent) {
      await query('UPDATE result_checks SET notified_signature = $2 WHERE race_id = $1', [race.id, signature]);
    }
  } catch (error) {
    console.error('Result check notification failed:', error);
  }
};
