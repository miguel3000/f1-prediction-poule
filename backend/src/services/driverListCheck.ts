import { query } from '../config/database';
import { getWatchWindow, recordFeedFlag } from './fiaDocumentsService';

// Second detector of the weekend flags: at the start of a Qualifying or Race session, the driver list
// in F1's live feed is compared with our drivers table. A stand-in missing from our table, or one of
// ours missing from the feed, is something the owner should know before predictions lock.

interface DriverRef {
  number: number;
  name: string;
}

export interface DriverListDiff {
  unknown: DriverRef[]; // in the feed, not in our table
  absent: DriverRef[]; // in our table, not in the feed
}

const MIN_FEED_DRIVERS = 10; // a feed list that is still filling up must not look like mass withdrawals

export const diffDriverList = (
  feedDriverList: Record<string, any> | undefined,
  ours: Array<{ driver_number: number; name: string }>
): DriverListDiff => {
  const feed: DriverRef[] = [];
  for (const [key, value] of Object.entries(feedDriverList ?? {})) {
    if (typeof value !== 'object' || value === null) continue;
    const number = Number(value.RacingNumber ?? key);
    if (!Number.isInteger(number)) continue;
    feed.push({ number, name: String(value.FullName ?? value.BroadcastName ?? value.Tla ?? `#${number}`) });
  }
  if (feed.length < MIN_FEED_DRIVERS) return { unknown: [], absent: [] };

  const ourNumbers = new Set(ours.map((d) => d.driver_number));
  const feedNumbers = new Set(feed.map((d) => d.number));
  return {
    unknown: feed.filter((d) => !ourNumbers.has(d.number)).sort((a, b) => a.number - b.number),
    absent: ours
      .filter((d) => !feedNumbers.has(d.driver_number))
      .map((d) => ({ number: d.driver_number, name: d.name }))
      .sort((a, b) => a.number - b.number),
  };
};

const describe = (list: DriverRef[]) => list.map((d) => `#${d.number} ${d.name}`).join(', ');

// Records one flag per session and difference (the key makes asking again harmless).
export const checkFeedDriverList = async (state: Record<string, any>, now: Date = new Date()): Promise<void> => {
  const type = state?.SessionInfo?.Type;
  if (type !== 'Qualifying' && type !== 'Race') return;

  const window = await getWatchWindow(now);
  if (!window) return;

  const ours = (
    await query(
      `SELECT driver_number, name FROM drivers WHERE season = (SELECT season FROM races WHERE id = $1)`,
      [window.raceId]
    )
  ).rows;
  const diff = diffDriverList(state.DriverList, ours);

  // A driver the owner has already marked as not racing is expected to be missing from the feed.
  const known = new Set(
    (
      await query(
        `SELECT d.driver_number FROM driver_exclusions e
         JOIN drivers d ON d.id = e.driver_id
         JOIN races r ON r.season = e.season AND r.round = e.round
         WHERE r.id = $1`,
        [window.raceId]
      )
    ).rows.map((r: any) => r.driver_number)
  );
  diff.absent = diff.absent.filter((d) => !known.has(d.number));
  if (diff.unknown.length === 0 && diff.absent.length === 0) return;

  const session = String(state.SessionInfo.Name ?? type);
  const parts: string[] = [];
  if (diff.unknown.length > 0) parts.push(`${describe(diff.unknown)} is in the live feed but not in our drivers table`);
  if (diff.absent.length > 0) parts.push(`${describe(diff.absent)} is in our drivers table but not in the live feed`);

  const key = `${window.raceName}:${session}:+${diff.unknown.map((d) => d.number).join(',')}:-${diff.absent.map((d) => d.number).join(',')}`;
  await recordFeedFlag(key, `Live feed (${session}): driver list differs from ours`, `${session}: ${parts.join('; ')}`, {
    session,
    unknown: diff.unknown,
    absent: diff.absent,
  });
};
