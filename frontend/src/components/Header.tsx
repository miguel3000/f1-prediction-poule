import { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LogoMark from './LogoMark';
import { RacingFlagIcon, CheckeredFlagIcon, HelmetIcon, TeamIcon, TrophyIcon, PredictionIcon, ChartIcon, MoreIcon } from './icons';

interface HeaderProps {
  onMoreToggle: () => void;
  moreActive: boolean;
}

const desktopLinks = [
  { path: '/', label: 'Home', icon: RacingFlagIcon, end: true },
  { path: '/races', label: 'Races', icon: CheckeredFlagIcon, end: false },
  { path: '/drivers', label: 'Drivers', icon: HelmetIcon, end: false },
  { path: '/teams', label: 'Teams', icon: TeamIcon, end: false },
  { path: '/leaderboard', label: 'Standings', icon: TrophyIcon, end: false },
  { path: '/stats', label: 'Stats', icon: ChartIcon, end: false },
];

const Header = ({ onMoreToggle, moreActive }: HeaderProps) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-f1-neutral-800 backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(22,18,23,0.85)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 h-16">

          {/* Logo — pinned left, app-icon style */}
          <button onClick={() => navigate('/')} className="flex-shrink-0 focus:outline-none select-none" aria-label="Poule Position home">
            <LogoMark variant="full" className="hidden md:block h-9 w-auto" />
            <LogoMark variant="icon" className="block md:hidden h-8 w-8" />
          </button>

          <div className="w-px h-6 bg-f1-neutral-800 hidden md:block" />

          {/* Desktop persistent nav — no drawer, always visible */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {desktopLinks.map(({ path, label, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className="relative px-3 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors group"
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-f1-pink-500' : 'text-f1-neutral-500 group-hover:text-f1-neutral-300'}`} />
                    <span className={isActive ? 'text-white' : 'text-f1-neutral-400 group-hover:text-white'}>{label}</span>
                    <span
                      className={`absolute left-3 right-3 -bottom-[1px] h-0.5 transition-all duration-200 ${
                        isActive ? 'bg-f1-pink-500 shadow-f1-glow' : 'bg-transparent'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/predictions"
                className="relative px-3 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors group"
              >
                {({ isActive }) => (
                  <>
                    <PredictionIcon className={`w-4 h-4 transition-colors ${isActive ? 'text-f1-pink-500' : 'text-f1-neutral-500 group-hover:text-f1-neutral-300'}`} />
                    <span className={isActive ? 'text-white' : 'text-f1-neutral-400 group-hover:text-white'}>Predictions</span>
                    <span
                      className={`absolute left-3 right-3 -bottom-[1px] h-0.5 transition-all duration-200 ${
                        isActive ? 'bg-f1-pink-500 shadow-f1-glow' : 'bg-transparent'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            )}
          </nav>

          <div className="flex-1 md:hidden" />

          {/* User + More */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                <div
                  className="hidden md:block text-right cursor-pointer"
                  onClick={() => navigate('/profile')}
                >
                  <p className="text-sm font-bold text-white hover:text-f1-pink-400 transition-colors leading-tight">{user.nickname}</p>
                  <p className="text-xs text-f1-pink-500 font-mono font-semibold tabular-nums leading-tight">{user.total_points} PTS</p>
                </div>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.nickname}
                    className="w-9 h-9 border-2 border-f1-pink-500 cursor-pointer object-cover"
                    style={{ borderRadius: 0 }}
                    onClick={() => navigate('/profile')}
                  />
                ) : (
                  <div
                    className="w-9 h-9 border border-f1-neutral-700 bg-f1-neutral-850 flex items-center justify-center text-sm font-black cursor-pointer hover:border-f1-pink-500 transition-colors"
                    onClick={() => navigate('/profile')}
                  >
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={logout}
                  className="hidden md:block text-xs text-f1-neutral-500 hover:text-f1-pink-400 transition-colors font-bold uppercase tracking-wider"
                >
                  Out
                </button>
              </>
            ) : (
              <a href="/auth" className="btn-f1-primary px-5 py-2 text-sm">
                Login
              </a>
            )}

            <button
              onClick={onMoreToggle}
              className={`p-2 transition-colors border ${
                moreActive
                  ? 'text-f1-pink-500 border-f1-pink-500'
                  : 'text-f1-neutral-400 border-f1-neutral-800 hover:text-white hover:border-f1-neutral-600'
              }`}
              aria-label="More"
            >
              <MoreIcon className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
