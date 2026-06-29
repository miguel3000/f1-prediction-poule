import { useState, useEffect } from 'react';
import {
  getCompletedRaces,
  getSeasonStats,
  getPracticeResults,
  getQualifyingResultsStats,
  getRaceResultsStats,
  getSprintResultsStats
} from '../services/api';

interface Race {
  id: number;
  round: number;
  race_name: string;
  circuit_name: string;
  country: string;
  race_date: string;
  race_type: 'sprint' | 'main';
  status: string;
}

interface SessionResult {
  position: number;
  driverNumber: string;
  driverName: string;
  driverCode: string;
  team: string;
  time?: string | null;
  laps?: number;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  points?: number;
  status?: string;
  fastestLap?: string | null;
  fastestLapRank?: number | null;
}

interface SeasonStats {
  races: {
    completed_races: number;
    upcoming_races: number;
    completed_sprints: number;
    upcoming_sprints: number;
  };
  topScorers: Array<{ nickname: string; total_points: number }>;
  predictions: {
    main_predictions: number;
    sprint_predictions: number;
  };
}

type SessionType = 'fp1' | 'fp2' | 'fp3' | 'qualifying' | 'sprint' | 'race';

const Stats = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionType>('race');
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [racesRes, statsRes] = await Promise.all([
        getCompletedRaces(2026),
        getSeasonStats(2026)
      ]);
      setRaces(racesRes.data);
      setSeasonStats(statsRes.data);

      // Auto-select the most recent completed main race
      const mainRaces = racesRes.data.filter((r: Race) => r.race_type === 'main');
      if (mainRaces.length > 0) {
        setSelectedRound(mainRaces[mainRaces.length - 1].round);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRound !== null) {
      fetchSessionResults();
    }
  }, [selectedRound, selectedSession]);

  const fetchSessionResults = async () => {
    if (selectedRound === null) return;

    setLoadingSession(true);
    try {
      let response;
      switch (selectedSession) {
        case 'fp1':
          response = await getPracticeResults(selectedRound, 1, 2026);
          break;
        case 'fp2':
          response = await getPracticeResults(selectedRound, 2, 2026);
          break;
        case 'fp3':
          response = await getPracticeResults(selectedRound, 3, 2026);
          break;
        case 'qualifying':
          response = await getQualifyingResultsStats(selectedRound, 2026);
          break;
        case 'sprint':
          response = await getSprintResultsStats(selectedRound, 2026);
          break;
        case 'race':
        default:
          response = await getRaceResultsStats(selectedRound, 2026);
          break;
      }
      setSessionResults(response.data);
    } catch (error) {
      console.error('Failed to fetch session results:', error);
      setSessionResults([]);
    } finally {
      setLoadingSession(false);
    }
  };

  const getSelectedRace = () => {
    return races.find(r => r.round === selectedRound && r.race_type === 'main');
  };

  const hasSprintRound = (round: number) => {
    return races.some(r => r.round === round && r.race_type === 'sprint');
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'bg-yellow-500 text-black';
    if (position === 2) return 'bg-gray-300 text-black';
    if (position === 3) return 'bg-f1-pink-500 text-white';
    return 'bg-gray-700 text-white';
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-pink-500 mx-auto"></div>
        <p className="mt-4 text-f1-gray">Loading statistics...</p>
      </div>
    );
  }

  const uniqueRounds = [...new Set(races.filter(r => r.race_type === 'main').map(r => r.round))];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center text-gradient-red">
        2026 Season Statistics
      </h1>

      {/* Season Summary */}
      {seasonStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-f1-pink-500">{seasonStats.races.completed_races}</p>
            <p className="text-sm text-f1-gray">Races Completed</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-f1-pink-500">{seasonStats.races.completed_sprints}</p>
            <p className="text-sm text-f1-gray">Sprints Completed</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{seasonStats.predictions.main_predictions}</p>
            <p className="text-sm text-f1-gray">Race Predictions</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{seasonStats.predictions.sprint_predictions}</p>
            <p className="text-sm text-f1-gray">Sprint Predictions</p>
          </div>
        </div>
      )}

      {/* Race Selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-f1-gray mb-2">Select Race</label>
        <select
          value={selectedRound || ''}
          onChange={(e) => setSelectedRound(parseInt(e.target.value))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-f1-pink-500 focus:outline-none"
        >
          {uniqueRounds.map(round => {
            const race = races.find(r => r.round === round && r.race_type === 'main');
            return (
              <option key={round} value={round}>
                Round {round}: {race?.race_name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Session Tabs */}
      {selectedRound && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {['fp1', 'fp2', 'fp3', 'qualifying', ...(hasSprintRound(selectedRound) ? ['sprint'] : []), 'race'].map((session) => (
              <button
                key={session}
                onClick={() => setSelectedSession(session as SessionType)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  selectedSession === session
                    ? session === 'sprint'
                      ? 'bg-f1-pink-500 text-white'
                      : session === 'race'
                      ? 'bg-f1-pink-500 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {session === 'fp1' && 'FP1'}
                {session === 'fp2' && 'FP2'}
                {session === 'fp3' && 'FP3'}
                {session === 'qualifying' && 'Qualifying'}
                {session === 'sprint' && 'Sprint'}
                {session === 'race' && 'Race'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session Results */}
      {selectedRound && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">
              {getSelectedRace()?.race_name} - {selectedSession.toUpperCase()}
            </h2>
          </div>

          {loadingSession ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-f1-pink-500 mx-auto"></div>
              <p className="mt-2 text-f1-gray">Loading results...</p>
            </div>
          ) : sessionResults.length === 0 ? (
            <div className="p-8 text-center text-f1-gray">
              No results available for this session
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Pos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Team</th>
                    {selectedSession === 'qualifying' ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Q1</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Q2</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Q3</th>
                      </>
                    ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Points</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-f1-gray uppercase">Laps</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sessionResults.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getPositionColor(result.position)}`}>
                          {result.position}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-f1-pink-500 font-bold">#{result.driverNumber}</span>
                          <span className="font-semibold">{result.driverName}</span>
                          <span className="text-xs text-f1-gray">({result.driverCode})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-f1-gray">{result.team}</td>
                      {selectedSession === 'qualifying' ? (
                        <>
                          <td className="px-4 py-3 font-mono text-sm">{result.q1 || '-'}</td>
                          <td className="px-4 py-3 font-mono text-sm">{result.q2 || '-'}</td>
                          <td className="px-4 py-3 font-mono text-sm text-f1-pink-500 font-bold">{result.q3 || '-'}</td>
                        </>
                      ) : selectedSession === 'race' || selectedSession === 'sprint' ? (
                        <>
                          <td className="px-4 py-3 font-mono text-sm">{result.time || '-'}</td>
                          <td className="px-4 py-3 font-bold">{result.points}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              result.status === 'Finished' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-sm">{result.time || 'No time'}</td>
                          <td className="px-4 py-3">{result.laps}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Coming Soon - More Stats */}
      <div className="mt-8 bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-8 text-center">
        <h3 className="text-xl font-bold text-f1-gray mb-2">More Statistics Coming Soon</h3>
        <p className="text-f1-gray text-sm mb-4">
          We're working on adding more detailed statistics including:
        </p>
        <ul className="text-f1-gray text-sm space-y-1">
          <li>• Driver head-to-head comparisons</li>
          <li>• Prediction accuracy trends</li>
          <li>• Team performance analysis</li>
          <li>• Lap time comparisons</li>
          <li>• Points progression charts</li>
        </ul>
      </div>
    </div>
  );
};

export default Stats;
