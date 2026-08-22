import { NavLink } from 'react-router-dom';
import { RacingFlagIcon, CheckeredFlagIcon, TrophyIcon, ChartIcon } from './icons';
import { MoreIcon } from './icons';

interface BottomTabBarProps {
  onMoreClick: () => void;
  moreActive: boolean;
}

const tabs = [
  { path: '/', label: 'Home', icon: RacingFlagIcon, end: true },
  { path: '/races', label: 'Races', icon: CheckeredFlagIcon, end: false },
  { path: '/leaderboard', label: 'Standings', icon: TrophyIcon, end: false },
  { path: '/stats', label: 'Stats', icon: ChartIcon, end: false },
];

const BottomTabBar = ({ onMoreClick, moreActive }: BottomTabBarProps) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-f1-neutral-800 backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(18,16,18,0.92)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 h-16">
        {tabs.map(({ path, label, icon: Icon, end }) => (
          <li key={path} className="flex">
            <NavLink
              to={path}
              end={end}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 transition-all duration-200 ${
                      isActive ? 'bg-f1-pink-500 shadow-f1-glow' : 'bg-transparent'
                    }`}
                  />
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-f1-pink-500' : 'text-f1-neutral-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    isActive ? 'text-white' : 'text-f1-neutral-500'
                  }`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex">
          <button
            onClick={onMoreClick}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          >
            <span
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 transition-all duration-200 ${
                moreActive ? 'bg-f1-pink-500 shadow-f1-glow' : 'bg-transparent'
              }`}
            />
            <MoreIcon className={`w-5 h-5 transition-colors ${moreActive ? 'text-f1-pink-500' : 'text-f1-neutral-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${
              moreActive ? 'text-white' : 'text-f1-neutral-500'
            }`}>
              More
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default BottomTabBar;
