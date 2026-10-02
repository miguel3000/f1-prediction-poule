import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../components/Banner';
import CircuitBackground from '../components/CircuitBackground';
import LogoMark from '../components/LogoMark';
import PredictionInterface from '../components/PredictionInterface';
import SprintPredictionInterface from '../components/SprintPredictionInterface';
import RaceTypeToggle from '../components/RaceTypeToggle';
import RaceWeekendBanner from '../components/RaceWeekendBanner';
import { getUpcomingRaces } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';

interface Race {
  id: number;
  race_name: string;
  circuit_name: string;
  country: string;
  race_date: string;
  qualifying_date: string | null;
  round: number;
  race_type: 'sprint' | 'main';
  status: 'upcoming' | 'provisional' | 'completed';
}

const Homepage = () => {
  const [upcomingRaces, setUpcomingRaces] = useState<Race[]>([]);
  const [activeTab, setActiveTab] = useState<'sprint' | 'main'>('main');
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLang();

  useEffect(() => {
    fetchUpcomingRaces();
  }, []);

  const fetchUpcomingRaces = async () => {
    try {
      const response = await getUpcomingRaces();
      const races = response.data;
      setUpcomingRaces(races);

      // Find sprint race for this round
      const sprint = races.find((r: Race) => r.race_type === 'sprint');

      // Default to sprint tab only if sprint exists and is still upcoming
      if (sprint && sprint.status === 'upcoming') {
        setActiveTab('sprint');
      } else {
        setActiveTab('main');
      }
    } catch (error) {
      console.error('Failed to fetch upcoming races:', error);
    } finally {
      setLoading(false);
    }
  };

  const sprintRace = upcomingRaces.find(r => r.race_type === 'sprint');
  const mainRace = upcomingRaces.find(r => r.race_type === 'main');
  const nextRace = upcomingRaces[0] || null;
  // Keep showing the sprint tab for the whole race weekend, even after the sprint's
  // results are synced — the backend already stops returning this round entirely
  // once the main race also completes, so this doesn't need its own status check.
  const hasSprint = !!sprintRace;

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" style={{ borderRadius: 0 }}></div>
        <p className="mt-4 text-white">{t('home.loadingNextRace')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <CircuitBackground circuitName={nextRace?.circuit_name} />
        <LogoMark className="h-16 sm:h-20 w-auto mx-auto mb-6" />
        <Banner
          nextRaceDate={mainRace ? new Date(mainRace.race_date) : (nextRace ? new Date(nextRace.race_date) : undefined)}
          nextRaceName={nextRace?.race_name}
          qualifyingDate={mainRace?.qualifying_date ? new Date(mainRace.qualifying_date) : undefined}
        />
        <div className="mt-12 max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/auth')}
            className="btn-f1-primary"
          >
            {t('home.loginRegister')}
          </button>
        </div>
      </div>
    );
  }

  if (!nextRace) {
    return (
      <div className="text-center py-16 max-w-2xl mx-auto">
        <div className="card-f1 p-12">
          <h2 className="text-2xl font-bold mb-4">{t('home.noUpcoming')}</h2>
          <p className="text-white">{t('home.noUpcomingText')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CircuitBackground circuitName={mainRace?.circuit_name ?? nextRace?.circuit_name} />

      {/* Sprint weekends get the sprint/main toggle; regular weekends get a
          plain venue/race-name banner instead, so this slot is never empty. */}
      {hasSprint ? (
        <RaceTypeToggle value={activeTab} onChange={setActiveTab} />
      ) : (
        <RaceWeekendBanner
          raceName={mainRace?.race_name ?? nextRace.race_name}
          venue={mainRace?.circuit_name ?? nextRace.circuit_name}
          round={mainRace?.round ?? nextRace.round}
        />
      )}

      <div className="mt-4">
        {hasSprint && activeTab === 'sprint' && sprintRace ? (
          <SprintPredictionInterface raceId={sprintRace.id} mainRaceId={mainRace?.id} raceDate={sprintRace.race_date} round={sprintRace.round} />
        ) : mainRace ? (
          <PredictionInterface raceId={mainRace.id} raceDate={mainRace.race_date} round={mainRace.round} />
        ) : (
          <div className="text-center py-8 text-white">{t('home.noRaceAvailable')}</div>
        )}
      </div>
    </div>
  );
};

export default Homepage;
