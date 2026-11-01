import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSeasons } from '../services/api';

// Which season the pages show. It starts on the season the app is in (the server says which) and
// the player can switch to an older one; the choice is kept while they move between pages.
// Pages wait for `ready` before they fetch, so they never ask for the wrong season first.
interface SeasonState {
  season: number;
  active: number;
  seasons: number[];
  ready: boolean;
  setSeason: (season: number) => void;
}

const thisYear = new Date().getFullYear();
const SeasonContext = createContext<SeasonState>({
  season: thisYear,
  active: thisYear,
  seasons: [thisYear],
  ready: true,
  setSeason: () => undefined,
});

export const SeasonProvider = ({ token, children }: { token: string | null; children: ReactNode }) => {
  const [active, setActive] = useState(thisYear);
  const [seasons, setSeasons] = useState<number[]>([thisYear]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [ready, setReady] = useState(!token);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    setReady(false); // a login: ask again before the pages fetch
    getSeasons()
      .then((res) => {
        setActive(res.data.active);
        setSeasons(res.data.seasons.length > 0 ? res.data.seasons : [res.data.active]);
      })
      // Without the list the pages still work on the calendar year.
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [token]);

  const season = chosen !== null && seasons.includes(chosen) ? chosen : active;

  return (
    <SeasonContext.Provider value={{ season, active, seasons, ready, setSeason: setChosen }}>
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => useContext(SeasonContext);
