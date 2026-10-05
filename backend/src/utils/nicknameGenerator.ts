// F1-flavoured nicknames for new players. Everything here is a racing word, a
// driver (current or past) or a piece of kit, so any combination stays on theme.

const ADJECTIVES = [
  'Flat-Out', 'Late-Braking', 'Purple-Sector', 'Slipstream', 'Full-Send', 'Dirty-Air', 'Pole-Position',
  'Red-Flag', 'Safety-Car', 'Chequered', 'Undercut', 'Overcut', 'Lights-Out', 'Fastest-Lap', 'Hot-Lap',
  'Cold-Tyre', 'Soft-Compound', 'Wet-Weather', 'Box-Box', 'Parc-Ferme', 'Lollipop', 'Turbo', 'Hybrid',
  'Mid-Corner', 'Trail-Braking', 'Low-Downforce', 'High-Rake', 'Porpoising', 'Sprint', 'Paddock',
];

const NOUNS = [
  'Apex', 'DRS', 'Chicane', 'Hairpin', 'Kerb', 'Diffuser', 'Halo', 'Podium', 'Pitwall', 'Pit Stop',
  'Pole Sitter', 'Slicks', 'Softs', 'Intermediates', 'Marshal', 'Steward', 'Strategist', 'Engineer',
  'Rear Wing', 'Front Wing', 'Paddock Pass', 'Grid Girl', 'Tifosi', 'Boxbox', 'Overtake', 'Slingshot',
  'Cooldown Lap', 'Formation Lap', 'Clipping Point', 'Gearbox', 'Steering Wheel', 'Brake Bias',
];

// Surnames of current and former drivers, short enough to sit in a template.
const DRIVERS = [
  'Senna', 'Prost', 'Schumi', 'Hakkinen', 'Raikkonen', 'Alonso', 'Vettel', 'Button', 'Webber', 'Rosberg',
  'Hunt', 'Lauda', 'Clark', 'Fangio', 'Mansell', 'Piquet', 'Montoya', 'Coulthard', 'Barrichello', 'Massa',
  'Hamilton', 'Verstappen', 'Norris', 'Leclerc', 'Piastri', 'Russell', 'Antonelli', 'Hadjar', 'Ricciardo',
  'Bottas', 'Sainz', 'Gasly', 'Albon', 'Stroll', 'Hulkenberg', 'Perez', 'Magnussen', 'Grosjean', 'Kubica',
];

// Real race numbers, used as a tie-breaker suffix when a name is taken.
const NUMBERS = [1, 3, 5, 6, 10, 11, 12, 14, 16, 18, 22, 23, 27, 30, 31, 41, 43, 44, 55, 63, 77, 81, 87];

const DRIVER_TEMPLATES: Array<(d: string) => string> = [
  (d) => `${d} Fanclub`,
  (d) => `Ghost of ${d}`,
  (d) => `${d} on Softs`,
  (d) => `Fast Like ${d}`,
  (d) => `${d}'s Mechanic`,
  (d) => `Team ${d}`,
  (d) => `${d} Stan`,
];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export const MAX_NICKNAME_LENGTH = 30;

export const randomNickname = (): string => {
  // Roughly half racing-words combos, half driver nods.
  const name =
    Math.random() < 0.5 ? `${pick(ADJECTIVES)} ${pick(NOUNS)}` : pick(DRIVER_TEMPLATES)(pick(DRIVERS));
  return name.slice(0, MAX_NICKNAME_LENGTH).trim();
};

export const numberedNickname = (base: string): string => {
  const suffix = ` ${pick(NUMBERS)}`;
  return base.slice(0, MAX_NICKNAME_LENGTH - suffix.length).trim() + suffix;
};
