// Result statuses arrive in different words depending on the source (Jolpi:
// "Finished", "+1 Lap", "Retired", "Collision", "Did not start"...). Everything
// that needs to know what a status means goes through here.

export type NormalizedStatus = 'finished' | 'dnf' | 'dns' | 'dsq';

export const normalizeStatus = (status: string | null | undefined): NormalizedStatus => {
  const s = (status ?? '').trim().toLowerCase();
  if (s === '' || s === 'finished' || s === 'lapped' || /^\+\d+ laps?$/.test(s)) return 'finished';
  if (s === 'did not start' || s === 'dns' || s === 'did not qualify' || s === 'withdrew') return 'dns';
  if (s === 'disqualified' || s === 'dsq' || s === 'excluded') return 'dsq';
  // Anything else (Retired, Accident, Collision, Engine, Gearbox, 'dnf'...) is a retirement.
  return 'dnf';
};

// "Retired" is what Jolpi's results use; these are the words we store for rows
// that come from a source with only flags (OpenF1, the live feed).
export const dbStatusFor = (status: NormalizedStatus): string =>
  ({ finished: 'Finished', dnf: 'Retired', dns: 'Did not start', dsq: 'Disqualified' })[status];

export const isDnfStatus = (status: string | null | undefined): boolean => normalizeStatus(status) === 'dnf';

// The driver who retired first: of the retirements, the one classified last (fewest laps). DNS and
// disqualified are not retirements. Null when nobody retired, and then nobody earns the bonus.
export const firstOutDriverId = (
  results: Array<{ driver_id: number; position: number; status: string | null }>
): number | null => {
  const retirements = results.filter((r) => isDnfStatus(r.status));
  if (retirements.length === 0) return null;
  return retirements.reduce((last, r) => (r.position > last.position ? r : last), retirements[0]).driver_id;
};
