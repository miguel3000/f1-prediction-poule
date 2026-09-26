import { useState, useEffect } from 'react';

interface BannerProps {
  nextRaceDate?: Date;
  nextRaceName?: string;
  qualifyingDate?: Date;
  isSprint?: boolean;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

const getTimeLeft = (target: Date): TimeLeft => {
  const distance = target.getTime() - Date.now();
  if (distance <= 0) return { hours: 0, minutes: 0, seconds: 0, past: true };
  const hours   = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, past: false };
};

const pad = (n: number) => String(n).padStart(2, '0');

// Same skew as the logo's POULE/POSITION bars (skewX(-13), #2596c7 / #005277) —
// a block widened past its container and re-centered so the shear never
// leaves a gap at either edge, clipped by the parent's overflow-hidden.
const SkewBar = ({ color, className = '', children }: { color: string; className?: string; children: React.ReactNode }) => (
  <div className="overflow-hidden">
    <div
      className={`flex items-center px-6 ${className}`}
      style={{ backgroundColor: color, transform: 'skewX(-13deg)', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '32px', paddingRight: '32px' }}
    >
      {children}
    </div>
  </div>
);

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
  const { hours, minutes, seconds, past } = showQualifying ? qualiLeft : raceLeft;

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      {/* Top banner — same skewed bar + color as the logo's POULE line */}
      <SkewBar color="#2596c7" className="py-2 gap-3">
        <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: '#ffd81a' }} />
        <span className="text-white/80 font-brand text-sm tracking-wide uppercase">
          {isSprint ? 'Sprint Weekend' : 'Race Weekend'}
        </span>
        <span className="text-white font-brand text-sm tracking-wide uppercase ml-auto truncate">
          {nextRaceName}
        </span>
      </SkewBar>

      {/* Countdown — one continuous digital readout, not separate boxed units */}
      <div className="bg-f1-neutral-950 px-4 py-5 flex flex-col items-center gap-1">
        {past ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-f1-yellow-500 animate-pulse" />
            <span className="font-brand text-f1-yellow-500 text-lg tracking-widest uppercase">
              {targetLabel === 'QUALIFYING' ? 'Qualifying in progress' : 'In progress'}
            </span>
          </div>
        ) : (
          <>
            <span className="text-f1-neutral-500 font-brand text-xs tracking-[0.3em] uppercase">
              {targetLabel} in
            </span>
            <div className="font-brand text-f1-yellow-500 text-6xl sm:text-7xl tabular-nums leading-none">
              {pad(hours)}<span className="text-white">:</span>{pad(minutes)}<span className="text-white">:</span>{pad(seconds)}
            </div>
          </>
        )}
      </div>

      {/* Footer banner — same skewed bar + color as the logo's POSITION line */}
      <SkewBar color="#005277" className="py-1.5 justify-center">
        <span className="font-brand text-white text-xs tracking-[0.2em] uppercase">
          Poule Position &middot; Official Timing
        </span>
      </SkewBar>
    </div>
  );
};

export default Banner;
