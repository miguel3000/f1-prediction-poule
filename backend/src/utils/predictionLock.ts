// The moment predictions lock: PREDICTION_LOCK_MINUTES (default 1) before the start. The same
// moment predictions of other players become visible (group play), so both read it from here.
export const predictionLockTime = (raceDate: Date | string): Date => {
  const parsed = Number.parseInt(process.env.PREDICTION_LOCK_MINUTES ?? '1', 10);
  const minutes = Number.isNaN(parsed) ? 1 : parsed;
  return new Date(new Date(raceDate).getTime() - minutes * 60 * 1000);
};

export const isPredictionLocked = (raceDate: Date | string, now: Date = new Date()): boolean =>
  now.getTime() >= predictionLockTime(raceDate).getTime();
