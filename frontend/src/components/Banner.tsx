import { useState, useEffect } from 'react';

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
const formatNLTime = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find(p => p.type === 'hour')?.value ?? '00';
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hh}.${mm} HOURS`;
};

const Banner = ({ nextRaceDate, nextRaceName, qualifyingDate, isSprint }: BannerProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!nextRaceDate || !nextRaceName) {
    return (
      <div className="w-full py-5 px-4 border-b border-f1-neutral-800 text-center" style={{ backgroundColor: '#191517' }}>
        <p className="text-f1-neutral-500 font-brand text-sm tracking-widest uppercase">Fetching race data...</p>
      </div>
    );
  }

  const qualiLeft = qualifyingDate ? getTimeLeft(qualifyingDate) : null;
  const raceLeft  = getTimeLeft(nextRaceDate);
  const showQualifying = qualiLeft && !qualiLeft.past;
  const targetLabel    = showQualifying ? 'QUALIFYING' : (isSprint ? 'SPRINT' : 'RACE');
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
  const rowGrid = 'relative grid grid-cols-2 items-center px-4 py-4 sm:py-6 overflow-hidden';
  const shear: React.CSSProperties = { transform: 'skewX(-13deg)', display: 'inline-block' };
  const bigType = 'font-brand tracking-wide uppercase leading-none';
  const sizeWide = 'text-lg sm:text-2xl md:text-4xl lg:text-5xl';

  // Each row's divider matches that row's own background — invisible, rather
  // than a contrasting line — but is still offset per row (+right on top,
  // centered on middle, -left on bottom) so the three segments read as one
  // continuous 13° cut running through the whole stack, not three
  // independently-centered strokes.
  const Divider = ({ color, offset = 0 }: { color: string; offset?: number }) => (
    <div
      className="absolute top-0 bottom-0 left-1/2 w-[3px] pointer-events-none"
      style={{ backgroundColor: color, transform: `translateX(calc(-50% + ${offset}px)) skewX(-13deg)` }}
    />
  );

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div style={fullBleed} className="flex flex-col gap-2">
        {/* Top row — lighter blue, weekend type + race name (logo's POULE line) */}
        <div className={rowGrid} style={{ backgroundColor: '#2596C7' }}>
          <Divider color="#2596C7" offset={8} />
          <span className={`text-white ${bigType} ${sizeWide} text-right truncate pr-3`} style={shear}>
            {isSprint ? 'Sprint Weekend' : 'Race Weekend'}
          </span>
          <span className={`text-white ${bigType} ${sizeWide} text-left truncate pl-3`} style={shear}>
            {nextRaceName}
          </span>
        </div>

        {/* Middle row — yellow, label/value countdown */}
        <div className={rowGrid} style={{ backgroundColor: '#FFD81A' }}>
          <Divider color="#FFD81A" />
          <span className={`text-white ${bigType} ${sizeWide} text-right pr-3`} style={shear}>
            Countdown
          </span>
          {past ? (
            <span className={`text-white ${bigType} ${sizeWide} text-left truncate pl-3`} style={shear}>
              {targetLabel === 'QUALIFYING' ? 'Qualifying in progress' : 'In progress'}
            </span>
          ) : (
            <span className={`text-white ${bigType} ${sizeWide} tabular-nums text-left truncate pl-3`} style={shear}>
              {targetLabel} in &middot; {days > 0 && `${days}d `}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
            </span>
          )}
        </div>

        {/* Bottom row — darker navy, race start time in NL local time (logo's POSITION line) */}
        <div className={rowGrid} style={{ backgroundColor: '#005277' }}>
          <Divider color="#005277" offset={-8} />
          <span className={`text-white ${bigType} ${sizeWide} text-right truncate pr-3`} style={shear}>
            Race Start NL Time
          </span>
          <span className={`text-white ${bigType} ${sizeWide} tabular-nums text-left pl-3`} style={shear}>
            {formatNLTime(nextRaceDate)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Banner;
