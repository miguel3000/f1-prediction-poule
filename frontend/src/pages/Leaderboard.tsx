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
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-pink-500 mx-auto"></div>
        <p className="mt-4 text-f1-gray">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-gradient-red">Championship</h1>

      {/* Season Points Chart */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-2xl font-bold mb-6 racing-stripe pl-6">Season Progression</h2>

        {historyLoading ? (
          <div className="bg-gray-900 rounded-lg p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-pink-500"></div>
          </div>
        ) : seasonRaces.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center text-f1-gray">
            Season data available after the first race is completed.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-4 pt-6 border border-gray-800">
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
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-800 text-f1-gray text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Total Points</th>
                  <th className="px-4 py-3 text-right">Last Race</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Most Points (Race)</th>
                  <th className="px-4 py-3 text-right">Diff to Leader</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-t border-gray-700 ${
                      Number(entry.rank) % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/50'
                    } ${Number(entry.rank) <= 3 ? 'font-semibold' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        Number(entry.rank) === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-gray-900' :
                        Number(entry.rank) === 2 ? 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-900' :
                        Number(entry.rank) === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'text-f1-gray'
                      }`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {entry.avatar_url ? (
                          <img
                            src={entry.avatar_url}
                            alt={entry.nickname}
                            className="w-8 h-8 rounded-full border border-gray-600 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-f1-neutral-700 flex items-center justify-center border border-gray-600 text-sm">
                            👤
                          </div>
                        )}
                        <span className="text-white">{entry.nickname}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-f1-pink-500 font-bold text-lg">{entry.total_points}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white">{entry.last_race_points}</span>
                      {entry.last_race_rank && (
                        <span className="text-f1-gray text-xs ml-1">({ordinal(entry.last_race_rank)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-white">{entry.best_race_points}</span>
                      {entry.best_race_name && (
                        <span className="text-f1-gray text-xs ml-1">({entry.best_race_name})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(entry.rank) === 1 ? (
                        <span className="text-yellow-400 font-bold text-xs">LEADER</span>
                      ) : (
                        <span className="text-f1-gray">-{entry.diff_to_leader}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
