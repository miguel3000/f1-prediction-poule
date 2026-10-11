import { Request, Response } from 'express';
import { query } from '../config/database';
import { isDnfStatus } from '../utils/resultStatus';

// Real example for the public Tutorial page: the latest finished main race that
// Claude's own player account (Gaston Mazzacane) predicted with a first-retirement
// pick, shown as predicted order, finishing positions and points. Only this one
// account is ever exposed here, and only its predictions for a finished race.
const SHOWCASE_NICKNAME = 'Gaston Mazzacane%';
const MAIN_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

let cached: { at: number; body: any } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export const getTutorialExample = async (_req: Request, res: Response) => {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) return res.json(cached.body);

    const predictionResult = await query(
      `SELECT p.*, r.race_name, r.round
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       JOIN races r ON r.id = p.race_id
       WHERE u.nickname ILIKE $1 AND r.race_type = 'main'
         AND r.status IN ('completed', 'provisional') AND p.dnf_pick IS NOT NULL
       ORDER BY r.race_date DESC LIMIT 1`,
      [SHOWCASE_NICKNAME]
    );
    if (predictionResult.rows.length === 0) return res.json({ available: false });
    const prediction = predictionResult.rows[0];

    const resultsResult = await query(
      `SELECT rr.driver_id, rr.position, rr.status
       FROM race_results rr WHERE rr.race_id = $1 ORDER BY rr.position ASC`,
      [prediction.race_id]
    );
    const results = resultsResult.rows;
    if (results.length === 0) return res.json({ available: false });

    const driverIds = [
      ...Array.from({ length: 10 }, (_, i) => prediction[`position_${i + 1}`]),
      prediction.dnf_pick,
      ...results.filter((r: any) => isDnfStatus(r.status)).map((r: any) => r.driver_id),
    ].filter(Boolean);
    const driversResult = await query('SELECT id, driver_number, name FROM drivers WHERE id = ANY($1)', [driverIds]);
    const drivers = new Map<number, { number: number; name: string }>(
      driversResult.rows.map((d: any) => [d.id, { number: d.driver_number, name: d.name }])
    );

    // The same scoring the site uses: points come from the predicted position, full for an
    // exact finish, half (rounded) for one position off, nothing otherwise or outside the top 10.
    const rows = Array.from({ length: 10 }, (_, i) => {
      const position = i + 1;
      const driverId = prediction[`position_${position}`];
      const finished = results.find((r: any) => r.driver_id === driverId)?.position ?? null;
      const base = MAIN_POINTS[i];
      let points = 0;
      if (finished !== null && finished <= 10) {
        const diff = Math.abs(position - finished);
        if (diff === 0) points = base;
        else if (diff === 1) points = Math.round(base * 0.5);
      }
      const driver = drivers.get(driverId);
      return { position, number: driver?.number ?? null, name: driver?.name ?? '', finished, base, points };
    });

    // First out = the retirement classified last (completed the fewest laps)
    const retirements = results.filter((r: any) => isDnfStatus(r.status));
    const firstOut = retirements.length > 0 ? retirements.reduce((w: any, r: any) => (r.position > w.position ? r : w)) : null;
    const bonus = firstOut && firstOut.driver_id === prediction.dnf_pick ? 25 : 0;
    const pick = drivers.get(prediction.dnf_pick);

    const body = {
      available: true,
      player: 'Gaston Mazzacane',
      race: { name: prediction.race_name, round: prediction.round },
      rows,
      dnf: {
        pickNumber: pick?.number ?? null,
        pickName: pick?.name ?? '',
        firstOutName: firstOut ? drivers.get(firstOut.driver_id)?.name ?? '' : null,
        bonus,
      },
      total: rows.reduce((sum, r) => sum + r.points, 0) + bonus,
      // Sanity check against the stored score, for logs and tests
      matchesStored: prediction.points_earned === rows.reduce((sum, r) => sum + r.points, 0) + bonus,
    };
    if (!body.matchesStored) console.warn('Tutorial example total differs from the stored points', prediction.points_earned, body.total);

    cached = { at: Date.now(), body };
    res.json(body);
  } catch (error) {
    console.error('Tutorial example error:', error);
    res.status(500).json({ error: 'Failed to load the example' });
  }
};
