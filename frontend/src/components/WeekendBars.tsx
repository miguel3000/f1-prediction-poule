import { WeekendSession } from '../services/api';
import { formatNLDayTime } from '../utils/dateTime';
import { useLang } from '../i18n/LanguageContext';

// The signature banner rows (see Banner.tsx / InfoBannerRows.tsx) in a compact
// size, listing every session of a race weekend with its start time. Same
// look: blue / yellow / navy bars, label and value split by a skewed divider
// that is cut through the whole stack as one diagonal line.
const COLORS = ['#2596C7', '#FFD81A', '#005277'];
const GAP = '#1F1A1D'; // the modal's own background, so the divider reads as part of the gap

interface WeekendBarsProps {
  sessions: WeekendSession[];
}

const shear: React.CSSProperties = { transform: 'skewX(-13deg)', display: 'inline-block' };

const WeekendBars = ({ sessions }: WeekendBarsProps) => {
  const { t, locale } = useLang();
  const n = sessions.length;
  const mid = (n - 1) / 2;
  const step = 4;
  const now = Date.now();

  return (
    <div>
      <div className="flex flex-col gap-1">
        {sessions.map((session, i) => {
          const offset = Math.round((mid - i) * step);
          const over = new Date(session.startsAt).getTime() < now;
          return (
            <div
              key={session.key}
              className="relative grid items-center px-3 py-1.5 sm:py-2 overflow-hidden"
              style={{
                backgroundColor: COLORS[i % COLORS.length],
                gridTemplateColumns: `calc(50% + ${offset}px) calc(50% - ${offset}px)`,
                opacity: over ? 0.55 : 1,
              }}
            >
              <div
                className="absolute top-0 bottom-0 left-1/2 w-1.5 pointer-events-none"
                style={{ backgroundColor: GAP, transform: `translateX(calc(-50% + ${offset}px)) skewX(-13deg)` }}
              />
              <span
                className="font-brand tracking-wide uppercase leading-none text-white text-sm sm:text-lg text-right truncate pr-3"
                style={shear}
              >
                {t(`weekend.${session.key}`)}
              </span>
              <span
                className="font-brand tracking-wide uppercase leading-none text-white text-sm sm:text-lg tabular-nums text-left truncate pl-3"
                style={shear}
              >
                {formatNLDayTime(session.startsAt, locale)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wider text-white/60">{t('weekend.timeNote')}</p>
    </div>
  );
};

export default WeekendBars;
