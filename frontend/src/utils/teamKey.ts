// Team and driver names come in slightly different spellings depending on the
// source (our static team page, the drivers table, Jolpi's constructor
// standings): "Red Bull Racing" / "Red Bull", "RB F1 Team" / "Racing Bulls",
// "Haas F1 Team" / "Haas", Sauber's 2026 rename to Audi. Reduce them to one key.
export const teamKey = (name: string): string => {
  let key = name.toLowerCase().trim();
  key = key.replace(/\s+f1 team$/, '');
  if (key === 'rb') key = 'racing bulls';
  if (key === 'kick sauber' || key === 'sauber' || key === 'stake f1 team kick sauber') key = 'audi';
  key = key.replace(/\s+racing$/, '');
  return key;
};

// "Nico HULKENBERG" and "Nico Hülkenberg" -> "hulkenberg"
export const driverKey = (name: string): string => {
  const surname = name.trim().split(/\s+/).pop() || name;
  return surname.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
};
