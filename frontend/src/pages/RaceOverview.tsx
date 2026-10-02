import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRaces, getRaceResults } from '../services/api';
import { formatNLDay, formatNLTime, formatNLDayTime } from '../utils/dateTime';

interface Race {
  id: number;
  season: number;
  round: number;
  race_name: string;
  circuit_name: string;
  country: string;
  race_date: string;
  qualifying_date: string | null;
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
        const statusOrder: { [key: string]: number } = { upcoming: 0, in_progress: 1, provisional: 2, completed: 2 };
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

    if (race.status === 'completed' || race.status === 'provisional') {
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

  // Status chips stay inside the brand palette: yellow = still to come,
  // white on navy = provisional, dark = done.
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-black/30 text-white';
      case 'provisional':
        return 'bg-white text-f1-blue-dark';
      default:
        return 'bg-f1-yellow-500 text-black';
    }
  };

  const isSprint = (race: Race) => race.race_type === 'sprint';

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto"></div>
        <p className="mt-4 text-white">Loading races...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">
        2026 Race Calendar
      </h1>
      <p className="text-center text-white text-xs mb-8">All times are Dutch time (Amsterdam).</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {races.map((race, index) => (
          <div
            key={race.id}
            onClick={() => handleRaceClick(race)}
            className={`cursor-pointer transition hover:brightness-110 ${
              selectedRace?.id === race.id ? 'ring-2 ring-f1-yellow-500' : ''
            } ${race.status === 'completed' || race.status === 'provisional' ? 'opacity-70' : ''}`}
          >
            <div className="flex items-stretch">
              <span className="w-14 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-lg">
                {race.round}
              </span>
              <div className={`flex-1 min-w-0 px-4 py-3 text-white ${index % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-f1 font-bold text-xl uppercase tracking-wide leading-tight break-words min-w-0">
                    {race.race_name}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider flex-shrink-0 ${getStatusColor(race.status)}`}>
                    {race.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[10px] text-white/70 uppercase tracking-wide truncate">
                  {race.circuit_name} &middot; {race.country}
                </p>

                <div className="mt-2 pt-2 border-t border-white/20 space-y-0.5">
                  {isSprint(race) ? (
                    <p className="flex items-center justify-between text-sm">
                      <span className="text-[10px] px-1.5 py-0.5 bg-f1-yellow-500 text-black font-bold uppercase tracking-wider">Sprint</span>
                      <span className="font-f1-badge text-xs">{formatNLDayTime(race.race_date)}</span>
                    </p>
                  ) : (
                    <>
                      {race.qualifying_date && (
                        <p className="flex items-center justify-between text-sm">
                          <span className="text-[10px] text-white/70 uppercase tracking-wider">Qualifying</span>
                          <span className="font-f1-badge text-xs">{formatNLDayTime(race.qualifying_date)}</span>
                        </p>
                      )}
                      <p className="flex items-center justify-between text-sm">
                        <span className="text-[10px] text-white/70 uppercase tracking-wider">Race start</span>
                        <span className="font-f1-badge text-xs text-f1-yellow-400">{formatNLDayTime(race.race_date)}</span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Race Details Modal */}
      {selectedRace && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRace(null)}>
          <div
            className="max-w-2xl w-full max-h-[80vh] overflow-y-auto bg-f1-neutral-850 border border-f1-neutral-700 p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-f1 font-bold uppercase tracking-wide text-3xl text-f1-yellow-500">
                    {selectedRace.race_name}
                  </h2>
                  {isSprint(selectedRace) && (
                    <span className="text-xs px-2 py-1 bg-f1-yellow-500 text-black font-bold uppercase tracking-wider">
                      Sprint
                    </span>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-2 uppercase tracking-wide">
                  Round {selectedRace.round} &middot; {selectedRace.circuit_name} &middot; {selectedRace.country}
                </p>
              </div>
              <button
                onClick={() => setSelectedRace(null)}
                className="text-white text-3xl leading-none hover:text-f1-yellow-500 flex-shrink-0"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="mb-6">
              {!isSprint(selectedRace) && selectedRace.qualifying_date && (
                <div className="flex items-center bg-f1-blue text-white">
                  <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">Qualifying</span>
                  <span className="px-4 py-2 font-f1-badge text-sm">
                    {formatNLDay(selectedRace.qualifying_date)} &middot; {formatNLTime(selectedRace.qualifying_date)}
                  </span>
                </div>
              )}
              <div className={`flex items-center text-white ${!isSprint(selectedRace) && selectedRace.qualifying_date ? 'bg-f1-blue-dark' : 'bg-f1-blue'}`}>
                <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">
                  {isSprint(selectedRace) ? 'Sprint start' : 'Race start'}
                </span>
                <span className="px-4 py-2 font-f1-badge text-sm text-f1-yellow-400">
                  {formatNLDay(selectedRace.race_date)} &middot; {formatNLTime(selectedRace.race_date)}
                </span>
              </div>
            </div>

            {(selectedRace.status === 'completed' || selectedRace.status === 'provisional') && (
              <div className="mt-6">
                <h3 className="font-f1 font-bold uppercase tracking-wide text-2xl mb-4">
                  {isSprint(selectedRace) ? 'Sprint Results' : 'Race Results'}
                  {selectedRace.status === 'provisional' && (
                    <span className="text-sm ml-2 text-f1-yellow-500">(Provisional)</span>
                  )}
                </h3>
                {loadingResults ? (
                  <p className="text-center text-white">Loading results...</p>
                ) : raceResults.length > 0 ? (
                  <div>
                    {raceResults.map((result, i) => (
                      <div key={result.position} className="flex items-stretch">
                        <span className="w-12 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-lg">
                          {result.position}
                        </span>
                        <div className={`flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-2 text-white ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                          <div className="min-w-0">
                            <p className="font-f1 font-bold uppercase tracking-wide truncate">{result.driver_name}</p>
                            <p className="text-[10px] text-white/70 uppercase tracking-wide truncate">{result.team}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-sm text-f1-yellow-400">{result.points} pts</p>
                            <p className="text-[10px] text-white/70">{result.status}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-white">No results available yet</p>
                )}
              </div>
            )}

            {selectedRace.status === 'upcoming' && (
              <div className="mt-6 text-center">
                <p className="text-white mb-4">
                  {isSprint(selectedRace) ? 'Sprint race' : 'Race'} has not started yet
                </p>
                <button onClick={() => navigate('/')} className="btn-f1-primary">
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
