import { useState, useEffect } from 'react';
import { getDriverStandings } from '../services/api';

interface Driver {
  id: number;
  driver_number: number;
  name: string;
  team: string;
  nationality?: string;
  total_points: number;
}

const DriverStandings = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverStandings();
  }, []);

  const fetchDriverStandings = async () => {
    try {
      const response = await getDriverStandings(2026);
      setDrivers(response.data.drivers || response.data);
      setLastUpdated(response.data.lastUpdated || null);
    } catch (error) {
      console.error('Failed to fetch driver standings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextUpdateTime = (): Date => {
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday
    const currentHour = now.getUTCHours();

    let daysUntilNext = 0;

    // Sync happens on Monday (1) and Thursday (4) at 9:00 AM UTC
    if (currentDay === 1 && currentHour < 9) {
      // Today is Monday before 9 AM
      daysUntilNext = 0;
    } else if (currentDay < 4 || (currentDay === 4 && currentHour < 9)) {
      // Before Thursday or Thursday before 9 AM
      daysUntilNext = 4 - currentDay;
    } else {
      // After Thursday 9 AM, next is Monday
      daysUntilNext = (8 - currentDay) % 7;
    }

    const nextUpdate = new Date(now);
    nextUpdate.setUTCDate(now.getUTCDate() + daysUntilNext);
    nextUpdate.setUTCHours(9, 0, 0, 0);

    return nextUpdate;
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const formatNextUpdate = (): string => {
    const nextUpdate = getNextUpdateTime();
    return nextUpdate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'bg-yellow-500 text-black';
    if (position === 2) return 'bg-gray-300 text-black';
    if (position === 3) return 'bg-f1-pink-500 text-white';
    return 'bg-gray-700 text-white';
  };

  const getFlagEmoji = (nationality: string | undefined): string => {
    if (!nationality) return '';

    const flagMap: Record<string, string> = {
      'British': '🇬🇧',
      'Dutch': '🇳🇱',
      'Australian': '🇦🇺',
      'Monegasque': '🇲🇨',
      'Italian': '🇮🇹',
      'Thai': '🇹🇭',
      'German': '🇩🇪',
      'French': '🇫🇷',
      'Spanish': '🇪🇸',
      'Canadian': '🇨🇦',
      'Mexican': '🇲🇽',
      'Finnish': '🇫🇮',
      'Danish': '🇩🇰',
      'Japanese': '🇯🇵',
      'Chinese': '🇨🇳',
      'American': '🇺🇸',
      'Brazilian': '🇧🇷',
      'Argentine': '🇦🇷',
      'New Zealander': '🇳🇿',
    };

    return flagMap[nationality] || '🏁';
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-pink-500 mx-auto"></div>
        <p className="mt-4 text-f1-gray">Loading driver standings...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl md:text-display-xl font-bold mb-4 text-center text-gradient-red">
        2026 Driver's Championship
      </h1>

      {/* Update Information - Compact */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="text-center text-sm text-f1-gray">
          Updated: <span className="text-white">{formatDateTime(lastUpdated)}</span>
          <span className="mx-2">•</span>
          Next: <span className="text-white">{formatNextUpdate()}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {drivers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-f1-gray text-lg">No driver standings available yet</p>
            <p className="text-sm text-f1-gray mt-2">
              Standings will be updated after the first race
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map((driver, index) => {
              const position = index + 1;
              return (
                <div
                  key={driver.id}
                  className="card-f1-interactive p-4 flex items-center gap-4"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${getPositionColor(
                      position
                    )}`}
                  >
                    {position}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-f1-pink-500 font-bold text-sm">#{driver.driver_number}</span>
                      <h3 className="text-lg font-bold">{driver.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-f1-gray">{driver.team}</p>
                      {driver.nationality && (
                        <span className="flex items-center gap-1 text-sm bg-f1-neutral-800 px-2 py-0.5 rounded">
                          <span>{getFlagEmoji(driver.nationality)}</span>
                          <span className="text-f1-gray">{driver.nationality}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold">{driver.total_points}</p>
                    <p className="text-xs text-f1-gray">POINTS</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverStandings;
