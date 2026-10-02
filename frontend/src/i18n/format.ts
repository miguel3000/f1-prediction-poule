import type { Lang } from './LanguageContext';

// 1st / 2nd / 3rd in English, 1e / 2e / 3e in Dutch.
export const ordinal = (n: number, lang: Lang): string => {
  if (lang === 'nl') return `${n}e`;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};
