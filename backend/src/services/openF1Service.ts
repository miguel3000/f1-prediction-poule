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
