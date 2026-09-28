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

  // One angled line (matching the logo's skew) running through all three rows,
  // splitting each into a label half and a value half instead of a plain
  // vertical divider.
  const Divider = () => (
    <div
      className="absolute top-0 bottom-0 left-1/2 w-[3px] pointer-events-none"
      style={{ backgroundColor: '#191517', transform: 'translateX(-50%) skewX(-13deg)' }}
    />
  );

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div style={fullBleed}>
        <div className="relative">
          <Divider />

          {/* Top row — lighter blue, weekend type + race name (logo's POULE line) */}
          <div className="grid grid-cols-2 items-center px-4 py-2" style={{ backgroundColor: '#2596C7' }}>
            <span className="text-white/80 font-brand text-xs sm:text-sm tracking-wide uppercase text-center truncate">
              {isSprint ? 'Sprint Weekend' : 'Race Weekend'}
            </span>
            <span className="text-white font-brand text-xs sm:text-sm tracking-wide uppercase text-center truncate">
              {nextRaceName}
            </span>
          </div>

          {/* Middle row — yellow, label/value countdown */}
          <div className="grid grid-cols-2 items-center px-4 py-2" style={{ backgroundColor: '#FFD81A' }}>
            <span className="text-white font-brand text-xs sm:text-sm tracking-wide uppercase text-center">
              Countdown
            </span>
            {past ? (
              <span className="text-white font-brand text-xs sm:text-sm tracking-wide uppercase text-center truncate">
                {targetLabel === 'QUALIFYING' ? 'Qualifying in progress' : 'In progress'}
              </span>
            ) : (
              <span className="text-white font-brand text-xs sm:text-sm tracking-wide uppercase tabular-nums text-center truncate">
                {targetLabel} in &middot; {days > 0 && `${days}d `}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
              </span>
            )}
          </div>

          {/* Bottom row — darker navy, race start time in NL local time (logo's POSITION line) */}
          <div className="grid grid-cols-2 items-center px-4 py-1.5" style={{ backgroundColor: '#005277' }}>
            <span className="font-brand text-white text-[10px] sm:text-xs tracking-[0.2em] uppercase text-center truncate">
              Race Start NL Time
            </span>
            <span className="font-brand text-white text-[10px] sm:text-xs tracking-[0.2em] uppercase tabular-nums text-center">
              {formatNLTime(nextRaceDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;
