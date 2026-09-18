import { useState, useEffect } from 'react';
import { getLeaderboard, getSeasonHistory } from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface LeaderboardEntry {
  id: number;
  nickname: string;
  avatar_url?: string;
  total_points: number;
  rank: number;
  last_race_points: number;
  last_race_rank: number | null;
  best_race_points: number;
  best_race_name: string | null;
  diff_to_leader: number;
}

interface SeasonRace {
  id: number;
  name: string;
  country: string;
  date: string;
  race_type: string;
}

interface SeasonUser {
  id: number;
  nickname: string;
  avatar_url: string | null;
  points_per_race: number[];
}

const CHART_COLORS = [
  '#E10600', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1'
];

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getRankColor = (rank: number) => {
  if (rank === 1) return 'bg-yellow-500 text-black';
  if (rank === 2) return 'bg-gray-300 text-black';
  if (rank === 3) return 'bg-f1-yellow-500 text-black';
  return 'bg-gray-700 text-white';
};

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [seasonRaces, setSeasonRaces] = useState<SeasonRace[]>([]);
  const [seasonUsers, setSeasonUsers] = useState<SeasonUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    fetchSeasonHistory();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await getLeaderboard();
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasonHistory = async () => {
    try {
      const response = await getSeasonHistory();
      setSeasonRaces(response.data.races);
      setSeasonUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch season history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Build recharts data: one object per race with cumulative points per user
  const chartData = seasonRaces.map((race, raceIdx) => {
    const point: Record<string, string | number> = {
      race: race.country.length > 8 ? race.country.substring(0, 8) + '.' : race.country,
      fullName: race.name,
    };
    seasonUsers.forEach(user => {
      const cumulative = user.points_per_race.slice(0, raceIdx + 1).reduce((a, b) => a + b, 0);
      point[user.nickname] = cumulative;
    });
    return point;
  });

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto"></div>
        <p className="mt-4 text-f1-gray">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-f1-yellow-500">Championship</h1>

      {/* Season Points Chart */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">Season Progression</h2>

        {historyLoading ? (
          <div className="bg-gray-900 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
          </div>
        ) : seasonRaces.length === 0 ? (
          <div className="bg-gray-900 p-8 text-center text-f1-gray">
            Season data available after the first race is completed.
          </div>
        ) : (
          <div className="bg-gray-900 p-4 pt-6 border border-gray-800">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3a" />
                <XAxis
                  dataKey="race"
                  tick={{ fill: '#949498', fontSize: 11 }}
                  axisLine={{ stroke: '#444' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#949498', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: '#15151E', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }}
                  itemStyle={{ color: '#ccc', fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value} pts`, name]}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
                {seasonUsers.map((user, i) => (
                  <Line
                    key={user.id}
                    type="monotone"
                    dataKey={user.nickname}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">Full Standings</h2>

        {leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-f1-gray text-lg">No users have made predictions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div key={entry.id} className="flex items-stretch">
                {/* Rank badge — flat square, podium colors only */}
                <div
                  className={`w-14 shrink-0 flex items-center justify-center font-f1-badge font-bold text-2xl ${getRankColor(
                    Number(entry.rank)
                  )}`}
                >
                  {entry.rank}
                </div>

                {/* Name bar — big blue block, nickname as large as possible */}
                <div className="flex-1 min-w-0 bg-f1-blue flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.nickname}
                        className="w-9 h-9 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 shrink-0 bg-f1-blue-dark flex items-center justify-center text-sm">
                        👤
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-f1 font-bold text-white text-xl sm:text-2xl uppercase tracking-wide leading-tight truncate">
                        {entry.nickname}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-blue-100/70">
                        <span>
                          Last: {entry.last_race_points}
                          {entry.last_race_rank && ` (${ordinal(entry.last_race_rank)})`}
                        </span>
                        {entry.best_race_name && (
                          <span className="hidden md:inline">
                            Best: {entry.best_race_points} ({entry.best_race_name})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl sm:text-3xl font-f1-badge font-bold text-f1-yellow-400">{entry.total_points}</p>
                    <p className="text-[10px] text-blue-100/70 uppercase tracking-widest">
                      {Number(entry.rank) === 1 ? 'Leader' : `-${entry.diff_to_leader}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
