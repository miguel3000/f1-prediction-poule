import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRaces, getRaceResults, getRaceWeekends, WeekendSession } from '../services/api';
import WeekendBars from '../components/WeekendBars';
import WeekendSummary from '../components/WeekendSummary';
import { formatNLDay, formatNLTime, formatNLDayTime } from '../utils/dateTime';
import { useLang, TranslationKey } from '../i18n/LanguageContext';

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
  // Every round's sessions, fetched once; the cards and the popup both read from it.
  const [weekends, setWeekends] = useState<Record<string, WeekendSession[]>>({});
  const [weekendsState, setWeekendsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const navigate = useNavigate();
  const { t, locale } = useLang();

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

  // The full weekend schedule is a bonus on top of the qualifying and race times each
  // race already has, so if it cannot be loaded the cards and popup simply show those.
  useEffect(() => {
    getRaceWeekends(2026)
      .then((res) => {
        setWeekends(res.data.weekends);
        setWeekendsState(Object.keys(res.data.weekends).length > 0 ? 'ready' : 'failed');
      })
      .catch(() => setWeekendsState('failed'));
  }, []);

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

  // The next race weekend: the first race still to come, shown as its main race
  // (on a sprint weekend the sprint is the earlier card, but the weekend is one event).
  const firstUpcoming = races.find((r) => r.status === 'upcoming');
  const nextRace = firstUpcoming
    ? (races.find((r) => r.status === 'upcoming' && r.round === firstUpcoming.round && r.race_type === 'main') ?? firstUpcoming)
    : null;
  // A sprint weekend has two predictions to make, as long as the sprint is still to come
  const nextSprintOpen = nextRace
    ? races.some((r) => r.round === nextRace.round && r.race_type === 'sprint' && r.status === 'upcoming')
    : false;

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto"></div>
        <p className="mt-4 text-white">{t('races.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">
        {t('races.title', { year: 2026 })}
      </h1>
      <p className="text-center text-white text-xs mb-8">{t('races.timesNote')}</p>

      {nextRace && (
        <section aria-label={t('races.nextRace')} className="max-w-3xl mx-auto mb-10 bg-f1-neutral-850 border border-f1-neutral-700 p-5 sm:p-6">
          <p className="font-brand uppercase tracking-widest text-f1-yellow-500 text-sm">{t('races.nextRace')}</p>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h2 className="font-f1 font-bold uppercase tracking-wide text-2xl sm:text-3xl text-white">{nextRace.race_name}</h2>
            {weekends[nextRace.round]?.some((s) => s.key === 'sprint') && (
              <span className="text-xs px-2 py-1 bg-f1-yellow-500 text-black font-bold uppercase tracking-wider">{t('races.sprint')}</span>
            )}
          </div>
          <p className="text-white/70 text-sm mt-1 mb-4 uppercase tracking-wide">
            {t('banner.round', { n: nextRace.round })} &middot; {nextRace.circuit_name} &middot; {nextRace.country}
          </p>
          {weekends[nextRace.round]?.length ? (
            <WeekendBars sessions={weekends[nextRace.round]} showNote={false} />
          ) : weekendsState === 'loading' ? (
            <div style={{ minHeight: 120 }} />
          ) : (
            <div>
              {nextRace.qualifying_date && (
                <div className="flex items-center bg-f1-blue text-white">
                  <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">{t('races.qualifying')}</span>
                  <span className="px-4 py-2 font-f1-badge text-sm">{formatNLDayTime(nextRace.qualifying_date, locale)}</span>
                </div>
              )}
              <div className="flex items-center bg-f1-blue-dark text-white">
                <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">{t('races.raceStart')}</span>
                <span className="px-4 py-2 font-f1-badge text-sm text-f1-yellow-400">{formatNLDayTime(nextRace.race_date, locale)}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            {nextSprintOpen && (
              <button onClick={() => navigate('/?type=sprint')} className="btn-f1-primary flex-1">
                {t('races.makeSprintPrediction')}
              </button>
            )}
            <button
              onClick={() => navigate('/?type=main')}
              className={`${nextSprintOpen ? 'btn-f1-secondary' : 'btn-f1-primary'} flex-1`}
            >
              {t('races.makePrediction')}
            </button>
          </div>
        </section>
      )}

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
                    {t(`status.${race.status}` as TranslationKey)}
                  </span>
                </div>
                <p className="text-[10px] text-white/70 uppercase tracking-wide truncate">
                  {race.circuit_name} &middot; {race.country}
                </p>

                <div className="mt-2 pt-2 border-t border-white/20 space-y-0.5">
                  {isSprint(race) ? (
                    <p className="flex items-center justify-between text-sm">
                      <span className="text-[10px] px-1.5 py-0.5 bg-f1-yellow-500 text-black font-bold uppercase tracking-wider">{t('races.sprint')}</span>
                      <span className="font-f1-badge text-xs">{formatNLDayTime(race.race_date, locale)}</span>
                    </p>
                  ) : weekends[race.round]?.length ? (
                    <WeekendSummary sessions={weekends[race.round]} />
                  ) : (
                    <>
                      {race.qualifying_date && (
                        <p className="flex items-center justify-between text-sm">
                          <span className="text-[10px] text-white/70 uppercase tracking-wider">{t('races.qualifying')}</span>
                          <span className="font-f1-badge text-xs">{formatNLDayTime(race.qualifying_date, locale)}</span>
                        </p>
                      )}
                      <p className="flex items-center justify-between text-sm">
                        <span className="text-[10px] text-white/70 uppercase tracking-wider">{t('races.raceStart')}</span>
                        <span className="font-f1-badge text-xs text-f1-yellow-400">{formatNLDayTime(race.race_date, locale)}</span>
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
                  {t('banner.round', { n: selectedRace.round })} &middot; {selectedRace.circuit_name} &middot; {selectedRace.country}
                </p>
              </div>
              <button
                onClick={() => setSelectedRace(null)}
                className="text-white text-3xl leading-none hover:text-f1-yellow-500 flex-shrink-0"
                aria-label={t('races.close')}
              >
                &times;
              </button>
            </div>

            {weekendsState === 'loading' || weekends[selectedRace.round]?.length ? (
              <div className="mb-6" style={{ minHeight: weekendsState === 'loading' ? 120 : undefined }}>
                {weekends[selectedRace.round]?.length ? <WeekendBars sessions={weekends[selectedRace.round]} /> : null}
              </div>
            ) : (
            <div className="mb-6">
              {!isSprint(selectedRace) && selectedRace.qualifying_date && (
                <div className="flex items-center bg-f1-blue text-white">
                  <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">{t('races.qualifying')}</span>
                  <span className="px-4 py-2 font-f1-badge text-sm">
                    {formatNLDay(selectedRace.qualifying_date, locale)} &middot; {formatNLTime(selectedRace.qualifying_date, locale)}
                  </span>
                </div>
              )}
              <div className={`flex items-center text-white ${!isSprint(selectedRace) && selectedRace.qualifying_date ? 'bg-f1-blue-dark' : 'bg-f1-blue'}`}>
                <span className="w-40 shrink-0 px-4 py-2 text-xs uppercase tracking-wider text-white/80">
                  {isSprint(selectedRace) ? t('races.sprintStart') : t('races.raceStart')}
                </span>
                <span className="px-4 py-2 font-f1-badge text-sm text-f1-yellow-400">
                  {formatNLDay(selectedRace.race_date, locale)} &middot; {formatNLTime(selectedRace.race_date, locale)}
                </span>
              </div>
            </div>
            )}

            {(selectedRace.status === 'completed' || selectedRace.status === 'provisional') && (
              <div className="mt-6">
                <h3 className="font-f1 font-bold uppercase tracking-wide text-2xl mb-4">
                  {isSprint(selectedRace) ? t('races.sprintResults') : t('races.raceResults')}
                  {selectedRace.status === 'provisional' && (
                    <span className="text-sm ml-2 text-f1-yellow-500">{t('races.provisional')}</span>
                  )}
                </h3>
                {loadingResults ? (
                  <p className="text-center text-white">{t('races.loadingResults')}</p>
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
                            <p className="font-bold text-sm text-f1-yellow-400">{result.points} {t('races.pts')}</p>
                            <p className="text-[10px] text-white/70">{result.status}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-white">{t('races.noResults')}</p>
                )}
              </div>
            )}

            {selectedRace.status === 'upcoming' && (
              <div className="mt-6 text-center">
                <p className="text-white mb-4">
                  {isSprint(selectedRace) ? t('races.sprintNotStarted') : t('races.raceNotStarted')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => navigate(`/?type=${selectedRace.race_type}`)} className="btn-f1-primary">
                    {isSprint(selectedRace) ? t('races.makeSprintPrediction') : t('races.makePrediction')}
                  </button>
                  <button onClick={() => navigate(`/stats?round=${selectedRace.round}`)} className="btn-f1-secondary">
                    {t('races.practiceLink')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceOverview;
