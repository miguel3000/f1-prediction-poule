import type { lb as en_lb } from '../en/lb';

export const lb: Record<keyof typeof en_lb, string> = {
  'lb.title': 'Kampioenschap',
  'lb.loading': 'Klassement laden...',
  'lb.progression': 'Seizoensverloop',
  'lb.afterFirstRace': 'Seizoensgegevens zijn beschikbaar na de eerste afgeronde race.',
  'lb.fullStandings': 'Volledig klassement',
  'lb.noUsers': 'Nog geen spelers hebben voorspellingen gedaan',
  'lb.last': 'Laatste: {pts}',
  'lb.best': 'Beste: {pts} ({name})',
  'lb.leader': 'Leider',
  'lb.playerStats': 'Spelerstatistieken',
  'lb.statsAfterFirstRace': 'Statistieken zijn beschikbaar na de eerste afgeronde race.',
  'lb.bestRacePre': 'Beste race:',
  'lb.noPredictions': 'Dit seizoen nog geen voorspellingen.',
  'lb.avgRace': 'Gem./race',
  'lb.accuracy': '% Nauwkeurigheid',
  'lb.exact': 'Exacte picks',
  'lb.streak': 'Reeks',
};
