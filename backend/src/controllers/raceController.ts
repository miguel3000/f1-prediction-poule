import { Request, Response } from 'express';
import { query } from '../config/database';
import * as openF1Service from '../services/openF1Service';
import * as jolpiService from '../services/jolpiService';

// Get qualifying order for a race (with fallback to previous race results)
// A qualifying list must never leave a driver out of the prediction picker: anyone
// the session data lacks (no time set, data gap) is added after the classified
// drivers, in championship order, with no grid position.
const withAllDrivers = async (season: number, classified: any[]) => {
  const have = new Set(classified.map((d: any) => d.id));
  const all = await query(
    `SELECT id, driver_number, name, name_acronym, team, image_url
     FROM drivers WHERE season = $1 ORDER BY total_points DESC, name ASC`,
    [season]
  );
  const missing = all.rows
    .filter((d: any) => !have.has(d.id))
    .map((d: any) => ({ ...d, position: null, q1: null, q2: null, q3: null }));
  return [...classified, ...missing];
};

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

    // Get race info to fetch from API or find previous race
    const raceResult = await query('SELECT * FROM races WHERE id = $1', [raceId]);
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    if (storedQualifying.rows.length > 0) {
      return res.json({
        source: race.race_type === 'sprint' ? 'sprint_qualifying' : 'qualifying',
        hasQualifyingResults: true,
        drivers: await withAllDrivers(race.season, storedQualifying.rows)
      });
    }

    // For sprint races, try sprint qualifying (SQ) results; otherwise regular qualifying
    if (race.race_type === 'sprint') {
      // Jolpi/Ergast has no sprint qualifying endpoint at all (it 400s for every round),
      // so the sprint grid comes from OpenF1 and is stored for next time.
      try {
        const sessionKey = await openF1Service.getSprintQualifyingSessionKey(race.season, race.race_date);
        const sqResults = sessionKey ? await openF1Service.getQualifyingResults(sessionKey) : [];

        if (sqResults.length > 0) {
          const driverNumbers = sqResults.map(q => q.driver_number);
          const driversResult = await query(
            `SELECT id, driver_number, name, name_acronym, team, image_url
             FROM drivers WHERE driver_number = ANY($1) AND season = $2`,
            [driverNumbers, race.season]
          );
          const driverMap = new Map(driversResult.rows.map((d: any) => [d.driver_number, d]));

          const orderedDrivers = sqResults.map((q) => {
            const driver = driverMap.get(q.driver_number);
            return driver ? { ...driver, position: q.position, q1: q.q1 || null, q2: q.q2 || null, q3: q.q3 || null } : null;
          }).filter(d => d !== null);

          for (const driver of orderedDrivers) {
            await query(
              `INSERT INTO qualifying_results (race_id, driver_id, position, q1, q2, q3)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (race_id, driver_id) DO UPDATE SET position = EXCLUDED.position, q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, q3 = EXCLUDED.q3`,
              [raceId, driver.id, driver.position, driver.q1, driver.q2, driver.q3]
            );
          }

          return res.json({
            source: 'sprint_qualifying',
            hasQualifyingResults: true,
            drivers: await withAllDrivers(race.season, orderedDrivers)
          });
        }
      } catch (error) {
        console.log('Sprint qualifying not available, falling back to previous race results');
      }
    } else {
      // Try to fetch qualifying from Jolpi API
      try {
        const qualifyingResults = await jolpiService.getQualifyingResults(race.season, race.round);

        if (qualifyingResults.length > 0) {
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
            drivers: await withAllDrivers(race.season, orderedDrivers)
          });
        }
      } catch (error) {
        console.log('Qualifying not available, falling back to previous race results');
      }
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


export const syncRaces = async (req: Request, res: Response) => {
  try {
    // Fetch races from Jolpi API
    const jolpiRaces = await jolpiService.getRaces(2026);
    let totalCount = 0;

    for (const race of jolpiRaces) {
      const raceDate = new Date(`${race.date}T${race.time || '00:00:00'}`);
      const roundNum = parseInt(race.round);
      // A weekend has a sprint exactly when the official schedule lists a Sprint session —
      // never from a hand-kept list of round numbers (the 2026 calendar's numbering differs
      // from the one such a list was written for).
      const hasSprint = !!race.Sprint?.date;

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
        // The sprint's real start from the schedule (UTC), which is also when its predictions lock
        const sprintTime = race.Sprint!.time ?? '00:00:00Z';
        const sprintDate = new Date(`${race.Sprint!.date}T${sprintTime.endsWith('Z') ? sprintTime : `${sprintTime}Z`}`);

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
            race.Sprint!.time ?? '00:00:00Z',
            'sprint',
            new Date() > sprintDate ? 'completed' : 'upcoming'
          ]
        );
        totalCount++;
      }
    }

    // Remove sprint rows the official schedule does not list (e.g. left by an older, wrong
    // sprint list). Only rows nobody has used: with predictions or results they are kept.
    const sprintRounds = jolpiRaces.filter((r) => r.Sprint?.date).map((r) => parseInt(r.round));
    if (jolpiRaces.length > 0) {
      const removed = await query(
        `DELETE FROM races r
         WHERE r.season = $1 AND r.race_type = 'sprint' AND r.round <> ALL($2::int[])
           AND NOT EXISTS (SELECT 1 FROM sprint_predictions WHERE race_id = r.id)
           AND NOT EXISTS (SELECT 1 FROM sprint_results WHERE race_id = r.id)`,
        [2026, sprintRounds]
      );
      if (removed.rowCount) console.log(`Removed ${removed.rowCount} sprint row(s) not in the official schedule`);
    }

    res.json({ message: 'Races synchronized successfully', mainRaces: jolpiRaces.length, totalWithSprints: totalCount });
  } catch (error) {
    console.error('Sync races error:', error);
    res.status(500).json({ error: 'Failed to sync races' });
  }
};


// Every session of every race weekend of a season with its start time (UTC ISO,
// oldest first), keyed by round. Jolpi's calendar has the whole schedule (practice,
// sprint qualifying, sprint, qualifying, race) and is cached, so this is one call for
// all rounds. When Jolpi cannot be reached the weekends are simply empty and the
// pages fall back to the qualifying and race times they already have.
export const getRaceWeekends = async (req: Request, res: Response) => {
  try {
    const season = req.query.season ? parseInt(req.query.season as string, 10) : 2026;
    if (!Number.isInteger(season)) {
      return res.status(400).json({ error: 'Invalid season' });
    }

    const toIso = (s?: { date: string; time?: string }) => {
      if (!s?.date) return null;
      const time = s.time ?? '00:00:00Z';
      const iso = `${s.date}T${time.endsWith('Z') ? time : `${time}Z`}`;
      return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
    };

    const weekends: Record<number, Array<{ key: string; startsAt: string }>> = {};

    try {
      const calendar = await jolpiService.getRaces(season);
      for (const race of calendar) {
        const entries: Array<[string, string | null]> = [
          ['fp1', toIso(race.FirstPractice)],
          ['fp2', toIso(race.SecondPractice)],
          ['fp3', toIso(race.ThirdPractice)],
          ['sprint_qualifying', toIso(race.SprintQualifying ?? race.SprintShootout)],
          ['sprint', toIso(race.Sprint)],
          ['qualifying', toIso(race.Qualifying)],
          ['race', toIso({ date: race.date, time: race.time })],
        ];
        weekends[parseInt(race.round, 10)] = entries
          .filter((e): e is [string, string] => e[1] !== null)
          .map(([key, startsAt]) => ({ key, startsAt }))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      }
    } catch (error) {
      console.error('Weekend schedules from Jolpi failed:', error);
    }

    res.json({ season, weekends });
  } catch (error) {
    console.error('Get race weekends error:', error);
    res.status(500).json({ error: 'Failed to load the race weekends' });
  }
};
