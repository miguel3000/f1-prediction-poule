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
  const hours = Math.floor(distance / (1000 * 60 * 60));
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

  const accentColor = isSprint
    ? 'from-orange-600 to-orange-500'
    : 'from-f1-red to-red-700';

  if (!nextRaceDate || !nextRaceName) {
    return (
      <div className={`bg-gradient-to-r ${accentColor} py-6 px-4 text-center`}>
        <p className="text-white font-bold tracking-widest text-sm uppercase">Loading next race...</p>
      </div>
    );
  }

  const qualiLeft = qualifyingDate ? getTimeLeft(qualifyingDate) : null;
  const raceLeft = getTimeLeft(nextRaceDate);

  const showQualifying = qualiLeft && !qualiLeft.past;
  const targetLabel = showQualifying ? 'QUALIFYING' : (isSprint ? 'SPRINT' : 'RACE');
  const { hours, minutes, seconds, past } = showQualifying ? qualiLeft : raceLeft;

  return (
    <div className={`bg-gradient-to-r ${accentColor} py-5 px-4`}>
      <div className="max-w-lg mx-auto text-center">
        <p className="text-white/80 text-xs font-bold tracking-[0.2em] uppercase mb-1">
          {isSprint ? '🏃 Sprint Weekend' : '🏁 Race Weekend'} · {nextRaceName}
        </p>

        {past ? (
          <p className="text-white font-bold text-2xl tracking-wider">
            {targetLabel === 'QUALIFYING' ? 'QUALIFYING IN PROGRESS' : 'RACE IN PROGRESS'}
          </p>
        ) : (
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-white/70 text-sm font-bold tracking-widest uppercase">
              {targetLabel} IN
            </span>
            <div className="flex items-center gap-1">
              <div className="bg-black/30 rounded px-3 py-1 min-w-[3.5rem] text-center">
                <span className="text-white font-mono font-bold text-3xl">{pad(hours)}</span>
                <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">hrs</p>
              </div>
              <span className="text-white font-bold text-3xl mb-4">:</span>
              <div className="bg-black/30 rounded px-3 py-1 min-w-[3.5rem] text-center">
                <span className="text-white font-mono font-bold text-3xl">{pad(minutes)}</span>
                <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">min</p>
              </div>
              <span className="text-white font-bold text-3xl mb-4">:</span>
              <div className="bg-black/30 rounded px-3 py-1 min-w-[3.5rem] text-center">
                <span className="text-white font-mono font-bold text-3xl">{pad(seconds)}</span>
                <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">sec</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Banner;
