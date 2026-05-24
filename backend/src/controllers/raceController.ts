import { Request, Response } from 'express';
import { query } from '../config/database';
import * as openF1Service from '../services/openF1Service';
import * as jolpiService from '../services/jolpiService';
import { calculateRacePoints } from './leaderboardController';

// Get qualifying order for a race (with fallback to previous race results)
export const getQualifyingOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const raceId = parseInt(id);

    // First check if we have stored qualifying results
    const storedQualifying = await query(
      `SELECT qr.position, qr.q1, qr.q2, qr.q3, d.id, d.driver_number, d.name, d.name_acronym, d.team, d.image_url
       FROM qualifying_results qr
       JOIN drivers d ON qr.driver_id = d.id
       WHERE qr.race_id = $1
       ORDER BY qr.position ASC`,
      [raceId]
    );

    if (storedQualifying.rows.length > 0) {
      return res.json({
        source: 'qualifying',
        hasQualifyingResults: true,
        drivers: storedQualifying.rows
      });
    }

    // Get race info to fetch from API or find previous race
    const raceResult = await query('SELECT * FROM races WHERE id = $1', [raceId]);
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    // Try to fetch qualifying from Jolpi API
    try {
      const qualifyingResults = await jolpiService.getQualifyingResults(race.season, race.round);

      if (qualifyingResults.length > 0) {
        // Map qualifying results to drivers in our database
        const driverNumbers = qualifyingResults.map(q => parseInt(q.number));
        const driversResult = await query(
          `SELECT id, driver_number, name, name_acronym, team, image_url
           FROM drivers WHERE driver_number = ANY($1) AND season = $2`,
          [driverNumbers, race.season]
        );
        const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d]));

        const orderedDrivers = qualifyingResults.map((q, index) => {
          const driver = driverMap.get(parseInt(q.number));
          return driver ? { ...driver, position: index + 1, q1: q.Q1 || null, q2: q.Q2 || null, q3: q.Q3 || null } : null;
        }).filter(d => d !== null);

        // Store qualifying results for future use (with Q1/Q2/Q3 times)
        for (const driver of orderedDrivers) {
          await query(
            `INSERT INTO qualifying_results (race_id, driver_id, position, q1, q2, q3)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (race_id, driver_id) DO UPDATE SET position = EXCLUDED.position, q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, q3 = EXCLUDED.q3`,
            [raceId, driver.id, driver.position, driver.q1, driver.q2, driver.q3]
          );
        }

        return res.json({
          source: 'qualifying',
          hasQualifyingResults: true,
          drivers: orderedDrivers
        });
      }
    } catch (error) {
      console.log('Qualifying not available, falling back to previous race results');
    }

    // Fallback: Get previous race results
    const previousRaceResult = await query(
      `SELECT id FROM races
       WHERE season = $1 AND round < $2
       ORDER BY round DESC LIMIT 1`,
      [race.season, race.round]
    );

    if (previousRaceResult.rows.length > 0) {
      const previousRaceId = previousRaceResult.rows[0].id;
      const previousResults = await query(
        `SELECT rr.position, d.id, d.driver_number, d.name, d.name_acronym, d.team, d.image_url
         FROM race_results rr
         JOIN drivers d ON rr.driver_id = d.id
         WHERE rr.race_id = $1
         ORDER BY rr.position ASC`,
        [previousRaceId]
      );

      if (previousResults.rows.length > 0) {
        return res.json({
          source: 'previous_race',
          hasQualifyingResults: false,
          drivers: previousResults.rows
        });
      }
    }

    // Final fallback: championship order
    const championshipOrder = await query(
      `SELECT id, driver_number, name, name_acronym, team, image_url, total_points
       FROM drivers
       WHERE season = $1
       ORDER BY total_points DESC, name ASC`,
      [race.season]
    );

    res.json({
      source: 'championship',
      hasQualifyingResults: false,
      drivers: championshipOrder.rows.map((d: any, index: number) => ({
        ...d,
        position: index + 1
      }))
    });
  } catch (error) {
    console.error('Get qualifying order error:', error);
    res.status(500).json({ error: 'Failed to get qualifying order' });
  }
};

export const getRaces = async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const seasonYear = season ? parseInt(season as string) : 2026;

    const result = await query(
      'SELECT * FROM races WHERE season = $1 ORDER BY round ASC',
      [seasonYear]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get races error:', error);
    res.status(500).json({ error: 'Failed to get races' });
  }
};

export const getRace = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM races WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get race error:', error);
    res.status(500).json({ error: 'Failed to get race' });
  }
};

export const getNextRace = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM races
       WHERE race_date > NOW() AND status = 'upcoming'
       ORDER BY race_date ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No upcoming races found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get next race error:', error);
    res.status(500).json({ error: 'Failed to get next race' });
  }
};

// Get upcoming races for the next race weekend (both sprint and main if applicable)
export const getUpcomingRaces = async (req: Request, res: Response) => {
  try {
    // Get the next upcoming race to find its round
    const nextResult = await query(
      `SELECT season, round FROM races
       WHERE race_date > NOW() AND status = 'upcoming'
       ORDER BY race_date ASC
       LIMIT 1`
    );

    if (nextResult.rows.length === 0) {
      return res.status(404).json({ error: 'No upcoming races found' });
    }

    const { season, round } = nextResult.rows[0];

    // Get all races (sprint and main) for this round
    const result = await query(
      `SELECT * FROM races
       WHERE season = $1 AND round = $2
       ORDER BY race_date ASC`,
      [season, round]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get upcoming races error:', error);
    res.status(500).json({ error: 'Failed to get upcoming races' });
  }
};

export const getRaceResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT rr.*, d.name as driver_name, d.driver_number, d.team
       FROM race_results rr
       JOIN drivers d ON rr.driver_id = d.id
       WHERE rr.race_id = $1
       ORDER BY rr.position ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get race results error:', error);
    res.status(500).json({ error: 'Failed to get race results' });
  }
};

// F1 2026 sprint race rounds: China, Miami, Canada, Great Britain, Netherlands, Singapore
const SPRINT_ROUNDS_2026 = [2, 6, 7, 11, 14, 18];

export const syncRaces = async (req: Request, res: Response) => {
  try {
    // Fetch races from Jolpi API
    const jolpiRaces = await jolpiService.getRaces(2026);
    let totalCount = 0;

    for (const race of jolpiRaces) {
      const raceDate = new Date(`${race.date}T${race.time || '00:00:00'}`);
      const roundNum = parseInt(race.round);
      const hasSprint = SPRINT_ROUNDS_2026.includes(roundNum);

      // Build qualifying date if available
      const qualifyingDate = race.Qualifying
        ? new Date(`${race.Qualifying.date}T${race.Qualifying.time}`)
        : null;

      // Insert main race
      await query(
        `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, qualifying_date, race_time, race_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (season, round, race_type) DO UPDATE SET
           race_name = EXCLUDED.race_name,
           circuit_name = EXCLUDED.circuit_name,
           country = EXCLUDED.country,
           race_date = EXCLUDED.race_date,
           qualifying_date = EXCLUDED.qualifying_date,
           race_time = EXCLUDED.race_time`,
        [
          parseInt(race.season),
          roundNum,
          race.raceName,
          race.Circuit.circuitName,
          race.Circuit.Location.country,
          raceDate,
          qualifyingDate,
          race.time,
          'main',
          new Date() > raceDate ? 'completed' : 'upcoming'
        ]
      );
      totalCount++;

      // Insert sprint race if this round has one
      if (hasSprint) {
        // Sprint is typically Saturday, main race Sunday - subtract 1 day
        const sprintDate = new Date(raceDate);
        sprintDate.setDate(sprintDate.getDate() - 1);
        // Sprint usually at different time (around 11:00 or 12:00 local)
        sprintDate.setHours(11, 0, 0, 0);

        await query(
          `INSERT INTO races (season, round, race_name, circuit_name, country, race_date, race_time, race_type, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (season, round, race_type) DO UPDATE SET
             race_name = EXCLUDED.race_name,
             circuit_name = EXCLUDED.circuit_name,
             country = EXCLUDED.country,
             race_date = EXCLUDED.race_date,
             race_time = EXCLUDED.race_time`,
          [
            parseInt(race.season),
            roundNum,
            `${race.raceName} Sprint`,
            race.Circuit.circuitName,
            race.Circuit.Location.country,
            sprintDate,
            '11:00:00Z',
            'sprint',
            new Date() > sprintDate ? 'completed' : 'upcoming'
          ]
        );
        totalCount++;
      }
    }

    res.json({ message: 'Races synchronized successfully', mainRaces: jolpiRaces.length, totalWithSprints: totalCount });
  } catch (error) {
    console.error('Sync races error:', error);
    res.status(500).json({ error: 'Failed to sync races' });
  }
};

export const syncRaceResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get race info
    const raceResult = await query('SELECT * FROM races WHERE id = $1', [id]);

    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    // Fetch results from Jolpi API
    const jolpiResults = await jolpiService.getRaceResults(race.season, race.round);

    if (jolpiResults.length === 0) {
      return res.status(404).json({ error: 'No results found for this race' });
    }

    // Clear existing results for this race
    await query('DELETE FROM race_results WHERE race_id = $1', [id]);

    // Batch fetch all drivers by their numbers (single query instead of N queries)
    const driverNumbers = jolpiResults.map((r: any) => parseInt(r.number));
    const driversResult = await query(
      'SELECT id, driver_number FROM drivers WHERE driver_number = ANY($1) AND season = $2',
      [driverNumbers, race.season]
    );
    const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d.id]));

    // Build batch insert values
    const insertValues: any[] = [];
    const insertParams: any[] = [];
    let paramIndex = 1;

    for (const result of jolpiResults) {
      const driverNumber = parseInt(result.number);
      const driverId = driverMap.get(driverNumber);

      if (driverId) {
        insertValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
        insertParams.push(id, driverId, parseInt(result.position), parseFloat(result.points), result.status);
        paramIndex += 5;
      }
    }

    // Single batch insert for all results
    if (insertValues.length > 0) {
      await query(
        `INSERT INTO race_results (race_id, driver_id, position, points, status)
         VALUES ${insertValues.join(', ')}`,
        insertParams
      );
    }

    // Update race status to completed
    await query(
      'UPDATE races SET status = $1 WHERE id = $2',
      ['completed', id]
    );

    // Calculate points for all predictions
    await calculateRacePoints(parseInt(id));

    res.json({
      message: 'Race results synchronized and points calculated successfully',
      resultsCount: jolpiResults.length
    });
  } catch (error) {
    console.error('Sync race results error:', error);
    res.status(500).json({ error: 'Failed to sync race results' });
  }
};
