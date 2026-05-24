import { Request, Response } from 'express';
import { query } from '../config/database';
import * as openF1Service from '../services/openF1Service';
import * as jolpiService from '../services/jolpiService';

export const getDrivers = async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const seasonYear = season ? parseInt(season as string) : 2026;

    const result = await query(
      'SELECT * FROM drivers WHERE season = $1 ORDER BY total_points DESC',
      [seasonYear]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ error: 'Failed to get drivers' });
  }
};

export const getDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM drivers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ error: 'Failed to get driver' });
  }
};

export const getDriverStandings = async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const seasonYear = season ? parseInt(season as string) : 2026;

    const result = await query(
      'SELECT * FROM drivers WHERE season = $1 ORDER BY total_points DESC, name ASC',
      [seasonYear]
    );

    // Get the most recent update timestamp
    const lastUpdateResult = await query(
      'SELECT MAX(updated_at) as last_updated FROM drivers WHERE season = $1',
      [seasonYear]
    );

    const lastUpdated = lastUpdateResult.rows[0]?.last_updated || null;

    res.json({
      drivers: result.rows,
      lastUpdated
    });
  } catch (error) {
    console.error('Get driver standings error:', error);
    res.status(500).json({ error: 'Failed to get driver standings' });
  }
};

export const syncDrivers = async (req: Request, res: Response) => {
  try {
    const season = 2026;

    // Try OpenF1 first, fallback to Jolpi
    let drivers;
    try {
      const openF1Drivers = await openF1Service.getLatestDrivers();
      drivers = openF1Drivers.map(d => ({
        number: d.driver_number,
        name: d.full_name,
        nameAcronym: d.name_acronym,
        team: d.team_name,
        nationality: d.country_code,
        image_url: d.headshot_url || null,
      }));
    } catch {
      // Fallback to Jolpi
      const jolpiDrivers = await jolpiService.getDrivers(season);
      drivers = jolpiDrivers.map(d => ({
        number: parseInt(d.permanentNumber),
        name: `${d.givenName} ${d.familyName}`,
        nameAcronym: d.code || d.familyName.substring(0, 3).toUpperCase(),
        team: 'Unknown', // Jolpi doesn't provide team in drivers endpoint
        nationality: d.nationality,
        image_url: null,
      }));
    }

    // Insert/update basic driver info
    for (const driver of drivers) {
      await query(
        `INSERT INTO drivers (driver_number, name, name_acronym, team, nationality, image_url, season)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (driver_number, season) DO UPDATE SET
           name = EXCLUDED.name,
           name_acronym = EXCLUDED.name_acronym,
           team = EXCLUDED.team,
           nationality = EXCLUDED.nationality,
           image_url = COALESCE(EXCLUDED.image_url, drivers.image_url)`,
        [driver.number, driver.name, driver.nameAcronym, driver.team, driver.nationality, driver.image_url ?? null, season]
      );
    }

    // Fetch and update championship points from Jolpi
    try {
      const standings = await jolpiService.getDriverStandings(season);
      let pointsUpdated = 0;

      for (const standing of standings) {
        const driverNumber = parseInt(standing.Driver.permanentNumber);
        const points = parseInt(standing.points);

        const updateResult = await query(
          `UPDATE drivers
           SET total_points = $1, updated_at = CURRENT_TIMESTAMP
           WHERE driver_number = $2 AND season = $3`,
          [points, driverNumber, season]
        );

        if (updateResult.rowCount && updateResult.rowCount > 0) {
          pointsUpdated++;
        }
      }

      res.json({
        message: 'Drivers synchronized successfully',
        driversCount: drivers.length,
        pointsUpdated
      });
    } catch (standingsError) {
      console.error('Error syncing driver points:', standingsError);
      // Still return success for driver info, but note points sync failed
      res.json({
        message: 'Drivers synchronized (basic info only)',
        driversCount: drivers.length,
        pointsWarning: 'Failed to sync championship points'
      });
    }
  } catch (error) {
    console.error('Sync drivers error:', error);
    res.status(500).json({ error: 'Failed to sync drivers' });
  }
};

export const syncDriverStandings = async (req: Request, res: Response) => {
  try {
    const season = 2026;
    const standings = await jolpiService.getDriverStandings(season);

    // Fetch all existing drivers for this season (single query)
    const existingDrivers = await query(
      'SELECT id, driver_number, UPPER(name) as name_upper FROM drivers WHERE season = $1',
      [season]
    );
    const driverByNumber = new Map(existingDrivers.rows.map((d: any) => [d.driver_number, d.id]));
    const driverByName = new Map(existingDrivers.rows.map((d: any) => [d.name_upper, d.id]));

    // Build batch update data
    const updatesByNumber: { id: number; points: number; nationality: string }[] = [];
    const updatesByName: { id: number; points: number; nationality: string }[] = [];
    let notFound = 0;

    for (const standing of standings) {
      const driverNumber = parseInt(standing.Driver.permanentNumber);
      const points = parseInt(standing.points);
      const driverName = `${standing.Driver.givenName} ${standing.Driver.familyName}`;
      const nationality = standing.Driver.nationality;

      // Try matching by driver number first
      let driverId = driverByNumber.get(driverNumber);
      if (driverId) {
        updatesByNumber.push({ id: driverId, points, nationality });
      } else {
        // Try matching by name
        driverId = driverByName.get(driverName.toUpperCase());
        if (driverId) {
          updatesByName.push({ id: driverId, points, nationality });
        } else {
          notFound++;
          console.log(`Driver ${driverName} (#${driverNumber}) not found in database`);
        }
      }
    }

    // Batch update using a single query with CASE statements
    const allUpdates = [...updatesByNumber, ...updatesByName];
    if (allUpdates.length > 0) {
      const ids = allUpdates.map(u => u.id);
      const pointsCases = allUpdates.map(u => `WHEN ${u.id} THEN ${u.points}`).join(' ');
      const nationalityCases = allUpdates.map(u => `WHEN ${u.id} THEN '${u.nationality.replace(/'/g, "''")}'`).join(' ');

      await query(
        `UPDATE drivers
         SET total_points = CASE id ${pointsCases} END,
             nationality = CASE id ${nationalityCases} END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1)`,
        [ids]
      );
    }

    res.json({
      message: 'Driver standings synchronized successfully',
      updated: allUpdates.length,
      notFound,
      nameMatched: updatesByName.length,
      total: standings.length
    });
  } catch (error) {
    console.error('Sync driver standings error:', error);
    res.status(500).json({ error: 'Failed to sync driver standings' });
  }
};
