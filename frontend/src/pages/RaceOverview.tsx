import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRaces, getRaceResults } from '../services/api';

interface Race {
  id: number;
  season: number;
  round: number;
  race_name: string;
  circuit_name: string;
  country: string;
  race_date: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'provisional';
  race_type: 'sprint' | 'main';
}

interface RaceResult {
  position: number;
  driver_name: string;
  team: string;
  points: number;
  status: string;
}

const RaceOverview = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await getRaces(2026);

      // Sort races: upcoming first, then in_progress, then completed
      // Within each status group, maintain chronological order
      const sortedRaces = [...response.data].sort((a, b) => {
        const statusOrder: { [key: string]: number } = { upcoming: 0, in_progress: 1, completed: 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];

        if (statusDiff !== 0) {
          return statusDiff;
        }

        // Within same status, sort by date
        return new Date(a.race_date).getTime() - new Date(b.race_date).getTime();
      });

      setRaces(sortedRaces);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRaceClick = async (race: Race) => {
    setSelectedRace(race);

    if (race.status === 'completed') {
      setLoadingResults(true);
      try {
        const response = await getRaceResults(race.id);
        setRaceResults(response.data);
      } catch (error) {
        console.error('Failed to fetch race results:', error);
      } finally {
        setLoadingResults(false);
      }
    } else {
      setRaceResults([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'provisional':
        return 'bg-blue-600';
      case 'in_progress':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  const isSprint = (race: Race) => race.race_type === 'sprint';

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-pink-500 mx-auto"></div>
        <p className="mt-4 text-f1-gray">Loading races...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8 text-center">2026 Race Calendar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {races.map((race) => (
          <div
            key={race.id}
            onClick={() => handleRaceClick(race)}
            className={`rounded-lg p-6 cursor-pointer transition-all transform hover:scale-105 ${
              isSprint(race)
                ? 'bg-f1-pink-900/20 border border-f1-pink-500/50 hover:bg-f1-pink-400/50'
                : 'bg-gray-800 hover:bg-gray-700'
            } ${
              selectedRace?.id === race.id
                ? isSprint(race) ? 'ring-2 ring-f1-pink-500' : 'ring-2 ring-f1-pink-500'
                : ''
            } ${
              race.status === 'completed' || race.status === 'provisional' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">Round {race.round}</h3>
                {isSprint(race) && (
                  <span className="text-xs px-2 py-0.5 rounded bg-f1-pink-500 text-white font-bold">
                    SPRINT
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(race.status)}`}>
                {race.status.toUpperCase()}
              </span>
            </div>

            <h4 className={`text-lg font-semibold mb-2 ${isSprint(race) ? 'text-f1-pink-400' : 'text-f1-pink-500'}`}>
              {race.race_name}
            </h4>
            <p className="text-sm text-f1-gray mb-1">📍 {race.circuit_name}</p>
            <p className="text-sm text-f1-gray mb-3">🌍 {race.country}</p>
            <p className="text-sm">
              🗓️ {new Date(race.race_date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        ))}
      </div>

      {/* Race Details Modal */}
      {selectedRace && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 ${
            isSprint(selectedRace) ? 'bg-gray-800 border-2 border-f1-pink-500/50' : 'bg-gray-800'
          }`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className={`text-3xl font-bold ${isSprint(selectedRace) ? 'text-f1-pink-400' : 'text-f1-pink-500'}`}>
                    {selectedRace.race_name}
                  </h2>
                  {isSprint(selectedRace) && (
                    <span className="text-sm px-3 py-1 rounded bg-f1-pink-500 text-white font-bold">
                      SPRINT
                    </span>
                  )}
                </div>
                <p className="text-f1-gray mt-2">
                  Round {selectedRace.round} • {selectedRace.circuit_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedRace(null)}
                className={`text-white text-3xl ${isSprint(selectedRace) ? 'hover:text-f1-pink-400' : 'hover:text-f1-pink-500'}`}
              >
                ×
              </button>
            </div>

            {(selectedRace.status === 'completed' || selectedRace.status === 'provisional') && (
              <div className="mt-6">
                <h3 className="text-2xl font-bold mb-4">
                  {isSprint(selectedRace) ? 'Sprint Results' : 'Race Results'}
                  {selectedRace.status === 'provisional' && (
                    <span className="text-sm ml-2 text-blue-400">(Provisional)</span>
                  )}
                </h3>
                {loadingResults ? (
                  <p className="text-center text-f1-gray">Loading results...</p>
                ) : raceResults.length > 0 ? (
                  <div className="space-y-2">
                    {raceResults.map((result) => (
                      <div
                        key={result.position}
                        className="flex items-center justify-between bg-gray-900 p-4 rounded"
                      >
                        <div className="flex items-center gap-4">
                          <span className={`text-2xl font-bold w-8 ${isSprint(selectedRace) ? 'text-f1-pink-400' : 'text-f1-pink-500'}`}>
                            {result.position}
                          </span>
                          <div>
                            <p className="font-semibold">{result.driver_name}</p>
                            <p className="text-sm text-f1-gray">{result.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{result.points} pts</p>
                          <p className="text-xs text-f1-gray">{result.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-f1-gray">No results available yet</p>
                )}
              </div>
            )}

            {selectedRace.status === 'upcoming' && (
              <div className="mt-6 text-center">
                <p className="text-f1-gray mb-4">
                  {isSprint(selectedRace) ? 'Sprint race' : 'Race'} has not started yet
                </p>
                <button
                  onClick={() => navigate('/')}
                  className={`text-white px-6 py-3 rounded-lg font-bold ${
                    isSprint(selectedRace)
                      ? 'bg-f1-pink-500 hover:bg-f1-pink-500'
                      : 'bg-f1-pink-500 hover:bg-f1-pink-600'
                  }`}
                >
                  Make Your {isSprint(selectedRace) ? 'Sprint ' : ''}Prediction
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceOverview;
