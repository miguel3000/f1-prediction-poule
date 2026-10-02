import { useState, useEffect } from 'react';
import { useLang } from '../i18n/LanguageContext';

interface BannerProps {
  nextRaceDate?: Date;
  nextRaceName?: string;
  qualifyingDate?: Date;
  isSprint?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

const getTimeLeft = (target: Date): TimeLeft => {
  const distance = target.getTime() - Date.now();
  if (distance <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const days    = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, past: false };
};

const pad = (n: number) => String(n).padStart(2, '0');

// Race's local Dutch kickoff time, independent of whatever the countdown above
// is currently targeting (qualifying, sprint, or the race itself).
const formatNLTime = (date: Date, hoursLabel: string): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find(p => p.type === 'hour')?.value ?? '00';
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hh}.${mm} ${hoursLabel}`;
};

const Banner = ({ nextRaceDate, nextRaceName, qualifyingDate, isSprint }: BannerProps) => {
  const [, setTick] = useState(0);
  const { t } = useLang();

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!nextRaceDate || !nextRaceName) {
    return (
      <div className="w-full py-5 px-4 border-b border-f1-neutral-800 text-center" style={{ backgroundColor: '#191517' }}>
        <p className="text-white font-brand text-sm tracking-widest uppercase">{t('banner.fetching')}</p>
      </div>
    );
  }

  const qualiLeft = qualifyingDate ? getTimeLeft(qualifyingDate) : null;
  const raceLeft  = getTimeLeft(nextRaceDate);
  const showQualifying = qualiLeft && !qualiLeft.past;
  const targetKey      = showQualifying ? 'banner.targetQualifying' : (isSprint ? 'banner.targetSprint' : 'banner.targetRace');
  const targetLabel    = t(targetKey);
  const { days, hours, minutes, seconds, past } = showQualifying ? qualiLeft : raceLeft;

  // Full-bleed: breaks out of the page's centered max-width container to span
  // the whole viewport, regardless of how deep it's nested.
  const fullBleed: React.CSSProperties = {
    width: '100vw',
    position: 'relative',
    left: '50%',
    right: '50%',
    marginLeft: '-50vw',
    marginRight: '-50vw',
  };

  // Label left / value right, split by a skewed divider (see below) — literal
  // text shear, not font-style:italic, so the angle matches exactly.
  const rowGrid = 'relative grid items-center px-4 py-4 sm:py-6 overflow-hidden';
  // The label/value column split must track the divider's own offset — the
  // divider isn't fixed at 50% on the top/bottom rows, so the grid columns
  // need to shift with it or the text edges land past (or short of) the line.
  const rowStyle = (bg: string, offset = 0): React.CSSProperties => ({
    backgroundColor: bg,
    gridTemplateColumns: `calc(50% + ${offset}px) calc(50% - ${offset}px)`,
  });
  const shear: React.CSSProperties = { transform: 'skewX(-13deg)', display: 'inline-block' };
  const bigType = 'font-brand tracking-wide uppercase leading-none';
  const sizeWide = 'text-lg sm:text-2xl md:text-4xl lg:text-5xl';

  // Same color and width as the gap between banners (page background, 8px —
  // matches gap-2 below), so the divider reads as an extension of that gap
  // cutting through the row at an angle. Offset per row (+right on top,
  // centered on middle, -left on bottom) so the three segments read as one
  // continuous 13° cut running through the whole stack, not three
  // independently-centered strokes.
  const Divider = ({ offset = 0 }: { offset?: number }) => (
    <div
      className="absolute top-0 bottom-0 left-1/2 w-2 pointer-events-none"
      style={{ backgroundColor: '#191517', transform: `translateX(calc(-50% + ${offset}px)) skewX(-13deg)` }}
    />
  );

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div style={fullBleed} className="flex flex-col gap-2">
        {/* Top row — lighter blue, weekend type + race name (logo's POULE line) */}
        <div className={rowGrid} style={rowStyle('#2596C7', 8)}>
          <Divider offset={8} />
          <span className={`text-white ${bigType} ${sizeWide} text-right truncate pr-3`} style={shear}>
            {isSprint ? t('banner.sprintWeekend') : t('banner.raceWeekend')}
          </span>
          <span className={`text-white ${bigType} ${sizeWide} text-left truncate pl-3`} style={shear}>
            {nextRaceName}
          </span>
        </div>

        {/* Middle row — yellow, label/value countdown */}
        <div className={rowGrid} style={rowStyle('#FFD81A')}>
          <Divider />
          <span className={`text-white ${bigType} ${sizeWide} text-right pr-3`} style={shear}>
            {t('banner.countdown')}
          </span>
          {past ? (
            <span className={`text-white ${bigType} ${sizeWide} text-left truncate pl-3`} style={shear}>
              {showQualifying ? t('banner.qualifyingInProgress') : t('banner.inProgress')}
            </span>
          ) : (
            <span className={`text-white ${bigType} ${sizeWide} tabular-nums text-left truncate pl-3`} style={shear}>
              {t('banner.targetIn', { target: targetLabel })} &middot; {days > 0 && `${days}d `}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
            </span>
          )}
        </div>

        {/* Bottom row — darker navy, race start time in NL local time (logo's POSITION line) */}
        <div className={rowGrid} style={rowStyle('#005277', -8)}>
          <Divider offset={-8} />
          <span className={`text-white ${bigType} ${sizeWide} text-right truncate pr-3`} style={shear}>
            {t('banner.raceStartNl')}
          </span>
          <span className={`text-white ${bigType} ${sizeWide} tabular-nums text-left pl-3`} style={shear}>
            {formatNLTime(nextRaceDate, t('banner.hours'))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Banner;
