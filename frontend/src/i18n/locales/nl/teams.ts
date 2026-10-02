import type { teams as en_teams } from '../en/teams';

export const teams: Record<keyof typeof en_teams, string> = {
  'teams.title': '{year} F1-teams',
  'teams.subtitle': '11 teams - 22 racecoureurs',
  'teams.new': 'NIEUW IN 2026',
  'teams.powerUnit': 'Motor:',
  'teams.raceDrivers': 'Racecoureurs',
  'teams.reserves': 'Reserve- en testcoureurs',
  'teams.roleRace': 'Racecoureur',
  'teams.roleReserve': 'Reservecoureur',
  'teams.roleTest': 'Testcoureur',
  'teams.note': 'Coureursopstelling per januari 2026. Wijzigingen voorbehouden.',
  'teams.sources': 'Bronnen:',
  'teams.pts': 'ptn',
  'teams.wins': 'zeges',
};
