import { useState, useRef, useEffect, useContext } from 'react';
import api from '../services/api';
import { getRaces } from '../services/api';
import { AuthContext } from '../context/AuthContext';

interface User {
  id: number;
  nickname: string;
  email: string;
  avatar_url?: string;
  total_points: number;
  is_admin?: boolean;
  pitwall_access?: boolean;
  created_at: string;
}

interface PitwallIdea {
  id: number;
  kind: 'idea' | 'implementation';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'declined';
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
  nickname: string;
}

interface SyncJobState {
  lastRun: string | null;
  lastStatus: 'success' | 'error' | 'running' | null;
  lastMessage: string | null;
  isRunning: boolean;
}

interface RaceOption {
  id: number;
  round: number;
  race_name: string;
  race_type: 'main' | 'sprint';
}

interface PredictionStatusUser {
  id: number;
  nickname: string;
  email: string;
  hasPredicted: boolean;
}

interface DiagnosisResult {
  pendingSync: Array<{ id: number; round: number; race_name: string; race_type: string; status: string; race_date: string }>;
  syncedRaces: Array<{ id: number; round: number; race_name: string; race_type: string; status: string; main_result_count: number; sprint_result_count: number }>;
  apiTests: Array<{ race: string; round: number; type: string; apiReturned: number; status: string; error?: string }>;
  cacheStats: { size: number; keys: string[] };
  lastSyncStatus: SyncJobState;
}

const Admin = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ [key: string]: 'idle' | 'loading' | 'success' | 'error' }>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [forceResync, setForceResync] = useState(false);
  const [selectedResyncRaceId, setSelectedResyncRaceId] = useState<number | ''>('');
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Broadcast email state
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Send last race results email state
  const [raceResultsStatus, setRaceResultsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [raceResultsMessage, setRaceResultsMessage] = useState<string | null>(null);

  // Prediction status ("who has predicted") state
  const [predictionRaces, setPredictionRaces] = useState<RaceOption[]>([]);
  const [selectedPredictionRaceId, setSelectedPredictionRaceId] = useState<number | ''>('');
  const [predictionStatus, setPredictionStatus] = useState<{ raceName: string; predicted: number; total: number; users: PredictionStatusUser[] } | null>(null);
  const [predictionStatusLoading, setPredictionStatusLoading] = useState(false);
  const [predictionStatusError, setPredictionStatusError] = useState<string | null>(null);

  const [pitwallIdeas, setPitwallIdeas] = useState<PitwallIdea[]>([]);
  const [ideaNotes, setIdeaNotes] = useState<Record<number, string>>({});
  const [ideaBusyId, setIdeaBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.is_admin) return;
    getRaces(2026)
      .then(res => setPredictionRaces(res.data))
      .catch(() => { /* race list is a nice-to-have; ignore failures */ });
    fetchUsers();
    fetchPitwallIdeas();
  }, [user?.is_admin]);

  const handleFetchPredictionStatus = async (raceId: number) => {
    if (!raceId) return;
    setPredictionStatusLoading(true);
    setPredictionStatusError(null);
    try {
      const response = await api.get(`/api/admin/races/${raceId}/prediction-status`);
      setPredictionStatus(response.data);
    } catch (err: any) {
      setPredictionStatus(null);
      setPredictionStatusError(err.response?.data?.error || 'Failed to fetch prediction status');
    } finally {
      setPredictionStatusLoading(false);
    }
  };

  // Set password state
  const [passwordModal, setPasswordModal] = useState<{ userId: number; nickname: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPitwallIdeas = async () => {
    try {
      const response = await api.get('/api/admin/pitwall-ideas');
      setPitwallIdeas(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch Pit Wall ideas');
    }
  };

  const handleTogglePitwall = async (target: User) => {
    try {
      await api.put(`/api/admin/users/${target.id}/pitwall-access`, { enabled: !target.pitwall_access });
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, pitwall_access: !target.pitwall_access } : u)));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update Pit Wall access');
    }
  };

  const handleDecideIdea = async (id: number, status: 'approved' | 'declined') => {
    setIdeaBusyId(id);
    try {
      await api.put(`/api/admin/pitwall-ideas/${id}`, { status, adminNote: ideaNotes[id] || '' });
      await fetchPitwallIdeas();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save the decision');
      fetchPitwallIdeas();
    } finally {
      setIdeaBusyId(null);
    }
  };

  const handleDeleteUser = async (userId: number, nickname: string) => {
    if (!confirm(`Are you sure you want to delete user "${nickname}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);

      // Refresh users list
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal) return;

    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      setPasswordStatus('error');
      return;
    }

    setPasswordStatus('loading');
    setPasswordMessage(null);

    try {
      await api.post(`/api/admin/users/${passwordModal.userId}/password`, {
        password: newPassword
      });

      setPasswordStatus('success');
      setPasswordMessage(`Password set for ${passwordModal.nickname}`);
      setNewPassword('');

      // Close modal after 2 seconds
      setTimeout(() => {
        setPasswordModal(null);
        setPasswordStatus('idle');
        setPasswordMessage(null);
      }, 2000);
    } catch (err: any) {
      setPasswordStatus('error');
      setPasswordMessage(err.response?.data?.error || 'Failed to set password');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
      setBroadcastResult('Subject and message are required');
      setBroadcastStatus('error');
      return;
    }

    if (!confirm(`Are you sure you want to send this email to ALL ${users.length} users?`)) {
      return;
    }

    setBroadcastStatus('loading');
    setBroadcastResult(null);

    try {
      const response = await api.post('/api/admin/broadcast', {
        subject: broadcastSubject,
        message: broadcastMessage
      });

      setBroadcastStatus('success');
      setBroadcastResult(`Email sent to ${response.data.successCount} user(s)${response.data.failCount > 0 ? `. Failed: ${response.data.failCount}` : ''}`);
      setBroadcastSubject('');
      setBroadcastMessage('');

      // Reset status after 10 seconds
      setTimeout(() => {
        setBroadcastStatus('idle');
        setBroadcastResult(null);
      }, 10000);
    } catch (err: any) {
      setBroadcastStatus('error');
      setBroadcastResult(err.response?.data?.error || 'Failed to send broadcast');
    }
  };

  const handleSendLastRaceResults = async () => {
    if (!confirm(`Send personal prediction results for the last completed race to all players with a prediction?`)) {
      return;
    }

    setRaceResultsStatus('loading');
    setRaceResultsMessage(null);

    try {
      const response = await api.post('/api/admin/send-last-race-results', {});

      setRaceResultsStatus('success');
      setRaceResultsMessage(`Sent to ${response.data.sent} player(s) for "${response.data.raceName}"${response.data.failed > 0 ? `. Failed: ${response.data.failed}` : ''}`);

      setTimeout(() => {
        setRaceResultsStatus('idle');
        setRaceResultsMessage(null);
      }, 15000);
    } catch (err: any) {
      setRaceResultsStatus('error');
      setRaceResultsMessage(err.response?.data?.error || 'Failed to send emails');
    }
  };

  const handleSync = async (type: 'standings' | 'results' | 'drivers' | 'qualifying' | 'calendar') => {
    const resyncRace = type === 'results' && selectedResyncRaceId !== ''
      ? predictionRaces.find(r => r.id === selectedResyncRaceId)
      : undefined;

    const endpoint = type === 'standings'
      ? '/api/admin/cronjobs/sync-driver-standings'
      : type === 'drivers'
      ? '/api/admin/cronjobs/sync-drivers'
      : type === 'calendar'
      ? '/api/admin/cronjobs/sync-calendar'
      : type === 'qualifying'
      ? `/api/admin/cronjobs/sync-qualifying${forceResync ? '?force=true' : ''}`
      : resyncRace
      ? `/api/admin/cronjobs/sync-race-results?raceId=${resyncRace.id}`
      : `/api/admin/cronjobs/sync-race-results${forceResync ? '?force=true' : ''}`;

    setSyncStatus(prev => ({ ...prev, [type]: 'loading' }));
    setSyncMessage(type === 'results'
      ? resyncRace
        ? `Recalculating ${resyncRace.race_name}… polling for result…`
        : `Sync started${forceResync ? ' (force mode)' : ''}… polling for result…`
      : type === 'qualifying'
      ? 'Fetching qualifying results from Jolpi…'
      : type === 'calendar'
      ? 'Fetching race calendar from Jolpi…'
      : 'Driver standings sync started…');

    try {
      const response = await api.post(endpoint, {});
      if (type === 'qualifying') {
        setSyncStatus(prev => ({ ...prev, qualifying: 'success' }));
        const data = response.data;
        const gridPreview = data.grid?.slice(0, 5).join(' · ') || '';
        setSyncMessage(`✅ ${data.message}${gridPreview ? `\n${gridPreview}${data.grid?.length > 5 ? ` …+${data.grid.length - 5} more` : ''}` : ''}`);
        setTimeout(() => {
          setSyncStatus(prev => ({ ...prev, qualifying: 'idle' }));
          setSyncMessage(null);
        }, 15000);
        return;
      }
    } catch (err: any) {
      setSyncStatus(prev => ({ ...prev, [type]: 'error' }));
      setSyncMessage(err.response?.data?.error || `Failed to start sync`);
      return;
    }

    if (type !== 'results') {
      // Driver standings / drivers / calendar sync: show simple success after a short wait
      setSyncStatus(prev => ({ ...prev, [type]: 'success' }));
      setSyncMessage(type === 'drivers'
        ? 'Driver sync complete — headshots updated. Run Sync Standings to refresh points.'
        : type === 'calendar'
        ? 'Calendar synced — race dates and qualifying times refreshed from Jolpi.'
        : 'Driver standings sync started — check server logs for completion.');
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [type]: 'idle' }));
        setSyncMessage(null);
      }, 8000);
      return;
    }

    // For race results: poll GET /api/admin/sync-status every 2s until done
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await api.get('/api/admin/sync-status');
        const job: SyncJobState = statusRes.data.syncRaceResults;

        if (!job.isRunning) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;

          const isError = job.lastStatus === 'error';
          setSyncStatus(prev => ({ ...prev, results: isError ? 'error' : 'success' }));
          setSyncMessage(job.lastMessage || (isError ? 'Sync failed' : 'Sync complete'));

          // Refresh users to show updated points
          if (!isError) setTimeout(() => fetchUsers(), 500);

          // Reset UI after 30 seconds
          setTimeout(() => {
            setSyncStatus(prev => ({ ...prev, results: 'idle' }));
            setSyncMessage(null);
          }, 30000);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);
  };

  const handleDiagnosis = async () => {
    setDiagnosisLoading(true);
    setShowDiagnosis(true);
    try {
      const res = await api.get('/api/admin/sync-diagnosis');
      setDiagnosis(res.data);
    } catch (err: any) {
      setDiagnosis(null);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-f1 max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-4 text-f1-yellow-500">
            Not authorized
          </h1>
          <p className="text-white">
            Your account doesn't have Pitlane access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl md:text-display-xl font-bold text-f1-yellow-500">
          Admin Panel
        </h1>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Admin Actions */}
      <div className="card-f1 mb-8">
        <h2 className="text-2xl font-bold mb-6">Admin Actions</h2>

        {syncMessage && (
          <div className={`mb-4 px-4 py-3 whitespace-pre-line text-sm ${
            syncStatus.standings === 'error' || syncStatus.results === 'error'
              ? 'bg-red-900/50 border border-red-500 text-red-200'
              : syncStatus.results === 'loading' || syncStatus.standings === 'loading'
              ? 'bg-f1-blue-dark/50 border border-f1-blue text-white'
              : 'bg-green-900/50 border border-green-500 text-green-200'
          }`}>
            {syncStatus.results === 'loading' && (
              <span className="inline-flex items-center gap-2 mb-1">
                <span className="animate-spin h-3 w-3 border-2 border-f1-blue border-t-transparent rounded-full"></span>
                <span className="font-medium">Running sync…</span>
              </span>
            )}
            {syncMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Sync Drivers & Headshots */}
          <div className="bg-f1-neutral-800 p-5">
            <h3 className="font-bold text-purple-400 mb-2">Sync Drivers & Headshots</h3>
            <p className="text-sm text-white mb-4">
              Fetch driver list from OpenF1 API and store headshot URLs for circular avatars on the prediction page.
            </p>
            <button
              onClick={() => handleSync('drivers')}
              disabled={syncStatus.drivers === 'loading' || syncStatus.results === 'loading'}
              className={`w-full py-3 px-4 font-semibold text-base transition-colors ${
                syncStatus.drivers === 'loading'
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : syncStatus.drivers === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {syncStatus.drivers === 'loading' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Syncing...
                </span>
              ) : syncStatus.drivers === 'success' ? (
                'Done!'
              ) : (
                'Sync Drivers & Headshots'
              )}
            </button>
          </div>

          {/* Sync Race Calendar */}
          <div className="bg-f1-neutral-800 p-5">
            <h3 className="font-bold text-f1-yellow-400 mb-2">Sync Race Calendar</h3>
            <p className="text-sm text-white mb-4">
              Re-fetch race dates and qualifying times from Jolpi. Run this whenever F1 changes a race weekend's schedule — dates don't refresh on their own otherwise.
            </p>
            <button
              onClick={() => handleSync('calendar')}
              disabled={syncStatus.calendar === 'loading' || syncStatus.results === 'loading'}
              className={`w-full py-3 px-4 font-semibold text-base transition-colors ${
                syncStatus.calendar === 'loading'
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : syncStatus.calendar === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-f1-yellow-500 hover:bg-f1-yellow-400 text-black'
              }`}
            >
              {syncStatus.calendar === 'loading' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Syncing...
                </span>
              ) : syncStatus.calendar === 'success' ? (
                'Done!'
              ) : (
                'Sync Calendar'
              )}
            </button>
          </div>

          {/* Sync Driver Standings */}
          <div className="bg-f1-neutral-800 p-5">
            <h3 className="font-bold text-f1-blue mb-2">Sync Driver Standings</h3>
            <p className="text-sm text-white mb-4">
              Fetch latest F1 championship standings from Jolpi API and update driver points.
            </p>
            <button
              onClick={() => handleSync('standings')}
              disabled={syncStatus.standings === 'loading' || syncStatus.results === 'loading'}
              className={`w-full py-3 px-4 font-semibold text-base transition-colors ${
                syncStatus.standings === 'loading'
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : syncStatus.standings === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-f1-blue hover:brightness-110 text-white'
              }`}
            >
              {syncStatus.standings === 'loading' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Syncing...
                </span>
              ) : syncStatus.standings === 'success' ? (
                'Started!'
              ) : (
                'Sync Standings'
              )}
            </button>
          </div>

          {/* Sync Qualifying Results */}
          <div className="bg-f1-neutral-800 p-5 border border-yellow-500/30">
            <h3 className="font-bold text-yellow-400 mb-2">🏁 Sync Qualifying Results</h3>
            <p className="text-sm text-white mb-4">
              Manually fetch the latest qualifying grid from Jolpi. Use this right after qualifying ends — bypasses the 2-hour cron delay and clears cache.
            </p>

            <label className="flex items-center gap-2 text-sm text-white mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceResync}
                onChange={e => setForceResync(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="text-f1-yellow-400 font-medium">Force re-sync</span>
                <span className="text-xs ml-1">(overwrite existing qualifying results)</span>
              </span>
            </label>

            <button
              onClick={() => handleSync('qualifying')}
              disabled={syncStatus.qualifying === 'loading' || syncStatus.results === 'loading'}
              className={`w-full py-3 px-4 font-semibold text-base transition-colors ${
                syncStatus.qualifying === 'loading'
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : syncStatus.qualifying === 'success'
                  ? 'bg-green-600 text-white'
                  : forceResync
                  ? 'bg-f1-yellow-500 hover:bg-f1-yellow-500 text-black'
                  : 'bg-yellow-500 hover:bg-yellow-400 text-black'
              }`}
            >
              {syncStatus.qualifying === 'loading' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Fetching qualifying…
                </span>
              ) : syncStatus.qualifying === 'success' ? (
                '✅ Done!'
              ) : (
                forceResync ? 'Force Re-sync Qualifying' : 'Sync Qualifying Results'
              )}
            </button>
          </div>

          {/* Sync Race Results */}
          <div className="bg-f1-neutral-800 p-5">
            <h3 className="font-bold text-f1-yellow-500 mb-2">Sync Race Results & Calculate Points</h3>
            <p className="text-sm text-white mb-3">
              Fetch race &amp; sprint results from Jolpi API, update race statuses, and recalculate prediction points for all users.
            </p>

            {/* Single-race recalculate picker */}
            <label className="block text-xs text-white mb-1">
              Recalculate a single race (e.g. after a post-race result correction)
            </label>
            <select
              value={selectedResyncRaceId}
              onChange={e => setSelectedResyncRaceId(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-sm text-white focus:border-f1-yellow-500 focus:outline-none mb-3"
            >
              <option value="">Whole season (default)</option>
              {predictionRaces.map(race => (
                <option key={race.id} value={race.id}>
                  Round {race.round}: {race.race_name}{race.race_type === 'sprint' ? ' (Sprint)' : ''}
                </option>
              ))}
            </select>

            {/* Force re-sync toggle — not needed when a specific race is picked above */}
            <label className={`flex items-center gap-2 text-sm mb-3 select-none ${
              selectedResyncRaceId !== '' ? 'text-white/40 cursor-not-allowed' : 'text-white cursor-pointer'
            }`}>
              <input
                type="checkbox"
                checked={forceResync}
                disabled={selectedResyncRaceId !== ''}
                onChange={e => setForceResync(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="text-f1-yellow-400 font-medium">Force re-sync</span>
                <span className="text-xs ml-1">
                  {selectedResyncRaceId !== ''
                    ? '(not needed — picking a race above always recalculates it)'
                    : '(re-calculates points for races already synced)'}
                </span>
              </span>
            </label>

            <button
              onClick={() => handleSync('results')}
              disabled={syncStatus.results === 'loading'}
              className={`w-full py-3 px-4 font-semibold text-base transition-colors ${
                syncStatus.results === 'loading'
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : syncStatus.results === 'success'
                  ? 'bg-green-600 text-white'
                  : forceResync
                  ? 'bg-f1-yellow-500 hover:bg-f1-yellow-400 text-black'
                  : 'bg-f1-yellow-500 hover:bg-f1-yellow-600 text-black'
              }`}
            >
              {syncStatus.results === 'loading' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Syncing… (polling for result)
                </span>
              ) : syncStatus.results === 'success' ? (
                'Done!'
              ) : selectedResyncRaceId !== '' ? (
                `Recalculate ${predictionRaces.find(r => r.id === selectedResyncRaceId)?.race_name ?? 'race'}`
              ) : (
                forceResync ? 'Force Re-sync All Races' : 'Sync Results & Calculate Points'
              )}
            </button>

            {/* Diagnosis button */}
            <button
              onClick={handleDiagnosis}
              disabled={diagnosisLoading}
              className="w-full mt-2 py-1.5 px-4 text-sm font-medium bg-f1-neutral-700 hover:bg-f1-neutral-600 text-white transition-colors"
            >
              {diagnosisLoading ? 'Running diagnosis…' : 'Run Sync Diagnosis'}
            </button>
          </div>
        </div>

        {/* Diagnosis panel */}
        {showDiagnosis && (
          <div className="mt-4 bg-f1-neutral-900 border border-f1-neutral-700 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-yellow-400">Sync Diagnosis</h3>
              <button onClick={() => setShowDiagnosis(false)} className="text-white hover:text-white text-sm">✕ Close</button>
            </div>

            {diagnosisLoading ? (
              <div className="text-white text-sm animate-pulse">Querying DB and Jolpi API…</div>
            ) : diagnosis ? (
              <div className="space-y-4 text-sm">
                {/* Pending races */}
                <div>
                  <p className="font-medium text-white mb-2">
                    Races needing sync: <span className={diagnosis.pendingSync.length > 0 ? 'text-yellow-400' : 'text-green-400'}>{diagnosis.pendingSync.length}</span>
                  </p>
                  {diagnosis.pendingSync.length > 0 ? (
                    <ul className="space-y-1 text-white font-mono text-xs">
                      {diagnosis.pendingSync.map(r => (
                        <li key={`${r.id}`}>• Round {r.round}: {r.race_name} ({r.race_type}) — DB status: {r.status}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-green-400 text-xs">All past races already have results. Use Force Re-sync to recalculate points.</p>
                  )}
                </div>

                {/* API tests */}
                {diagnosis.apiTests.length > 0 && (
                  <div>
                    <p className="font-medium text-white mb-2">Jolpi API test (first 3 pending):</p>
                    <ul className="space-y-1 font-mono text-xs">
                      {diagnosis.apiTests.map((t, i) => (
                        <li key={i} className={t.status === 'available' ? 'text-green-400' : t.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                          • {t.race} ({t.type}): {t.status === 'available' ? `✓ ${t.apiReturned} results` : t.status === 'no_data' ? '⚠ no data yet' : `✗ ${t.error}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Synced races summary */}
                <div>
                  <p className="font-medium text-white mb-2">Past races in DB ({diagnosis.syncedRaces.length} total):</p>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b border-f1-neutral-700 text-white">
                          <th className="text-left py-1 pr-3">Round</th>
                          <th className="text-left py-1 pr-3">Race</th>
                          <th className="text-left py-1 pr-3">Type</th>
                          <th className="text-left py-1 pr-3">DB Status</th>
                          <th className="text-left py-1">Results</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagnosis.syncedRaces.map(r => {
                          const count = r.race_type === 'sprint' ? r.sprint_result_count : r.main_result_count;
                          return (
                            <tr key={r.id} className="border-b border-f1-neutral-800 text-white">
                              <td className="py-1 pr-3">{r.round}</td>
                              <td className="py-1 pr-3">{r.race_name}</td>
                              <td className={`py-1 pr-3 ${r.race_type === 'sprint' ? 'text-f1-yellow-400' : 'text-f1-blue'}`}>{r.race_type}</td>
                              <td className={`py-1 pr-3 ${r.status === 'completed' ? 'text-green-400' : r.status === 'provisional' ? 'text-yellow-400' : 'text-white'}`}>{r.status}</td>
                              <td className={`py-1 ${count > 0 ? 'text-green-400' : 'text-red-400'}`}>{count} rows</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {diagnosis.syncedRaces.map(r => {
                      const count = r.race_type === 'sprint' ? r.sprint_result_count : r.main_result_count;
                      return (
                        <div key={r.id} className="bg-f1-neutral-800 border border-f1-neutral-700 p-3 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-white">Round {r.round}: {r.race_name}</span>
                            <span className={r.race_type === 'sprint' ? 'text-f1-yellow-400' : 'text-f1-blue'}>{r.race_type}</span>
                          </div>
                          <div className="flex justify-between text-white">
                            <span className={r.status === 'completed' ? 'text-green-400' : r.status === 'provisional' ? 'text-yellow-400' : 'text-white'}>{r.status}</span>
                            <span className={count > 0 ? 'text-green-400' : 'text-red-400'}>{count} rows</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cache stats */}
                <div className="text-xs text-white">
                  Cache entries: {diagnosis.cacheStats.size} — {diagnosis.cacheStats.keys.join(', ') || 'empty'}
                </div>
              </div>
            ) : (
              <p className="text-red-400 text-sm">Diagnosis failed.</p>
            )}
          </div>
        )}
      </div>

      {/* Send Last Race Results */}
      <div className="card-f1 mb-8">
        <h2 className="text-2xl font-bold mb-2">Send Race Prediction Results</h2>
        <p className="text-white text-sm mb-4">
          Send each player a personalised email showing their predictions vs. the actual result for the most recently completed race.
        </p>

        {raceResultsMessage && (
          <div className={`mb-4 px-4 py-3 ${
            raceResultsStatus === 'success'
              ? 'bg-green-900/50 border border-green-500 text-green-200'
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}>
            {raceResultsMessage}
          </div>
        )}

        <button
          onClick={handleSendLastRaceResults}
          disabled={raceResultsStatus === 'loading'}
          className={`py-3 px-6 font-medium transition-colors ${
            raceResultsStatus === 'loading'
              ? 'bg-gray-600 cursor-not-allowed text-gray-400'
              : raceResultsStatus === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-f1-yellow-500 hover:bg-f1-yellow-600 text-black'
          }`}
        >
          {raceResultsStatus === 'loading' ? (
            <span className="inline-flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Sending…
            </span>
          ) : raceResultsStatus === 'success' ? (
            'Emails Sent!'
          ) : (
            'Send Last Race Results to All Players'
          )}
        </button>
      </div>

      {/* Prediction Status */}
      <div className="card-f1 mb-8">
        <h2 className="text-2xl font-bold mb-2">Who's Predicted?</h2>
        <p className="text-white text-sm mb-4">
          Check which players have already submitted a prediction for a race, to chase down stragglers before lock.
        </p>

        <select
          value={selectedPredictionRaceId}
          onChange={(e) => {
            const raceId = parseInt(e.target.value);
            setSelectedPredictionRaceId(raceId);
            setPredictionStatus(null);
            setPredictionStatusError(null);
            if (raceId) handleFetchPredictionStatus(raceId);
          }}
          className="w-full bg-f1-neutral-800 border border-f1-neutral-700 px-4 py-3 text-white focus:border-f1-yellow-500 focus:outline-none mb-4"
        >
          <option value="">Select a race…</option>
          {predictionRaces.map(race => (
            <option key={race.id} value={race.id}>
              Round {race.round}: {race.race_name}{race.race_type === 'sprint' ? ' (Sprint)' : ''}
            </option>
          ))}
        </select>

        {predictionStatusLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-f1-yellow-500 mx-auto"></div>
          </div>
        ) : predictionStatusError ? (
          <div className="px-4 py-3 bg-red-900/50 border border-red-500 text-red-200">
            {predictionStatusError}
          </div>
        ) : predictionStatus ? (
          <div>
            <p className="text-sm text-white mb-3">
              <span className="text-white font-bold">{predictionStatus.predicted}</span> of{' '}
              <span className="text-white font-bold">{predictionStatus.total}</span> players have predicted{' '}
              {predictionStatus.raceName}.
            </p>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-f1-neutral-700">
                    <th className="text-left py-3 px-4">Nickname</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionStatus.users.map(user => (
                    <tr key={user.id} className="border-b border-f1-neutral-800 hover:bg-f1-neutral-800/50">
                      <td className="py-3 px-4 font-medium">{user.nickname}</td>
                      <td className="py-3 px-4 text-white">{user.email}</td>
                      <td className="py-3 px-4">
                        {user.hasPredicted ? (
                          <span className="text-xs bg-green-600/30 text-green-400 px-2 py-1">✓ Predicted</span>
                        ) : (
                          <span className="text-xs bg-red-600/30 text-red-400 px-2 py-1">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {predictionStatus.users.map(user => (
                <div key={user.id} className="bg-f1-neutral-800 border border-f1-neutral-700 p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.nickname}</p>
                      <p className="text-xs text-white truncate">{user.email}</p>
                    </div>
                    {user.hasPredicted ? (
                      <span className="shrink-0 text-xs bg-green-600/30 text-green-400 px-2 py-1">✓ Predicted</span>
                    ) : (
                      <span className="shrink-0 text-xs bg-red-600/30 text-red-400 px-2 py-1">Not yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Broadcast Email */}
      <div className="card-f1 mb-8">
        <h2 className="text-2xl font-bold mb-6">Broadcast Email</h2>
        <p className="text-white text-sm mb-4">
          Send an email message to all registered users ({users.length} users).
        </p>

        {broadcastResult && (
          <div className={`mb-4 px-4 py-3 ${
            broadcastStatus === 'success'
              ? 'bg-green-900/50 border border-green-500 text-green-200'
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}>
            {broadcastResult}
          </div>
        )}

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <input
              type="text"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="e.g., Season Update, New Feature Announcement"
              className="input-f1 w-full"
              maxLength={100}
              required
            />
            <p className="text-xs text-white mt-1">
              Will be prefixed with "Poule Position - "
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Write your message here. This will be sent to all users..."
              className="input-f1 w-full h-40 resize-y"
              maxLength={5000}
              required
            />
            <p className="text-xs text-white mt-1">
              {broadcastMessage.length}/5000 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={broadcastStatus === 'loading' || !broadcastSubject.trim() || !broadcastMessage.trim()}
            className={`w-full py-3 px-4 font-medium transition-colors ${
              broadcastStatus === 'loading'
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : broadcastStatus === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {broadcastStatus === 'loading' ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Sending to {users.length} users...
              </span>
            ) : broadcastStatus === 'success' ? (
              'Email Sent!'
            ) : (
              `Send Email to All Users (${users.length})`
            )}
          </button>
        </form>
      </div>

      {/* Scheduling Documentation */}
      <div className="card-f1 mb-8">
        <h2 className="text-2xl font-bold mb-6">Scheduling Logic Documentation</h2>

        {/* Visual Timeline */}
        <div className="bg-f1-neutral-800 p-6 mb-6">
          <h3 className="text-lg font-bold text-f1-yellow-500 mb-4">Race Weekend Timeline</h3>
          <div className="font-mono text-sm text-white space-y-2">
            <p className="text-f1-yellow-400 font-bold">SUNDAY (Race Day)</p>
            <p>12:00 UTC ──────────────────────────────────────── 20:00 UTC</p>
            <p>    │                                                    │</p>
            <p>    ├─ Copy missing predictions (every 2 min until 18:00)│</p>
            <p>    │                                                    │</p>
            <p>    └─ Check for provisional results (every 5 min) ──────┘</p>
            <p>                    │</p>
            <p>                    ▼</p>
            <p className="text-green-400">         Race ends ~14:00-16:00 UTC</p>
            <p>                    │</p>
            <p>                    ▼ (5 min after race)</p>
            <p className="text-yellow-400">         📧 Provisional Results Email sent</p>
            <p></p>
            <p className="text-f1-blue font-bold">MONDAY (Next Day)</p>
            <p>09:00 UTC ──────────────────────────────────────── 20:00 UTC</p>
            <p>    │                                                    │</p>
            <p>    ├─ 09:00: Sync driver standings                      │</p>
            <p>    ├─ 09:15: Sync race results                          │</p>
            <p>    │                                                    │</p>
            <p>    └─ Check for final results (hourly 12:00-20:00) ─────┘</p>
            <p>                    │</p>
            <p>                    ▼ (24+ hours after race)</p>
            <p className="text-green-400">         📧 Final Results Email sent</p>
            <p className="text-white">         (Points recalculated for DQs/penalties)</p>
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Copy Missing Predictions */}
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-f1-yellow-400 mb-3">1. Copy Missing Predictions</h4>
            <p className="text-sm text-white mb-3">
              Runs for races that locked 1-10 minutes ago. Finds users who have predicted before
              but NOT for this race, and copies their most recent prediction automatically.
            </p>
            <div className="text-xs space-y-1">
              <p><span className="text-white">Schedule:</span> <span className="font-mono">*/2 12-18 * * 0</span></p>
              <p><span className="text-white">Trigger:</span> Race locked 1-10 min ago</p>
              <p><span className="text-white">Email:</span> None (silent operation)</p>
            </div>
          </div>

          {/* Provisional Results */}
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-yellow-400 mb-3">2. Send Provisional Results</h4>
            <p className="text-sm text-white mb-3">
              Fetches results from Jolpi API, stores in database, calculates points for each
              user's prediction, and sends provisional results email.
            </p>
            <div className="text-xs space-y-1">
              <p><span className="text-white">Schedule:</span> <span className="font-mono">*/5 12-20 * * 0</span></p>
              <p><span className="text-white">Trigger:</span> Race finished 5 min - 3 hrs ago, not sent yet</p>
              <p><span className="text-white">Email:</span> Provisional results with points breakdown</p>
            </div>
          </div>

          {/* Final Results */}
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-green-400 mb-3">3. Process Final Results</h4>
            <p className="text-sm text-white mb-3">
              Re-fetches results (may include DQs/penalties), recalculates all points from scratch,
              updates user totals, and sends final results email.
            </p>
            <div className="text-xs space-y-1">
              <p><span className="text-white">Schedule:</span> <span className="font-mono">0 12-20 * * 1</span></p>
              <p><span className="text-white">Trigger:</span> Race 24+ hrs old, status = provisional</p>
              <p><span className="text-white">Email:</span> Final points (shows changes if any)</p>
            </div>
          </div>

          {/* Sync Jobs */}
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-f1-blue mb-3">4. Sync Driver Standings & Race Results</h4>
            <p className="text-sm text-white mb-3">
              Updates F1 championship points and imports race results from Jolpi API.
              Can be triggered manually from this panel.
            </p>
            <div className="text-xs space-y-1">
              <p><span className="text-white">Schedule:</span> <span className="font-mono">0 9 * * 1,4</span> and <span className="font-mono">15 9 * * 1,4</span></p>
              <p><span className="text-white">Trigger:</span> Mon & Thu at 09:00/09:15 UTC</p>
              <p><span className="text-white">Email:</span> None</p>
            </div>
          </div>
        </div>

        {/* Points System */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-f1-yellow-500 mb-3">Main Race Points (Top 10)</h4>
            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              {[
                { pos: 'P1', pts: 25 }, { pos: 'P2', pts: 18 }, { pos: 'P3', pts: 15 },
                { pos: 'P4', pts: 12 }, { pos: 'P5', pts: 10 }, { pos: 'P6', pts: 8 },
                { pos: 'P7', pts: 6 }, { pos: 'P8', pts: 4 }, { pos: 'P9', pts: 2 }, { pos: 'P10', pts: 1 }
              ].map(({ pos, pts }) => (
                <div key={pos} className="bg-f1-neutral-700 p-2">
                  <p className="text-white text-xs">{pos}</p>
                  <p className="font-bold">{pts}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-f1-neutral-800 p-5">
            <h4 className="font-bold text-f1-yellow-500 mb-3">Sprint Race Points (Top 8)</h4>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              {[
                { pos: 'P1', pts: 8 }, { pos: 'P2', pts: 7 }, { pos: 'P3', pts: 6 }, { pos: 'P4', pts: 5 },
                { pos: 'P5', pts: 4 }, { pos: 'P6', pts: 3 }, { pos: 'P7', pts: 2 }, { pos: 'P8', pts: 1 }
              ].map(({ pos, pts }) => (
                <div key={pos} className="bg-f1-neutral-700 p-2">
                  <p className="text-white text-xs">{pos}</p>
                  <p className="font-bold">{pts}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-green-400 mt-3">+50% bonus if predicted within ±1 position</p>
          </div>
        </div>

        {/* Email Types */}
        <div className="bg-f1-neutral-800 p-5 mb-6">
          <h4 className="font-bold text-f1-yellow-500 mb-3">Email Types</h4>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-f1-neutral-700">
                  <th className="text-left py-2 px-3 text-white">Email</th>
                  <th className="text-left py-2 px-3 text-white">Trigger</th>
                  <th className="text-left py-2 px-3 text-white">Contents</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr className="border-b border-f1-neutral-700/50">
                  <td className="py-2 px-3 font-medium text-white">Prediction Confirmation</td>
                  <td className="py-2 px-3">User saves prediction</td>
                  <td className="py-2 px-3">List of predicted positions</td>
                </tr>
                <tr className="border-b border-f1-neutral-700/50">
                  <td className="py-2 px-3 font-medium text-yellow-400">Provisional Results</td>
                  <td className="py-2 px-3">~5 min after race</td>
                  <td className="py-2 px-3">Race results, prediction breakdown, points earned</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-green-400">Final Results</td>
                  <td className="py-2 px-3">24+ hours after race</td>
                  <td className="py-2 px-3">Final points, changes highlighted if any</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2 text-sm">
            {[
              { name: 'Prediction Confirmation', color: 'text-white', trigger: 'User saves prediction', contents: 'List of predicted positions' },
              { name: 'Provisional Results', color: 'text-yellow-400', trigger: '~5 min after race', contents: 'Race results, prediction breakdown, points earned' },
              { name: 'Final Results', color: 'text-green-400', trigger: '24+ hours after race', contents: 'Final points, changes highlighted if any' },
            ].map(email => (
              <div key={email.name} className="bg-f1-neutral-800 border border-f1-neutral-700 p-3">
                <p className={`font-medium ${email.color}`}>{email.name}</p>
                <p className="text-white text-xs mt-1">Trigger: {email.trigger}</p>
                <p className="text-white text-xs">Contents: {email.contents}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Yearly Points Reset */}
        <div className="bg-f1-neutral-800 p-5 mb-6">
          <h4 className="font-bold text-purple-400 mb-3">5. Yearly Points Reset</h4>
          <p className="text-sm text-white mb-3">
            Automatically resets all user points to 0 at the start of each new F1 season.
            This ensures a fresh leaderboard competition every year.
          </p>
          <div className="text-xs space-y-1">
            <p><span className="text-white">Schedule:</span> <span className="font-mono">0 0 1 1 *</span></p>
            <p><span className="text-white">Trigger:</span> January 1st at 00:00 UTC</p>
            <p><span className="text-white">Action:</span> UPDATE users SET total_points = 0</p>
            <p><span className="text-white">Email:</span> None</p>
          </div>
        </div>

        {/* Race Status Flow */}
        <div className="bg-f1-neutral-800 p-5">
          <h4 className="font-bold text-f1-yellow-500 mb-3">Race Status Flow</h4>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-f1-blue-dark/50 text-white px-3 py-1">upcoming</span>
            <span className="text-white">→ race ends →</span>
            <span className="bg-f1-yellow-900/20 text-orange-300 px-3 py-1">provisional</span>
            <span className="text-white">→ 24 hours →</span>
            <span className="bg-green-900/50 text-green-300 px-3 py-1">completed</span>
          </div>
          <p className="text-xs text-white mt-3">
            Provisional status allows for DQs/penalties to be applied before final points are calculated.
          </p>
        </div>
      </div>

      {/* System Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* API URLs */}
        <div className="card-f1">
          <h2 className="text-xl font-bold mb-4 text-f1-yellow-500">External APIs</h2>
          <div className="space-y-3">
            <div className="bg-f1-neutral-800 p-4">
              <p className="text-sm text-white mb-1">OpenF1 API</p>
              <p className="text-xs font-mono break-all">https://api.openf1.org/v1</p>
              <p className="text-xs text-white mt-1">Driver info, live data</p>
            </div>
            <div className="bg-f1-neutral-800 p-4">
              <p className="text-sm text-white mb-1">Jolpi Ergast API</p>
              <p className="text-xs font-mono break-all">https://api.jolpi.ca/ergast/f1</p>
              <p className="text-xs text-white mt-1">Championship standings, race results</p>
            </div>
          </div>
        </div>

        {/* Cron Schedule Info */}
        <div className="card-f1">
          <h2 className="text-xl font-bold mb-4 text-f1-yellow-500">Cron Schedule Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="bg-purple-900/30 border border-purple-500/30 p-3">
              <div className="flex justify-between items-center">
                <span className="text-purple-300 font-medium">Yearly points reset</span>
                <span className="text-purple-400 font-mono text-xs">0 0 1 1 *</span>
              </div>
              <p className="text-xs text-purple-200/70 mt-1">Every January 1st at midnight</p>
            </div>
            <div className="bg-f1-neutral-800 p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Driver standings sync</span>
                <span className="text-white font-mono text-xs">0 9 * * 1,4</span>
              </div>
              <p className="text-xs text-white mt-1">Every Monday & Thursday at 9:00 AM</p>
            </div>
            <div className="bg-f1-neutral-800 p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Race results sync</span>
                <span className="text-white font-mono text-xs">0 3 * * 1</span>
              </div>
              <p className="text-xs text-white mt-1">Every Monday at 3:00 AM</p>
            </div>
            <div className="bg-f1-neutral-800 p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Copy missing predictions</span>
                <span className="text-white font-mono text-xs">*/2 12-18 * * 0</span>
              </div>
              <p className="text-xs text-white mt-1">Every Sunday, every 2 minutes between 12:00 - 18:00</p>
            </div>
            <div className="bg-f1-neutral-800 p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Send provisional results</span>
                <span className="text-white font-mono text-xs">*/5 12-20 * * 0</span>
              </div>
              <p className="text-xs text-white mt-1">Every Sunday, every 5 minutes between 12:00 - 20:00</p>
            </div>
            <div className="bg-f1-neutral-800 p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Process final results</span>
                <span className="text-white font-mono text-xs">0 12-20 * * 1</span>
              </div>
              <p className="text-xs text-white mt-1">Every Monday, hourly between 12:00 - 20:00</p>
            </div>
          </div>
          <p className="text-xs text-white mt-3">All times are in UTC. Logs: /var/log/cron.log</p>
        </div>
      </div>

      <div className="card-f1">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">User Management</h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="btn-f1-secondary text-sm py-2 px-4"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading && users.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-f1-yellow-500 mx-auto"></div>
            <p className="mt-4 text-white">Loading users...</p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-f1-neutral-700">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-4">Nickname</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Points</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-f1-neutral-800 hover:bg-f1-neutral-800/50"
                  >
                    <td className="py-3 px-4 text-white">{user.id}</td>
                    <td className="py-3 px-4 font-medium">
                      {user.nickname}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5">ADMIN</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white">{user.email}</td>
                    <td className="py-3 px-4 text-f1-yellow-500 font-bold">
                      {user.total_points}
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 space-x-2">
                      <button
                        onClick={() => {
                          setPasswordModal({ userId: user.id, nickname: user.nickname });
                          setNewPassword('');
                          setPasswordStatus('idle');
                          setPasswordMessage(null);
                        }}
                        className="bg-f1-blue hover:brightness-110 text-white px-3 py-1 text-sm transition-colors"
                      >
                        Set Password
                      </button>
                      {!user.is_admin && (
                        <button
                          onClick={() => handleTogglePitwall(user)}
                          className={`px-3 py-1 text-sm font-bold transition-colors ${
                            user.pitwall_access
                              ? 'bg-f1-yellow-500 text-black hover:brightness-110'
                              : 'bg-f1-blue-dark text-white hover:brightness-125'
                          }`}
                          title="Let this player submit ideas on the Pit Wall"
                        >
                          Pit Wall: {user.pitwall_access ? 'ON' : 'OFF'}
                        </button>
                      )}
                      {!user.is_admin && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.nickname)}
                          className="bg-red-600 hover:bg-f1-yellow-600 hover:text-black text-white px-3 py-1 text-sm transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && !loading && (
              <div className="text-center py-8 text-white">
                No users found
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-f1-neutral-800 border border-f1-neutral-700 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {user.nickname}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5">ADMIN</span>
                      )}
                    </p>
                    <p className="text-xs text-white truncate">{user.email}</p>
                  </div>
                  <p className="text-f1-yellow-500 font-bold shrink-0 ml-2">{user.total_points}</p>
                </div>
                <p className="text-xs text-white mb-3">
                  ID {user.id} · Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPasswordModal({ userId: user.id, nickname: user.nickname });
                      setNewPassword('');
                      setPasswordStatus('idle');
                      setPasswordMessage(null);
                    }}
                    className="flex-1 bg-f1-blue hover:brightness-110 text-white px-3 py-2 text-sm transition-colors"
                  >
                    Set Password
                  </button>
                  {!user.is_admin && (
                    <button
                      onClick={() => handleTogglePitwall(user)}
                      className={`flex-1 px-3 py-2 text-sm font-bold transition-colors ${
                        user.pitwall_access ? 'bg-f1-yellow-500 text-black' : 'bg-f1-blue-dark text-white'
                      }`}
                    >
                      Pit Wall: {user.pitwall_access ? 'ON' : 'OFF'}
                    </button>
                  )}
                  {!user.is_admin && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.nickname)}
                      className="flex-1 bg-red-600 hover:bg-f1-yellow-600 hover:text-black text-white px-3 py-2 text-sm transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && !loading && (
              <div className="text-center py-8 text-white">
                No users found
              </div>
            )}
          </div>
          </>
        )}

        <div className="mt-6 text-sm text-white">
          Total users: <span className="text-white font-bold">{users.length}</span>
        </div>
      </div>

      {/* Pit Wall ideas submitted by players */}
      <div className="card-f1 mt-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Pit Wall Ideas</h2>
            <p className="text-xs text-white/60 mt-1">
              Submitted by players with Pit Wall access. Approving one emails it to you.
            </p>
          </div>
          <button onClick={fetchPitwallIdeas} className="btn-f1-secondary text-sm py-2 px-4">
            Refresh
          </button>
        </div>

        {pitwallIdeas.length === 0 ? (
          <p className="text-center text-white py-6">No ideas submitted yet</p>
        ) : (
          <div>
            {pitwallIdeas.map((idea, i) => (
              <div key={idea.id} className="flex items-stretch">
                <span className="w-12 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-lg">
                  {idea.status === 'approved' ? '\u2713' : idea.status === 'declined' ? '\u2715' : pitwallIdeas.filter((x) => x.status === 'pending').indexOf(idea) + 1}
                </span>
                <div className={`flex-1 min-w-0 px-4 py-3 text-white ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-f1 font-bold uppercase tracking-wide text-lg leading-tight break-words">{idea.title}</p>
                      <p className="text-[10px] text-white/70 uppercase tracking-wide">
                        {idea.nickname} &middot; {idea.kind} &middot; {new Date(idea.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider flex-shrink-0 ${
                        idea.status === 'pending'
                          ? 'bg-f1-yellow-500 text-black'
                          : idea.status === 'approved'
                          ? 'bg-white text-f1-blue-dark'
                          : 'bg-black/30 text-white/70'
                      }`}
                    >
                      {idea.status}
                    </span>
                  </div>
                  {idea.description && (
                    <p className="text-sm text-white/90 mt-2 whitespace-pre-wrap break-words">{idea.description}</p>
                  )}
                  {idea.status !== 'pending' && idea.admin_note && (
                    <p className="text-xs text-white/70 mt-2 italic">Note: {idea.admin_note}</p>
                  )}
                  {idea.status === 'pending' && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={ideaNotes[idea.id] || ''}
                        onChange={(e) => setIdeaNotes((prev) => ({ ...prev, [idea.id]: e.target.value }))}
                        placeholder="Optional note"
                        maxLength={1000}
                        className="flex-1 bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-f1-yellow-500"
                      />
                      <button
                        onClick={() => handleDecideIdea(idea.id, 'approved')}
                        disabled={ideaBusyId === idea.id}
                        className="bg-f1-yellow-500 text-black font-bold px-4 py-2 text-sm hover:brightness-110 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecideIdea(idea.id, 'declined')}
                        disabled={ideaBusyId === idea.id}
                        className="bg-black/30 text-white font-bold px-4 py-2 text-sm hover:bg-black/50 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Set Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-f1-neutral-900 p-6 max-w-md w-full mx-4 border border-f1-neutral-700">
            <h3 className="text-xl font-bold mb-4">Set Password for {passwordModal.nickname}</h3>

            {passwordMessage && (
              <div className={`mb-4 px-4 py-3 ${
                passwordStatus === 'success'
                  ? 'bg-green-900/50 border border-green-500 text-green-200'
                  : 'bg-red-900/50 border border-red-500 text-red-200'
              }`}>
                {passwordMessage}
              </div>
            )}

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="input-f1 w-full"
                  minLength={6}
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={passwordStatus === 'loading' || newPassword.length < 6}
                  className={`flex-1 py-2 px-4 font-medium transition-colors ${
                    passwordStatus === 'loading'
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : passwordStatus === 'success'
                      ? 'bg-green-600 text-white'
                      : 'bg-f1-blue hover:brightness-110 text-white'
                  }`}
                >
                  {passwordStatus === 'loading' ? 'Setting...' : passwordStatus === 'success' ? 'Done!' : 'Set Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModal(null)}
                  className="px-4 py-2 font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
