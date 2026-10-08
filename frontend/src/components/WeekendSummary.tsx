import { WeekendSession } from '../services/api';
import { formatNLDay, formatNLTime, dayKeyNL } from '../utils/dateTime';
import { useLang } from '../i18n/LanguageContext';

// The short version of a race weekend for a race card: one line per day with
// that day's sessions and their start times (Dutch time), race in yellow.
interface WeekendSummaryProps {
  sessions: WeekendSession[];
}

const WeekendSummary = ({ sessions }: WeekendSummaryProps) => {
  const { t, locale } = useLang();

  const days: Array<{ key: string; label: string; sessions: WeekendSession[] }> = [];
  for (const session of sessions) {
    const key = dayKeyNL(session.startsAt);
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.sessions.push(session);
    } else {
      days.push({ key, label: formatNLDay(session.startsAt, locale), sessions: [session] });
    }
  }

  return (
    <div className="space-y-1">
      {days.map((day) => (
        <div key={day.key} className="flex items-baseline gap-1.5 text-[11px]">
          <span className="w-[3.75rem] shrink-0 text-[9px] text-white/70 uppercase tracking-wide">{day.label}</span>
          <span className="min-w-0 flex flex-wrap gap-x-1.5">
            {day.sessions.map((session) => (
              <span key={session.key} className="whitespace-nowrap">
                <span className="text-[9px] uppercase tracking-wide text-white/70">{t(`weekend.short.${session.key}`)}</span>{' '}
                <span className={`font-f1-badge ${session.key === 'race' ? 'text-f1-yellow-400' : ''}`}>
                  {formatNLTime(session.startsAt, locale)}
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
};

export default WeekendSummary;
