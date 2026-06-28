import { useState, useEffect } from 'react';

interface BannerProps {
  qualifyingDate?: Date;
  raceDate?: Date;
  raceName?: string;
  isSprint?: boolean;
}

const Banner = ({ qualifyingDate, raceDate, raceName, isSprint }: BannerProps) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getCountdown = () => {
    if (!qualifyingDate || !raceDate) return null;

    const qualiTime = new Date(qualifyingDate).getTime();
    const raceTime = new Date(raceDate).getTime();
    const currentTime = now.getTime();

    // Determine which session to count down to
    const qualiPassed = currentTime >= qualiTime;
    const racePassed = currentTime >= raceTime;

    if (racePassed) {
      return { label: isSprint ? 'SPRINT' : 'RACE', hours: 0, minutes: 0, seconds: 0, active: true };
    }

    const targetTime = qualiPassed ? raceTime : qualiTime;
    const targetLabel = qualiPassed
      ? (isSprint ? 'SPRINT' : 'RACE')
      : 'QUALIFYING';
    const distance = targetTime - currentTime;

    const totalHours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return { label: targetLabel, hours: totalHours, minutes, seconds, active: false };
  };

  const countdown = getCountdown();

  if (!countdown) {
    return (
      <div className="bg-gradient-to-r from-f1-red to-red-700 py-4 text-center">
        <span className="text-white font-bold">Loading...</span>
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className={`${
      isSprint
        ? 'bg-gradient-to-r from-orange-600 to-orange-500'
        : 'bg-gradient-to-r from-f1-red to-red-700'
    } py-4 px-4`}>
      <div className="max-w-lg mx-auto text-center">
        {/* Race name */}
        <div className="text-white/70 text-xs font-medium uppercase tracking-widest mb-2">
          {raceName}
        </div>

        {/* Session label */}
        <div className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          {countdown.active
            ? `${countdown.label} IN PROGRESS! 🏁`
            : `${countdown.label} STARTS IN`
          }
        </div>

        {/* Countdown digits */}
        {!countdown.active && (
          <div className="flex items-center justify-center gap-3">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <div className="bg-black/30 rounded-lg px-3 py-2 min-w-[60px] backdrop-blur-sm">
                <span className="text-white text-3xl font-mono font-bold">
                  {pad(countdown.hours)}
                </span>
              </div>
              <span className="text-white/50 text-[10px] uppercase mt-1 tracking-wider">Hours</span>
            </div>

            <span className="text-white/60 text-2xl font-bold mt-[-16px]">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <div className="bg-black/30 rounded-lg px-3 py-2 min-w-[60px] backdrop-blur-sm">
                <span className="text-white text-3xl font-mono font-bold">
                  {pad(countdown.minutes)}
                </span>
              </div>
              <span className="text-white/50 text-[10px] uppercase mt-1 tracking-wider">Min</span>
            </div>

            <span className="text-white/60 text-2xl font-bold mt-[-16px]">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <div className="bg-black/30 rounded-lg px-3 py-2 min-w-[60px] backdrop-blur-sm">
                <span className="text-white text-3xl font-mono font-bold">
                  {pad(countdown.seconds)}
                </span>
              </div>
              <span className="text-white/50 text-[10px] uppercase mt-1 tracking-wider">Sec</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Banner;
