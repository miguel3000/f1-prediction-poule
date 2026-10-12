// Shape returned by /api/leaderboard/season-history, plus helpers shared by the progress views.

export interface SeasonRace {
  id: number;
  name: string;
  country: string;
  date: string;
  race_type: string;
  round?: number;
}

export interface SeasonUser {
  id: number;
  nickname: string;
  avatar_url: string | null;
  points_per_race: number[];
}

export const isSprint = (race: SeasonRace) => race.race_type === 'sprint';

export const fullName = (race: SeasonRace, sprintWord = 'Sprint') =>
  isSprint(race) && !/sprint/i.test(race.name) ? `${race.name} – ${sprintWord}` : race.name;

// "R17" for a Grand Prix, "R17S" for the sprint of the same round. Uses the round number the
// server sends; a sprint row comes before its Grand Prix row, which is the fallback when it
// does not.
export const roundLabels = (races: SeasonRace[]): string[] => {
  let mains = 0;
  return races.map((race) => {
    const round = race.round ?? mains + 1;
    if (!isSprint(race)) mains += 1;
    return isSprint(race) ? `R${round}S` : `R${round}`;
  });
};

export const cumulative = (points: number[]): number[] => {
  const out: number[] = [];
  points.forEach((p, i) => out.push((out[i - 1] ?? 0) + p));
  return out;
};

export const totalOf = (user: SeasonUser) => user.points_per_race.reduce((a, b) => a + b, 0);

// Players ordered the way the standings are: total points, then nickname.
export const byStanding = (users: SeasonUser[]) =>
  [...users].sort((a, b) => totalOf(b) - totalOf(a) || a.nickname.localeCompare(b.nickname));
