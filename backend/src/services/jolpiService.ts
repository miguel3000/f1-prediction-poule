import axios from 'axios';
import dotenv from 'dotenv';
import { f1Cache, CACHE_TTL } from '../utils/cache';

dotenv.config();

const JOLPI_API_URL = process.env.JOLPI_API_URL || 'https://api.jolpi.ca/ergast/f1';

// Helper to create cache keys
const cacheKey = {
  races: (season: number) => `races:${season}`,
  driverStandings: (season: number) => `standings:${season}`,
  raceResults: (season: number, round: number) => `race:${season}:${round}`,
  qualifying: (season: number, round: number) => `quali:${season}:${round}`,
  sprint: (season: number, round: number) => `sprint:${season}:${round}`,
  practice: (season: number, round: number, session: number) => `fp${session}:${season}:${round}`,
  drivers: (season: number) => `drivers:${season}`,
};

export interface JolpiRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
  date: string;
  time?: string;
  Qualifying?: {
    date: string;
    time: string;
  };
}

export interface JolpiDriver {
  driverId: string;
  permanentNumber: string;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string;
}

export interface JolpiStanding {
  position: string;
  points: string;
  wins: string;
  Driver: JolpiDriver;
  Constructors: Array<{
    constructorId: string;
    name: string;
  }>;
}

export interface JolpiResult {
  number: string;
  position: string;
  points: string;
  Driver: JolpiDriver;
  Constructor: {
    constructorId: string;
    name: string;
  };
  status: string;
}

export const getRaces = async (season: number = 2026): Promise<JolpiRace[]> => {
  const key = cacheKey.races(season);
  const cached = f1Cache.get<JolpiRace[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}.json`);
    const races = response.data.MRData.RaceTable.Races || [];
    f1Cache.set(key, races, CACHE_TTL.RACE_SCHEDULE);
    return races;
  } catch (error) {
    console.error('Error fetching races from Jolpi:', error);
    throw error;
  }
};

export const getDriverStandings = async (season: number = 2026): Promise<JolpiStanding[]> => {
  const key = cacheKey.driverStandings(season);
  const cached = f1Cache.get<JolpiStanding[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/driverStandings.json`);
    const standings = response.data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    f1Cache.set(key, standings, CACHE_TTL.DRIVER_STANDINGS);
    return standings;
  } catch (error) {
    console.error('Error fetching driver standings from Jolpi:', error);
    throw error;
  }
};

export const getRaceResults = async (season: number, round: number): Promise<JolpiResult[]> => {
  const key = cacheKey.raceResults(season, round);
  const cached = f1Cache.get<JolpiResult[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/${round}/results.json`);
    const results = response.data.MRData.RaceTable.Races[0]?.Results || [];
    // Cache race results for 24 hours (completed race data rarely changes)
    f1Cache.set(key, results, CACHE_TTL.COMPLETED_SESSION);
    return results;
  } catch (error) {
    console.error('Error fetching race results from Jolpi:', error);
    throw error;
  }
};

export const getDrivers = async (season: number = 2026): Promise<JolpiDriver[]> => {
  const key = cacheKey.drivers(season);
  const cached = f1Cache.get<JolpiDriver[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/drivers.json`);
    const drivers = response.data.MRData.DriverTable.Drivers || [];
    f1Cache.set(key, drivers, CACHE_TTL.RACE_SCHEDULE);
    return drivers;
  } catch (error) {
    console.error('Error fetching drivers from Jolpi:', error);
    throw error;
  }
};

export interface JolpiQualifyingResult {
  number: string;
  position: string;
  Driver: JolpiDriver;
  Constructor: {
    constructorId: string;
    name: string;
  };
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export const getQualifyingResults = async (season: number, round: number): Promise<JolpiQualifyingResult[]> => {
  const key = cacheKey.qualifying(season, round);
  const cached = f1Cache.get<JolpiQualifyingResult[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/${round}/qualifying.json`);
    const results = response.data.MRData.RaceTable.Races[0]?.QualifyingResults || [];
    f1Cache.set(key, results, CACHE_TTL.COMPLETED_SESSION);
    return results;
  } catch (error) {
    console.error('Error fetching qualifying results from Jolpi:', error);
    throw error;
  }
};

// Get sprint results for a specific round
export const getSprintResults = async (season: number, round: number): Promise<JolpiResult[]> => {
  const key = cacheKey.sprint(season, round);
  const cached = f1Cache.get<JolpiResult[]>(key);
  if (cached) return cached;

  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/${round}/sprint.json`);
    const results = response.data.MRData.RaceTable.Races[0]?.SprintResults || [];
    f1Cache.set(key, results, CACHE_TTL.COMPLETED_SESSION);
    return results;
  } catch (error) {
    console.error('Error fetching sprint results from Jolpi:', error);
    return []; // Return empty array if no sprint for this round
  }
};

// Check if a round has a sprint race
export const hasSprint = async (season: number, round: number): Promise<boolean> => {
  try {
    const response = await axios.get(`${JOLPI_API_URL}/${season}/${round}/sprint.json`);
    const races = response.data.MRData.RaceTable.Races || [];
    return races.length > 0;
  } catch {
    return false;
  }
};

// F1 2026 sprint race rounds: China, Miami, Canada, Great Britain, Netherlands, Singapore
export const SPRINT_ROUNDS_2026 = [2, 6, 7, 11, 14, 18];

// Clear cached results for a specific round (use before force-syncing)
export const clearRaceCache = (season: number, round: number): void => {
  f1Cache.delete(cacheKey.raceResults(season, round));
  f1Cache.delete(cacheKey.sprint(season, round));
  f1Cache.delete(cacheKey.qualifying(season, round));
};

export interface JolpiPracticeResult {
  number: string;
  position: string;
  Driver: JolpiDriver;
  Constructor: {
    constructorId: string;
    name: string;
  };
  Time?: {
    time: string;
  };
  laps: string;
}

// Get practice session results (FP1, FP2, FP3)
export const getPracticeResults = async (season: number, round: number, session: 1 | 2 | 3): Promise<JolpiPracticeResult[]> => {
  const key = cacheKey.practice(season, round, session);
  const cached = f1Cache.get<JolpiPracticeResult[]>(key);
  if (cached) return cached;

  try {
    const endpoint = session === 1 ? 'fp1' : session === 2 ? 'fp2' : 'fp3';
    const response = await axios.get(`${JOLPI_API_URL}/${season}/${round}/${endpoint}.json`);
    const races = response.data.MRData.RaceTable.Races || [];
    if (races.length === 0) return [];

    const sessionKey = session === 1 ? 'FirstPractice' : session === 2 ? 'SecondPractice' : 'ThirdPractice';
    const results = races[0][sessionKey + 'Results'] || races[0].PracticeResults || [];
    f1Cache.set(key, results, CACHE_TTL.COMPLETED_SESSION);
    return results;
  } catch (error) {
    console.error(`Error fetching FP${session} results from Jolpi:`, error);
    return [];
  }
};
