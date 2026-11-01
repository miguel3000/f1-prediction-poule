import { Request, Response } from 'express';
import { query } from '../config/database';
import {
  excludeDriver,
  includeDriver,
  listExclusions,
  DriverExclusionError,
} from '../services/driverExclusionService';
import { sendPredictionResetNotice } from '../services/emailService';
import { activeSeason } from '../services/season';

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof DriverExclusionError) {
    if (error.code === 'too_late') return res.status(400).json({ error: 'That weekend has already started' });
    if (error.code === 'same_driver') return res.status(400).json({ error: 'A driver cannot be their own stand-in' });
    return res.status(404).json({ error: 'Weekend or driver not found' });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

// What the Pitlane card needs: the weekends still to come, every driver, and what is marked now.
export const listDriverExclusions = async (_req: Request, res: Response) => {
  try {
    const season = await activeSeason();
    const [weekends, drivers, exclusions] = await Promise.all([
      query(
        `SELECT DISTINCT ON (round) round, race_name AS name
         FROM races WHERE season = $1 AND race_type = 'main' AND race_date > NOW()
         ORDER BY round, race_date`,
        [season]
      ),
      query('SELECT id, name, driver_number FROM drivers WHERE season = $1 ORDER BY name', [season]),
      listExclusions(season),
    ]);
    res.json({
      weekends: weekends.rows,
      drivers: drivers.rows.map((d: any) => ({ id: d.id, name: d.name, driverNumber: d.driver_number })),
      exclusions,
    });
  } catch (error) {
    sendError(res, error, 'Failed to load the drivers who are not racing');
  }
};

// Marks a driver as not racing a weekend, resets the predictions that use him and emails those
// players. The answer says how many were reset and how many emails went out or failed.
export const addDriverExclusion = async (req: Request, res: Response) => {
  try {
    const { round, driverId, replacedByDriverId } = req.body || {};
    if (!Number.isInteger(round) || !Number.isInteger(driverId)) {
      return res.status(400).json({ error: 'A weekend (round) and a driver are required' });
    }
    if (replacedByDriverId != null && !Number.isInteger(replacedByDriverId)) {
      return res.status(400).json({ error: 'The stand-in must be a driver' });
    }

    const season = await activeSeason();
    const reset = await excludeDriver(season, round, driverId, replacedByDriverId ?? null);

    let emailed = 0;
    let failed = 0;
    for (const r of reset) {
      const ok = await sendPredictionResetNotice(
        r.email,
        r.nickname,
        r.raceName,
        r.isSprint,
        r.driverName,
        r.standInName,
        r.language
      );
      if (ok) emailed++;
      else failed++;
    }
    res.json({ reset: reset.length, emailed, failed });
  } catch (error) {
    sendError(res, error, 'Failed to mark the driver as not racing');
  }
};

export const removeDriverExclusion = async (req: Request, res: Response) => {
  try {
    const round = parseInt(req.params.round, 10);
    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(round) || Number.isNaN(driverId)) {
      return res.status(400).json({ error: 'A weekend (round) and a driver are required' });
    }
    await includeDriver(await activeSeason(), round, driverId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, 'Failed to put the driver back');
  }
};
