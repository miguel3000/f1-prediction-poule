import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserPredictions, getUserSprintPredictions } from '../services/api';
import { AuthContext } from '../context/AuthContext';

interface Driver {
  id: number;
  name: string;
  team: string;
  driver_number: number;
}

interface Prediction {
  id: number;
  race_id: number;
  race_name: string;
  race_date: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  positions: Driver[];
  points?: number;
  race_type?: 'sprint' | 'main';
}

const MyPredictions = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchPredictions();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPredictions = async () => {
    try {
      // Fetch both main and sprint predictions
      const [mainResponse, sprintResponse] = await Promise.all([
        getUserPredictions(),
        getUserSprintPredictions()
      ]);

      // Add race_type to each prediction
      const mainPredictions = mainResponse.data.map((p: Prediction) => ({ ...p, race_type: 'main' as const }));
      const sprintPredictions = sprintResponse.data.map((p: Prediction) => ({ ...p, race_type: 'sprint' as const }));

      // Combine and sort by date (newest first)
      const allPredictions = [...mainPredictions, ...sprintPredictions].sort(
        (a, b) => new Date(b.race_date).getTime() - new Date(a.race_date).getTime()
      );

      setPredictions(allPredictions);
    } catch (error: any) {
      console.error('Failed to fetch predictions:', error);
      setError('Failed to load your predictions');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 text-gradient-red">My Predictions</h1>
          <p className="text-f1-gray mb-8 text-lg">
            Please log in to view your predictions
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="btn-f1-primary"
          >
            Login / Register
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-red-500 mx-auto shadow-f1-glow"></div>
        <p className="mt-4 text-f1-gray">Loading your predictions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="card-f1 p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Error</h2>
          <p className="text-f1-gray">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-f1-primary mt-6"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="card-f1 p-12 max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 text-gradient-red">My Predictions</h1>
          <p className="text-f1-gray mb-8 text-lg">
            You haven't made any predictions yet
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-f1-primary"
          >
            Make Your First Prediction
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-green-600 text-white font-semibold">
            COMPLETED
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-yellow-600 text-white font-semibold">
            IN PROGRESS
          </span>
        );
      default:
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-gray-600 text-white font-semibold">
            UPCOMING
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl md:text-display-xl font-bold text-gradient-red">
          My Predictions
        </h1>
      </div>

      <div className="space-y-6">
        {predictions.map((prediction) => {
          const isSprint = prediction.race_type === 'sprint';
          return (
            <div
              key={`${prediction.race_type}-${prediction.id}`}
              className={`p-6 rounded-lg transition-all ${
                isSprint
                  ? 'bg-orange-900/20 border border-orange-500/50 hover:bg-orange-900/30'
                  : 'card-f1 hover:shadow-f1-glow'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className={`text-2xl font-bold ${isSprint ? 'text-orange-400' : 'text-f1-red-500'}`}>
                      {prediction.race_name}
                    </h2>
                    {isSprint && (
                      <span className="text-xs px-2 py-1 rounded bg-orange-600 text-white font-bold">
                        SPRINT
                      </span>
                    )}
                  </div>
                  <p className="text-f1-gray">
                    {new Date(prediction.race_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(prediction.status)}
                  {prediction.points !== undefined && (
                    <div className={`text-2xl font-bold ${isSprint ? 'text-orange-400' : 'text-f1-red-500'}`}>
                      {prediction.points} pts
                    </div>
                  )}
                </div>
              </div>

              <div className={`grid gap-3 ${isSprint ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'}`}>
                {prediction.positions.map((driver, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      isSprint
                        ? 'bg-orange-900/30 border-orange-500/30'
                        : 'bg-f1-neutral-800 border-f1-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isSprint ? 'text-orange-400' : 'text-f1-red-500'}`}>
                        P{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{driver.name}</p>
                        <p className="text-xs text-f1-gray truncate">{driver.team}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {prediction.status === 'upcoming' && (
                <div className="mt-4 pt-4 border-t border-f1-neutral-700">
                  <button
                    onClick={() => navigate('/')}
                    className={`w-full py-3 rounded-lg font-bold transition-colors ${
                      isSprint
                        ? 'bg-orange-600 hover:bg-orange-500 text-white'
                        : 'btn-f1-primary'
                    }`}
                  >
                    Edit {isSprint ? 'Sprint ' : ''}Prediction
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPredictions;
