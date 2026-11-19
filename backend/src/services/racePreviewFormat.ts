import type { EmailLang } from './emailI18n';
import type { CircuitFacts } from '../data/circuits';

// Formatting for the Thursday race weekend preview mail. Everything is shown in Dutch time (the
// site does the same on the Races page: "All times in Dutch time"), so a Friday 01:30 session
// stays on the Friday of the Dutch calendar, as in the schedule the players already know.
export const PREVIEW_TIME_ZONE = 'Europe/Amsterdam';

const LOCALES: Record<EmailLang, string> = { en: 'en-GB', nl: 'nl-NL' };

const part = (date: Date, locale: string, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(locale, { timeZone: PREVIEW_TIME_ZONE, ...options }).format(date);

// "01:30", never "1:30" and never "24:30"
export const timeOf = (date: Date): string =>
  part(date, 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// The Dutch calendar day, to group sessions under one day heading ("2026-11-20")
export const dayKeyOf = (date: Date): string => part(date, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

export const weekdayShort = (date: Date, lang: EmailLang): string => part(date, LOCALES[lang], { weekday: 'short' });

// "Sunday 22 November" / "zondag 22 november"
export const dayLongOf = (date: Date, lang: EmailLang): string =>
  part(date, LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'long' });

// "Sun 05:00" / "zo 05:00", short enough for a subject line
export const shortWhenOf = (date: Date, lang: EmailLang): string => `${weekdayShort(date, lang)} ${timeOf(date)}`;

const MILES_PER_KM = 0.621371;
export const kmToMiles = (km: number): number => km * MILES_PER_KM;

const number = (value: number, lang: EmailLang, digits: number): string =>
  new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export interface CircuitFactsText {
  lapKm: string;
  lapMi: string;
  laps: string;
  distanceKm: string;
  distanceMi: string;
}

// Lap length to the metre as Formula 1 publishes it (6.201 km, 3.853 mi); race distance to a
// tenth, because the published figure is an official rounding of laps times length anyway.
export const circuitFactsText = (facts: CircuitFacts, lang: EmailLang): CircuitFactsText => ({
  lapKm: `${number(facts.lengthKm, lang, 3)} km`,
  lapMi: `${number(kmToMiles(facts.lengthKm), lang, 3)} mi`,
  laps: number(facts.laps, lang, 0),
  distanceKm: `${number(facts.raceDistanceKm, lang, 1)} km`,
  distanceMi: `${number(kmToMiles(facts.raceDistanceKm), lang, 1)} mi`,
});
