import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENF1_API_URL = process.env.OPENF1_API_URL || 'https://api.openf1.org/v1';

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

export const getQualifyingSessionKey = async (year: number, raceDateIso: string): Promise<number | null> => {
  try {
    const response = await axios.get(`${OPENF1_API_URL}/sessions`, {
      params: { session_name: 'Qualifying', year }
    });
    const sessions: OpenF1Session[] = response.data;
    const raceTime = new Date(raceDateIso).getTime();
    // Qualifying is 1–2 days before the race; find the closest session before raceDate
    const candidates = sessions
      .filter(s => {
        const diff = raceTime - new Date(s.date_start).getTime();
        return diff > 0 && diff < 4 * 24 * 60 * 60 * 1000; // within 4 days before race
      })
      .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
    return candidates[0]?.session_key ?? null;
  } catch (error) {
    console.error('Error finding qualifying session key from OpenF1:', error);
    return null;
  }
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
