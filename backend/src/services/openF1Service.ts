import axios from 'axios';
import dotenv from 'dotenv';
import { f1Cache, CACHE_TTL } from '../utils/cache';

dotenv.config();

const OPENF1_API_URL = process.env.OPENF1_API_URL || 'https://api.openf1.org/v1';

const sessionKeyCache: Record<string, number | null> = {};

export interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  location: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
}

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
}

export interface OpenF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  country_code: string;
  session_key: number;
  headshot_url?: string;
}

export interface OpenF1SessionResult {
  session_key: number;
  driver_number: number;
  position: number;
  points: number;
}

export const getMeetings = async (year: number = 2026): Promise<OpenF1Meeting[]> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/meetings`, {
      params: { year }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching meetings from OpenF1:', error);
    throw error;
  }
};

export const getSessions = async (meetingKey: number): Promise<OpenF1Session[]> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/sessions`, {
      params: { meeting_key: meetingKey }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching sessions from OpenF1:', error);
    throw error;
  }
};

export const getDrivers = async (sessionKey: number): Promise<OpenF1Driver[]> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/drivers`, {
      params: { session_key: sessionKey }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching drivers from OpenF1:', error);
    throw error;
  }
};

export const getSessionResults = async (sessionKey: number): Promise<OpenF1SessionResult[]> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/session_result`, {
      params: { session_key: sessionKey }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching session results from OpenF1:', error);
    throw error;
  }
};

export interface OpenF1QualifyingResult {
  position: number;
  driver_number: number;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  dnf: boolean;
  dsq: boolean;
  session_key: number;
}

function secondsToTimeStr(s: number | undefined): string | null {
  if (s == null || s <= 0) return null;
  const mins = Math.floor(s / 60);
  const secs = (s % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
}

// Generic session key finder — matches by session name + proximity to a target date
export const findSessionKey = async (
  year: number,
  sessionName: string,
  targetDateIso: string,
  windowHours: number = 24
): Promise<number | null> => {
  const cacheKey = `of1_session:${year}:${sessionName}:${targetDateIso}`;
  if (cacheKey in sessionKeyCache) return sessionKeyCache[cacheKey];

  try {
    const response = await axios.get(`${OPENF1_API_URL}/sessions`, {
      params: { session_name: sessionName, year }
    });
    const sessions: OpenF1Session[] = response.data;
    const targetTime = new Date(targetDateIso).getTime();
    const windowMs = windowHours * 60 * 60 * 1000;

    const candidates = sessions
      .filter(s => Math.abs(new Date(s.date_start).getTime() - targetTime) < windowMs)
      .sort((a, b) =>
        Math.abs(new Date(a.date_start).getTime() - targetTime) -
        Math.abs(new Date(b.date_start).getTime() - targetTime)
      );

    const key = candidates[0]?.session_key ?? null;
    sessionKeyCache[cacheKey] = key;
    return key;
  } catch (error) {
    console.error(`Error finding OpenF1 session key for ${sessionName}:`, error);
    return null;
  }
};

export const getQualifyingSessionKey = async (year: number, raceDateIso: string): Promise<number | null> => {
  // Qualifying is 1–2 days before the race
  return findSessionKey(year, 'Qualifying', raceDateIso, 72);
};

export const getRaceSessionKey = async (year: number, raceDateIso: string): Promise<number | null> => {
  return findSessionKey(year, 'Race', raceDateIso, 12);
};

export const getSprintSessionKey = async (year: number, sprintDateIso: string): Promise<number | null> => {
  return findSessionKey(year, 'Sprint', sprintDateIso, 12);
};

export const getSprintQualifyingSessionKey = async (year: number, sprintDateIso: string): Promise<number | null> => {
  // Sprint qualifying is 1–2 days before the sprint race
  return findSessionKey(year, 'Sprint Qualifying', sprintDateIso, 72);
};

export const getQualifyingResults = async (sessionKey: number): Promise<OpenF1QualifyingResult[]> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/session_result`, {
      params: { session_key: sessionKey }
    });
    const raw: any[] = response.data;
    return raw
      .filter(r => !r.dnf && !r.dns)
      .sort((a, b) => a.position - b.position)
      .map(r => ({
        position:      r.position,
        driver_number: r.driver_number,
        q1:            secondsToTimeStr(r.duration?.[0]),
        q2:            secondsToTimeStr(r.duration?.[1]),
        q3:            secondsToTimeStr(r.duration?.[2]),
        dnf:           r.dnf,
        dsq:           r.dsq,
        session_key:   r.session_key,
      }));
  } catch (error) {
    console.error('Error fetching qualifying results from OpenF1:', error);
    return [];
  }
};

export interface OpenF1RaceResult {
  session_key: number;
  driver_number: number;
  position: number;
  points: number;
  dnf: boolean;
  dsq: boolean;
  dns: boolean;
}

// Fetch race or sprint race results for a session
export const getRaceResults = async (sessionKey: number): Promise<OpenF1RaceResult[]> => {
  const cacheKey = `of1_race_results:${sessionKey}`;
  const cached = f1Cache.get<OpenF1RaceResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${OPENF1_API_URL}/session_result`, {
      params: { session_key: sessionKey }
    });
    const raw: any[] = response.data;
    if (!raw || raw.length === 0) return [];

    const results = raw
      .sort((a, b) => a.position - b.position)
      .map(r => ({
        session_key: r.session_key,
        driver_number: r.driver_number,
        position: r.position,
        points: r.points ?? 0,
        dnf: r.dnf ?? false,
        dsq: r.dsq ?? false,
        dns: r.dns ?? false,
      }));

    // Only cache completed sessions (all 20 drivers present)
    if (results.length >= 15) {
      f1Cache.set(cacheKey, results, CACHE_TTL.COMPLETED_SESSION);
    }
    return results;
  } catch (error) {
    console.error('Error fetching race results from OpenF1:', error);
    return [];
  }
};

export const getLatestDrivers = async (): Promise<OpenF1Driver[]> => {
  try {
    // Get the latest session to fetch current drivers
    const meetings = await getMeetings(2026);
    if (meetings.length === 0) return [];

    const latestMeeting = meetings[meetings.length - 1];
    const sessions = await getSessions(latestMeeting.meeting_key);

    if (sessions.length === 0) return [];

    const latestSession = sessions[sessions.length - 1];
    return await getDrivers(latestSession.session_key);
  } catch (error) {
    console.error('Error fetching latest drivers:', error);
    return [];
  }
};
