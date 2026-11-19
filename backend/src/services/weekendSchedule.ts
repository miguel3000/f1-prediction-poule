import { JolpiRace } from './jolpiService';

// One race weekend as the official calendar (Jolpi) has it: every session that exists that
// weekend with its start time. Practice, sprint qualifying, sprint, qualifying and the race are
// all optional parts of the calendar entry, so a sprint weekend simply has different sessions
// (decisions.md: derive the schedule, never hard-code which weekends have a sprint).
export type SessionKey = 'fp1' | 'fp2' | 'fp3' | 'sprint_qualifying' | 'sprint' | 'qualifying' | 'race';

export interface WeekendSession {
  key: SessionKey;
  startsAt: string; // UTC ISO
}

const toIso = (s?: { date: string; time?: string }): string | null => {
  if (!s?.date) return null;
  const time = s.time ?? '00:00:00Z';
  const iso = `${s.date}T${time.endsWith('Z') ? time : `${time}Z`}`;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
};

// Oldest first. Sessions the calendar does not list are left out.
export const weekendSessions = (race: JolpiRace): WeekendSession[] => {
  const entries: Array<[SessionKey, string | null]> = [
    ['fp1', toIso(race.FirstPractice)],
    ['fp2', toIso(race.SecondPractice)],
    ['fp3', toIso(race.ThirdPractice)],
    ['sprint_qualifying', toIso(race.SprintQualifying ?? race.SprintShootout)],
    ['sprint', toIso(race.Sprint)],
    ['qualifying', toIso(race.Qualifying)],
    ['race', toIso({ date: race.date, time: race.time })],
  ];
  return entries
    .filter((e): e is [SessionKey, string] => e[1] !== null)
    .map(([key, startsAt]) => ({ key, startsAt }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
};
