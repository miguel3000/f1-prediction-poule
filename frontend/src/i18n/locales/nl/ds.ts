import type { ds as en_ds } from '../en/ds';

export const ds: Record<keyof typeof en_ds, string> = {
  'ds.title': '{year} Coureurskampioenschap',
  'ds.loading': 'Coureursklassement laden...',
  'ds.updated': 'Bijgewerkt:',
  'ds.next': 'Volgende:',
  'ds.never': 'Nooit',
  'ds.none': 'Nog geen coureursklassement beschikbaar',
  'ds.noneSub': 'Het klassement wordt bijgewerkt na de eerste race',
  'ds.points': 'Punten',
  'ds.wins': 'Zeges',
  'ds.podiums': 'Podiums',
};
