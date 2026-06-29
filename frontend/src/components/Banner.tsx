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
      <div className="w-full py-5 px-4 border-b border-f1-neutral-800 text-center" style={{ backgroundColor: '#0E0E0E' }}>
        <p className="text-f1-neutral-500 font-mono text-xs uppercase tracking-widest">Fetching race data...</p>
      </div>
    );
  }

  const qualiLeft = qualifyingDate ? getTimeLeft(qualifyingDate) : null;
  const raceLeft  = getTimeLeft(nextRaceDate);
  const showQualifying = qualiLeft && !qualiLeft.past;
  const targetLabel    = showQualifying ? 'QUALIFYING' : (isSprint ? 'SPRINT' : 'RACE');
  const { hours, minutes, seconds, past } = showQualifying ? qualiLeft : raceLeft;

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#0E0E0E' }}>
      {/* Top label bar */}
      <div className="border-b border-f1-neutral-800 px-4 py-1.5 flex items-center gap-3">
        <div className="w-2 h-2 bg-f1-pink-500" style={{ borderRadius: 0 }} />
        <span className="text-f1-neutral-500 font-mono text-[10px] uppercase tracking-[0.25em]">
          {isSprint ? 'Sprint Weekend' : 'Race Weekend'}
        </span>
        <span className="text-white font-mono text-[10px] uppercase tracking-widest ml-auto">
          {nextRaceName}
        </span>
      </div>

      {/* Countdown row */}
      <div className="px-4 py-4 flex items-center justify-center gap-4">
        {past ? (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-f1-pink-500 animate-pulse" />
            <span className="font-f1 font-black text-f1-pink-500 text-sm uppercase tracking-widest">
              {targetLabel === 'QUALIFYING' ? 'Qualifying in progress' : 'Race in progress'}
            </span>
          </div>
        ) : (
          <>
            <span className="text-f1-neutral-500 font-mono text-[10px] uppercase tracking-[0.2em] hidden sm:block">
              {targetLabel} in
            </span>
            <div className="flex items-end gap-1">
              {/* Hours */}
              <div className="text-center">
                <div className="bg-f1-neutral-950 border border-f1-neutral-800 px-3 py-2 min-w-[52px]">
                  <span className="font-mono font-black text-white text-3xl tabular-nums">{pad(hours)}</span>
                </div>
                <p className="text-f1-neutral-600 text-[9px] font-mono uppercase tracking-widest mt-1">HRS</p>
              </div>
              <span className="text-f1-pink-500 font-black text-2xl pb-5">:</span>
              {/* Minutes */}
              <div className="text-center">
                <div className="bg-f1-neutral-950 border border-f1-neutral-800 px-3 py-2 min-w-[52px]">
                  <span className="font-mono font-black text-white text-3xl tabular-nums">{pad(minutes)}</span>
                </div>
                <p className="text-f1-neutral-600 text-[9px] font-mono uppercase tracking-widest mt-1">MIN</p>
              </div>
              <span className="text-f1-pink-500 font-black text-2xl pb-5">:</span>
              {/* Seconds */}
              <div className="text-center">
                <div className="bg-f1-neutral-950 border border-f1-pink-500/30 px-3 py-2 min-w-[52px]">
                  <span className="font-mono font-black text-f1-pink-400 text-3xl tabular-nums">{pad(seconds)}</span>
                </div>
                <p className="text-f1-pink-600 text-[9px] font-mono uppercase tracking-widest mt-1">SEC</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Banner;
