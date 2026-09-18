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

const Banner = ({ nextRaceDate, nextRaceName, qualifyingDate, isSprint }: BannerProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!nextRaceDate || !nextRaceName) {
    return (
      <div className="w-full py-5 px-4 border-b border-f1-neutral-800 text-center" style={{ backgroundColor: '#191517' }}>
        <p className="text-f1-neutral-500 font-f1-badge text-xs uppercase tracking-widest">Fetching race data...</p>
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
      {/* Top label bar — same yellow badge / blue bar motif as the rest of the site */}
      <div className="bg-f1-blue px-4 py-1.5 flex items-center gap-3">
        <div className="w-2 h-2 bg-f1-yellow-400 flex-shrink-0" style={{ borderRadius: 0 }} />
        <span className="text-blue-100/80 font-f1-badge text-[10px] uppercase tracking-[0.25em]">
          {isSprint ? 'Sprint Weekend' : 'Race Weekend'}
        </span>
        <span className="text-white font-f1-badge text-[10px] uppercase tracking-widest ml-auto truncate">
          {nextRaceName}
        </span>
      </div>

      {/* Countdown — one continuous digital readout, not separate boxed units */}
      <div className="bg-f1-neutral-950 px-4 py-5 flex flex-col items-center gap-1">
        {past ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-f1-yellow-500 animate-pulse" />
            <span className="font-f1-badge font-bold text-f1-yellow-500 text-sm uppercase tracking-widest">
              {targetLabel === 'QUALIFYING' ? 'Qualifying in progress' : 'In progress'}
            </span>
          </div>
        ) : (
          <>
            <span className="text-f1-neutral-500 font-f1-badge text-[9px] uppercase tracking-[0.3em]">
              {targetLabel} in
            </span>
            <div className="font-f1-badge font-bold text-f1-yellow-500 text-5xl sm:text-6xl tabular-nums leading-none">
              {pad(hours)}<span className="text-white">:</span>{pad(minutes)}<span className="text-white">:</span>{pad(seconds)}
            </div>
          </>
        )}
      </div>

      {/* Sponsor-style footer strip — same convention as every panel in the brandbook */}
      <div className="bg-f1-blue text-center py-1">
        <span className="font-f1-badge text-white text-[9px] uppercase tracking-[0.25em]">
          Poule Position &middot; Official Timing
        </span>
      </div>
    </div>
  );
};

export default Banner;
