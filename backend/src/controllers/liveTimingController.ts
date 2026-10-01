import { Request, Response } from 'express';
import { getLiveTimingSnapshot } from '../services/liveTimingService';

export const getLiveTiming = async (req: Request, res: Response) => {
  res.json(getLiveTimingSnapshot());
};
