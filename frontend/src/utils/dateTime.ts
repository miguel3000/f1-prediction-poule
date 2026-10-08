// All players are in the Netherlands, and the race calendar is stored in UTC,
// so session times are always shown in Amsterdam time regardless of the
// device's own timezone (same approach as the homepage banner). Only the
// wording of the day/month follows the chosen language (pass `locale` from useLang).
const TIME_ZONE = 'Europe/Amsterdam';

const dayFormats: Record<string, Intl.DateTimeFormat> = {};
const timeFormats: Record<string, Intl.DateTimeFormat> = {};

const dayFormat = (locale: string) =>
  (dayFormats[locale] ??= new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }));

const timeFormat = (locale: string) =>
  (timeFormats[locale] ??= new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }));

// e.g. "Sun 4 Oct" / "zo 4 okt"
export const formatNLDay = (value: string | Date, locale = 'en-GB'): string => dayFormat(locale).format(new Date(value));

// e.g. "09:00"
export const formatNLTime = (value: string | Date, locale = 'en-GB'): string => timeFormat(locale).format(new Date(value));

// e.g. "Sun 4 Oct · 09:00"
export const formatNLDayTime = (value: string | Date, locale = 'en-GB'): string =>
  `${formatNLDay(value, locale)} · ${formatNLTime(value, locale)}`;

// Calendar day in Amsterdam time as "2026-10-09", for grouping sessions by day.
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKeyNL = (value: string | Date): string => dayKeyFormat.format(new Date(value));
