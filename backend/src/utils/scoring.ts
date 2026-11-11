export type PickHit = 'exact' | 'near' | 'miss';

// The scoring rule for one pick, in one place: the driver finished exactly where predicted (full
// points), one place off (half the points of the predicted position) or anything else, including
// finishing outside the scored positions (nothing). `actualPosition` is undefined when the driver
// is not in the results at all.
export const judgePick = (
  predictedPosition: number,
  actualPosition: number | undefined,
  scoredPositions: number
): PickHit => {
  if (actualPosition === undefined || actualPosition > scoredPositions) return 'miss';
  const difference = Math.abs(predictedPosition - actualPosition);
  return difference === 0 ? 'exact' : difference === 1 ? 'near' : 'miss';
};
