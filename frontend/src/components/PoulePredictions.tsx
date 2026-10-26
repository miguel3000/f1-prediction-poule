import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { getRaces, getPoulePredictions, PoulePrediction, PoulePredictionsResponse } from '../services/api';

interface RaceRow {
  id: number;
  round: number;
  race_name: string;
  race_date: string;
  race_type: 'main' | 'sprint';
}

// The client only decides which races to offer; the server is the one that refuses a race that
// has not started (it answers 403), so a clock that is a little off never shows anything early.
const LOCK_MARGIN_MS = 60 * 1000;

const shortName = (driver: { name: string; name_acronym: string | null } | null): string => {
  if (!driver) return '–';
  if (driver.name_acronym) return driver.name_acronym;
  const last = driver.name.split(' ').pop() ?? driver.name;
  return last.slice(0, 3).toUpperCase();
};

interface PoulePredictionsProps {
  poule: string | undefined; // 'main', a group id, or undefined for the server's default
  meId?: number;
}

// "Predictions": everybody's picks for a race that has started, inside the poule being looked at.
const PoulePredictions = ({ poule, meId }: PoulePredictionsProps) => {
  const { t, tError } = useLang();
  const [races, setRaces] = useState<RaceRow[] | null>(null);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [data, setData] = useState<PoulePredictionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getRaces()
      .then((res) => {
        if (cancelled) return;
        const started = (res.data as RaceRow[])
          .filter((r) => new Date(r.race_date).getTime() - LOCK_MARGIN_MS <= Date.now())
          .sort((a, b) => new Date(b.race_date).getTime() - new Date(a.race_date).getTime());
        setRaces(started);
        setRaceId((current) => current ?? started[0]?.id ?? null);
      })
      .catch(() => { if (!cancelled) setRaces([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (raceId === null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getPoulePredictions(raceId, poule)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(tError(err?.response?.data?.error, 'groups.pred.failed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, poule, tError]);

  const label = (r: RaceRow) =>
    `R${r.round} ${r.race_name}${r.race_type === 'sprint' && !/sprint/i.test(r.race_name) ? ` – ${t('groups.pred.sprint')}` : ''}`;

  const slots = data?.race.race_type === 'sprint' ? 8 : 10;
  const showDnf = data?.race.race_type === 'main';
  const rows: PoulePrediction[] = useMemo(() => data?.predictions ?? [], [data]);

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-2 racing-stripe pl-6">{t('groups.pred.title')}</h2>
      <p className="text-sm text-white/80 mb-6">{t('groups.pred.hint')}</p>

      {races === null ? (
        <div className="bg-gray-900 p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
        </div>
      ) : races.length === 0 ? (
        <div className="card-f1 p-8 text-center text-white">{t('groups.pred.noRaces')}</div>
      ) : (
        <>
          <label htmlFor="poule-pred-race" className="block text-sm font-semibold mb-2">{t('groups.pred.race')}</label>
          <select
            id="poule-pred-race"
            value={raceId ?? ''}
            onChange={(e) => setRaceId(Number(e.target.value))}
            className="input-f1 w-full sm:w-auto sm:min-w-[20rem] mb-5"
          >
            {races.map((r) => (
              <option key={r.id} value={r.id}>{label(r)}</option>
            ))}
          </select>

          {error && (
            <div className="p-4 border-2 bg-red-900/30 border-red-500 text-red-400" role="alert">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {!error && loading && !data && (
            <div className="bg-gray-900 p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-f1-yellow-500"></div>
            </div>
          )}

          {!error && data && rows.length === 0 && (
            <div className="card-f1 p-8 text-center text-white">{t('groups.pred.none')}</div>
          )}

          {!error && data && rows.length > 0 && (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <p className="text-xs text-white/70 mb-2 sm:hidden">{t('groups.pred.scroll')}</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-white">
                  <thead>
                    <tr className="bg-f1-yellow-500 text-black text-[10px] uppercase tracking-wider">
                      <th scope="col" className="sticky left-0 z-10 bg-f1-yellow-500 text-left px-3 py-2 min-w-[8.5rem]">
                        {t('groups.pred.player')}
                      </th>
                      {Array.from({ length: slots }, (_, i) => (
                        <th key={i} scope="col" className="px-1.5 py-2 font-f1-badge text-center">P{i + 1}</th>
                      ))}
                      {showDnf && <th scope="col" className="px-2 py-2 text-center">DNF</th>}
                      <th scope="col" className="px-3 py-2 text-right">{t('races.pts')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const bg = i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark';
                      return (
                        <tr key={row.user.id} className={bg}>
                          <th
                            scope="row"
                            className={`sticky left-0 z-10 ${bg} text-left px-3 py-2 font-f1 font-bold uppercase tracking-wide text-sm max-w-[10rem] truncate ${
                              row.user.id === meId ? 'text-f1-yellow-400' : ''
                            }`}
                            title={row.user.nickname}
                          >
                            {row.user.nickname}
                          </th>
                          {row.picks.map((pick) => (
                            <td
                              key={pick.position}
                              className="px-1.5 py-2 text-center font-f1-badge text-xs tabular-nums"
                              title={pick.driver?.name}
                            >
                              {shortName(pick.driver)}
                            </td>
                          ))}
                          {showDnf && (
                            <td className="px-2 py-2 text-center font-f1-badge text-xs" title={row.dnf_pick?.name}>
                              {row.dnf_pick ? shortName(row.dnf_pick) : '–'}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-f1-badge font-bold text-f1-yellow-400 tabular-nums">
                            {row.points_earned ?? '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PoulePredictions;
