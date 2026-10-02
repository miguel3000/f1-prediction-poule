// All players are in the Netherlands, and the race calendar is stored in UTC,
// so session times are always shown in Amsterdam time regardless of the
// device's own timezone (same approach as the homepage banner).
const TIME_ZONE = 'Europe/Amsterdam';

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// e.g. "Sun 4 Oct"
export const formatNLDay = (value: string | Date): string => dayFormat.format(new Date(value));

// e.g. "09:00"
export const formatNLTime = (value: string | Date): string => timeFormat.format(new Date(value));

// e.g. "Sun 4 Oct · 09:00"
export const formatNLDayTime = (value: string | Date): string =>
  `${formatNLDay(value)} · ${formatNLTime(value)}`;
