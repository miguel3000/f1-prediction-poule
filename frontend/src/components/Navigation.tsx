import { Link } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  RacingFlagIcon, CheckeredFlagIcon, HelmetIcon, TeamIcon, TrophyIcon,
  PredictionIcon, ChartIcon, ClipboardIcon, InfoIcon, ShieldIcon, WrenchIcon,
} from './icons';

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

const Navigation = ({ isOpen, onClose }: NavigationProps) => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const menuItems = [
    { path: '/',            label: 'Homepage',      icon: <RacingFlagIcon /> },
    { path: '/races',       label: 'Race Overview', icon: <CheckeredFlagIcon /> },
    { path: '/drivers',     label: 'Drivers',       icon: <HelmetIcon /> },
    { path: '/teams',       label: 'Teams',         icon: <TeamIcon /> },
    { path: '/leaderboard', label: 'Championship',  icon: <TrophyIcon /> },
  ];
  if (user) menuItems.push({ path: '/predictions', label: 'My Predictions', icon: <PredictionIcon /> });
  menuItems.push({ path: '/stats', label: 'Statistics', icon: <ChartIcon /> });

  const footerItems = [
    { path: '/rules',   label: 'Rules',          icon: <ClipboardIcon /> },
    { path: '/about',   label: 'About',          icon: <InfoIcon /> },
    { path: '/privacy', label: 'Privacy Policy', icon: <ShieldIcon /> },
    { path: '/pitlane', label: 'Pitlane',        icon: <WrenchIcon /> },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/80 z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] z-50 transform transition-transform duration-300 ease-out shadow-2xl border-l border-f1-neutral-800 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: '#161217', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-f1-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-f1-pink-500" />
            <span className="font-f1 font-black text-white text-sm uppercase tracking-widest">Menu</span>
          </div>
          <button
            onClick={onClose}
            className="text-f1-neutral-500 hover:text-f1-pink-500 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 text-sm font-semibold text-f1-neutral-300 hover:text-white hover:bg-f1-neutral-900 border-l-2 border-transparent hover:border-f1-pink-500 transition-all duration-150 py-3 px-4 uppercase tracking-wider"
                >
                  <span className="text-f1-neutral-500">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer nav */}
        <div className="border-t border-f1-neutral-800 py-2 flex-shrink-0">
          <ul>
            {footerItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 text-xs text-f1-neutral-500 hover:text-f1-neutral-300 hover:bg-f1-neutral-900 border-l-2 border-transparent hover:border-f1-pink-600 transition-all duration-150 py-2.5 px-4 uppercase tracking-wider"
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
