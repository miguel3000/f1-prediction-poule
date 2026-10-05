import axios from 'axios';

// Use relative URL for same-origin requests (served from backend on port 5000)
// In development with separate servers, set VITE_API_URL in .env
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const registerWithPassword = (nickname: string, email: string, password: string, language?: string) =>
  api.post('/api/auth/register-password', { nickname, email, password, language });

export const loginWithPassword = (email: string, password: string) =>
  api.post('/api/auth/login-password', { email, password });

export const getProfile = () =>
  api.get('/api/auth/profile');

export const changeEmail = (newEmail: string, password: string) =>
  api.put('/api/auth/email', { newEmail, password });

export const changeNickname = (newNickname: string) =>
  api.put('/api/auth/nickname', { newNickname });

export const saveLanguage = (language: 'en' | 'nl') =>
  api.put('/api/auth/language', { language });

export const getNicknameSuggestion = () =>
  api.get<{ nickname: string }>('/api/auth/nickname-suggestion');

export const forgotPassword = (email: string) =>
  api.post('/api/auth/forgot-password', { email });

export const resetPassword = (token: string, newPassword: string) =>
  api.post('/api/auth/reset-password', { token, newPassword });

export const deleteAccount = (password: string) =>
  api.delete('/api/auth/account', { data: { password } });

// Races
export const getRaces = (season?: number) =>
  api.get('/api/races', { params: { season } });

export const getRace = (id: number) =>
  api.get(`/api/races/${id}`);

export const getNextRace = () =>
  api.get('/api/races/next');

export const getUpcomingRaces = () =>
  api.get('/api/races/upcoming');

export const getRaceResults = (id: number) =>
  api.get(`/api/races/${id}/results`);

export const getQualifyingOrder = (raceId: number) =>
  api.get(`/api/races/${raceId}/qualifying`);

export const syncRaces = () =>
  api.post('/api/races/sync');

// Drivers
export const getDrivers = (season?: number) =>
  api.get('/api/drivers', { params: { season } });

export const getDriver = (id: number) =>
  api.get(`/api/drivers/${id}`);

export const getDriverStandings = (season?: number) =>
  api.get('/api/drivers/standings', { params: { season } });

export const getTeamStandings = (season?: number) =>
  api.get('/api/drivers/team-standings', { params: { season } });

export const syncDrivers = () =>
  api.post('/api/drivers/sync');

// Predictions
export const submitPrediction = (raceId: number, positions: number[], dnfPick?: number | null) =>
  api.post('/api/predictions', { raceId, positions, dnfPick });

export const getPrediction = (raceId: number) =>
  api.get(`/api/predictions/${raceId}`);

export const getUserPredictions = () =>
  api.get('/api/predictions/user');

// Sprint Predictions
export const submitSprintPrediction = (raceId: number, positions: number[]) =>
  api.post('/api/sprint-predictions', { raceId, positions });

export const getSprintPrediction = (raceId: number) =>
  api.get(`/api/sprint-predictions/${raceId}`);

export const getUserSprintPredictions = () =>
  api.get('/api/sprint-predictions');

// Leaderboard
export const getLeaderboard = () =>
  api.get('/api/leaderboard');

export const getTopThree = () =>
  api.get('/api/leaderboard/top-three');

export const getUserRank = () =>
  api.get('/api/leaderboard/rank');

export const getSeasonHistory = () =>
  api.get('/api/leaderboard/season-history');

export const getPlayerStats = () =>
  api.get('/api/leaderboard/player-stats');

// Upload
export const uploadAvatar = (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return api.post('/api/upload/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteAvatar = () =>
  api.delete('/api/upload/avatar');

// News
export const getNews = () =>
  api.get('/api/news');

// Pit Wall (players with access)
export const getMyPitwallIdeas = () =>
  api.get('/api/pitwall/ideas');

export const createPitwallIdea = (kind: 'idea' | 'implementation', title: string, description: string) =>
  api.post('/api/pitwall/ideas', { kind, title, description });

export const deleteMyPitwallIdea = (id: number) =>
  api.delete(`/api/pitwall/ideas/${id}`);

// Live Timing
export const getLiveTiming = () =>
  api.get('/api/live-timing');

// Stats
export const getCompletedRaces = (season?: number) =>
  api.get('/api/stats/races', { params: { season } });

export const getSeasonStats = (season?: number) =>
  api.get('/api/stats/summary', { params: { season } });

export const getPracticeResults = (round: number, session: 1 | 2 | 3, season?: number) =>
  api.get(`/api/stats/practice/${round}/${session}`, { params: { season } });

export const getQualifyingResultsStats = (round: number, season?: number) =>
  api.get(`/api/stats/qualifying/${round}`, { params: { season } });

export const getSprintQualifyingResultsStats = (round: number, season?: number) =>
  api.get(`/api/stats/sprint-qualifying/${round}`, { params: { season } });

export const getRaceResultsStats = (round: number, season?: number) =>
  api.get(`/api/stats/race/${round}`, { params: { season } });

export const getSprintResultsStats = (round: number, season?: number) =>
  api.get(`/api/stats/sprint/${round}`, { params: { season } });

export const getFunStats = (season?: number) =>
  api.get('/api/stats/fun', { params: { season } });

// Admin
export const getAdminUsers = () =>
  api.get('/api/admin/users');

export const deleteAdminUser = (id: number) =>
  api.delete(`/api/admin/users/${id}`);

export const getAdminCronJobs = () =>
  api.get('/api/admin/cronjobs');

export const triggerDriverStandingsSync = () =>
  api.post('/api/admin/cronjobs/sync-driver-standings');

export const triggerRaceResultsSync = () =>
  api.post('/api/admin/cronjobs/sync-race-results');

export const sendBroadcastEmail = (subject: string, message: string) =>
  api.post('/api/admin/broadcast', { subject, message });


export default api;
